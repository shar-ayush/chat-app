import { Socket, Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken } from "@clerk/express";
import { Message } from "../models/Message.js";
import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js";
import 'dotenv/config'
import { addMessageToBuffer, flushChat } from "./messageBuffer.js";
import crypto from "crypto";

export const onlineUsers = new Map();

export const initializeSocket = (httpServer) => {
  const allowedOrigins = [
    "http://localhost:8081", // Expo mobile
    "http://localhost:5173", // Vite web dev
    process.env.FRONTEND_URL, // production
  ].filter(Boolean);

  const io = new SocketServer(httpServer, {
    cors: { origin: allowedOrigins },
    pingInterval: 10000, // Send ping every 10 seconds (default 25s)
    pingTimeout: 5000,   // Disconnect if no pong in 5 seconds (default 20s)
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const session = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });

      const clerkId = session.sub;

      const user = await User.findOne({ clerkId });
      if (!user) return next(new Error("User not found"));

      socket.data.userId = user._id.toString();

      next();
    } catch (error) {
      next(new Error(error));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    socket.emit("online-users", { userIds: Array.from(onlineUsers.keys()) });

    onlineUsers.set(userId, socket.id);

    socket.broadcast.emit("user-online", { userId });

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

    socket.on("delete_for_me", async ({ messageIds, chatId, userId: reqUserId }) => {
      if (reqUserId !== userId) return;
      
      try {
        if (chatId) await flushChat(chatId);
        // messageIds are likely localIds from frontend, or server _ids
        await Message.updateMany(
          { $or: [{ localId: { $in: messageIds } }, { _id: { $in: messageIds } }] },
          { $addToSet: { deletedFor: userId } }
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
          { $set: { isDeleted: true, deletedAt: new Date() } }
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
      onlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", { userId });
    });
  });

  return io;
};
