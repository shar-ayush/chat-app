import { Socket, Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken, clerkClient } from "@clerk/express";
import { Message } from "../models/Message.js";
import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js";
import 'dotenv/config'
import { addMessageToBuffer, flushChat } from "./messageBuffer.js";
import { generateUniqueUsername } from "./username.js";
import { Types } from "mongoose";
import crypto from "crypto";

// Map of userId -> Set of socket IDs
export const onlineUsers = new Map();

let ioInstance = null;
export const getIO = () => ioInstance;

export const initializeSocket = (httpServer) => {
  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  ioInstance = io;

  io.use(async (socket, next) => {
    let token = socket.handshake.auth?.token;
    if (!token) {
      console.warn("[Socket Auth] No token provided in handshake");
      return next(new Error("Authentication error: Token missing"));
    }

    if (typeof token === "string" && token.startsWith("Bearer ")) {
      token = token.slice(7).trim();
    }

    try {
      let clerkId = null;

      try {
        const session = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        clerkId = session?.sub;
      } catch (verifyErr) {
        console.warn("[Socket Auth] verifyToken error, attempting token decode:", verifyErr?.message);
        // Fallback: decode JWT payload to extract clerkId if verifyToken fails
        if (typeof token === "string") {
          const parts = token.split(".");
          if (parts.length === 3) {
            try {
              const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
              if (payload && payload.sub) {
                clerkId = payload.sub;
                console.log("[Socket Auth] Successfully resolved clerkId from token payload:", clerkId);
              }
            } catch (decodeErr) {
              console.error("[Socket Auth] Failed to decode JWT payload:", decodeErr);
            }
          }
        }
        if (!clerkId) {
          throw verifyErr;
        }
      }

      if (!clerkId) {
        return next(new Error("Authentication error: Invalid session subject"));
      }

      let user = await User.findOne({ clerkId });
      if (!user) {
        // Fetch from Clerk and auto-create to eliminate race conditions
        try {
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const name = clerkUser.firstName
            ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
            : clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] || "User";
          const email = clerkUser.emailAddresses[0]?.emailAddress || "";
          const username = await generateUniqueUsername(clerkUser.username || name, email);

          user = await User.create({
            clerkId,
            name,
            username,
            email,
            avatar: clerkUser.imageUrl || "",
          });
        } catch (clerkErr) {
          console.error("[Socket Auth] Error fetching user from Clerk:", clerkErr?.message);
          return next(new Error("Authentication error: User provisioning failed"));
        }
      }

      socket.data.userId = user._id.toString();
      next();
    } catch (error) {
      console.error("[Socket Auth Error]:", error?.message || error);
      next(new Error(`Authentication error: ${error?.message || "Invalid token"}`));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    let userSockets = onlineUsers.get(userId);
    const isFirstConnection = !userSockets || userSockets.size === 0;

    if (!userSockets) {
      userSockets = new Set();
      onlineUsers.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    // Send current online user list to the connected socket
    socket.emit("online-users", { userIds: Array.from(onlineUsers.keys()) });

    if (isFirstConnection) {
      socket.broadcast.emit("user-online", { userId });
    }

    socket.join(`user:${userId}`);

    socket.on("join-chat", (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on("leave-chat", (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on("send-message", async (data) => {
      try {
        const { localId, chatId, ciphertext, nonce, senderCiphertext, senderNonce, senderPublicKey, filePayload } = data;

        // Validate: must have localId, and either encrypted payload OR file payload
        if (!localId) {
          socket.emit("socket-error", { message: "Missing localId", localId });
          return;
        }

        const isFileMessage = !!filePayload;
        const isTextMessage = !isFileMessage;

        if (isTextMessage && (!ciphertext || !nonce || !senderPublicKey)) {
          socket.emit("socket-error", { message: "Missing encrypted payload or localId", localId });
          return;
        }

        const existingMessage = await Message.findOne({ localId });
        if (existingMessage) {
          socket.emit("message_ack", { localId, serverId: existingMessage._id });
          return;
        }

        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId,
        });

        if (!chat) {
          socket.emit("socket-error", { message: "Chat not found", localId });
          return;
        }

        let message;

        if (isFileMessage) {
          // File message — metadata only, no re-upload
          message = new Message({
            localId,
            chat: chatId,
            sender: userId,
            type: "file",
            text: "",
            fileUrl: filePayload.fileUrl,
            fileName: filePayload.fileName,
            mimeType: filePayload.mimeType,
            fileSize: filePayload.fileSize,
            readBy: [userId],
            createdAt: new Date(),
          });
        } else {
          // Encrypted text message (existing path)
          message = new Message({
            localId,
            chat: chatId,
            sender: userId,
            type: "text",
            text: "",
            ciphertext,
            nonce,
            senderCiphertext: senderCiphertext ?? null,
            senderNonce: senderNonce ?? null,
            senderPublicKey,
            readBy: [userId],
            createdAt: new Date(),
          });
        }

        // Add to buffer for delayed DB insert
        addMessageToBuffer(message);

        // Populate sender so the client receives the standard object format
        await message.populate("sender", "name avatar");

        socket.emit("message_ack", { localId: localId, serverId: message._id });

        for (const participantId of chat.participants) {
          if (participantId.toString() !== userId) {
            io.to(`user:${participantId}`).emit("receive_message", message);
          }
        }
      } catch (error) {
        socket.emit("socket-error", { message: "Failed to send message", localId: data.localId });
      }
    });

    socket.on("typing", async (data) => {
      const typingPayload = {
        userId,
        chatId: data.chatId,
        isTyping: data.isTyping,
      };

      socket.to(`chat:${data.chatId}`).emit("typing", typingPayload);

      try {
        const chat = await Chat.findById(data.chatId);
        if (chat) {
          const otherParticipantId = chat.participants.find((p) => p.toString() !== userId);
          if (otherParticipantId) {
            socket.to(`user:${otherParticipantId}`).emit("typing", typingPayload);
          }
        }
      } catch (error) {
        // silently fail - typing indicator is not critical
      }
    });

    socket.on("mark_read", async ({ chatId }) => {
      if (!chatId) return;
      try {
        const senderFilter = Types.ObjectId.isValid(userId)
          ? { $ne: new Types.ObjectId(userId) }
          : { $ne: userId };

        await Message.updateMany(
          {
            chat: chatId,
            sender: senderFilter,
            readBy: { $nin: [userId] },
          },
          { $addToSet: { readBy: userId } }
        );

        const buffered = getBufferedMessages(chatId.toString());
        if (buffered && buffered.length > 0) {
          buffered.forEach((msg) => {
            const senderId =
              typeof msg.sender === "object" && msg.sender._id
                ? msg.sender._id.toString()
                : msg.sender.toString();
            if (senderId !== userId && !msg.readBy.includes(userId)) {
              msg.readBy.push(userId);
            }
          });
        }

        socket.to(`chat:${chatId}`).emit("messages_read", { chatId, readerId: userId });

        const chat = await Chat.findById(chatId);
        if (chat) {
          for (const participantId of chat.participants) {
            if (participantId.toString() !== userId) {
              io.to(`user:${participantId}`).emit("messages_read", { chatId, readerId: userId });
            }
          }
        }
      } catch (error) {
        console.error("mark_read socket error:", error);
      }
    });

    socket.on("delete_for_me", async ({ messageIds, chatId, userId: reqUserId }) => {
      if (reqUserId !== userId) return;
      
      try {
        if (chatId) await flushChat(chatId);
        // messageIds are likely localIds from frontend, or server _ids
        await Message.updateMany(
          { $or: [{ localId: { $in: messageIds } }, { _id: { $in: messageIds } }] },
          { 
            $addToSet: { deletedFor: userId },
            $set: { updatedAt: new Date() }
          }
        );
        socket.emit("messages_deleted_for_me", { messageIds });
      } catch (error) {
        console.error("Delete for me error:", error);
      }
    });

    socket.on("delete_for_everyone", async ({ messageIds, chatId, userId: reqUserId }) => {
      if (reqUserId !== userId) return;

      try {
        if (chatId) await flushChat(chatId);
        const messages = await Message.find({
          $or: [{ localId: { $in: messageIds } }, { _id: { $in: messageIds } }],
          chat: chatId
        });

        if (messages.length === 0) return;

        const allOwned = messages.every(msg => msg.sender.toString() === userId);
        if (!allOwned) {
          socket.emit("socket-error", { message: "Unauthorized delete", localId: messageIds[0] });
          return;
        }

        await Message.updateMany(
          { _id: { $in: messages.map(m => m._id) } },
          { $set: { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() } }
        );

        const mongoIds = messages.map(m => m._id.toString());
        const allIdsToBroadcast = Array.from(new Set([...messageIds, ...mongoIds]));

        const chat = await Chat.findById(chatId);
        if (chat) {
          const otherParticipantId = chat.participants.find((p) => p.toString() !== userId);
          if (otherParticipantId) {
            io.to(`user:${otherParticipantId}`).emit("messages_deleted", { messageIds: allIdsToBroadcast });
          }
        }

        // Broadcast to chat room
        io.to(`chat:${chatId}`).emit("messages_deleted", { messageIds: allIdsToBroadcast });
      } catch (error) {
        console.error("Delete for everyone error:", error);
      }
    });

    socket.on("disconnect", () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit("user-offline", { userId });
        }
      }
    });
  });

  return io;
};
