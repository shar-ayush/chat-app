import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";
import { FriendRequest } from "../models/FriendRequest.js";
import { Types } from "mongoose";
import { getBufferedMessages } from "../utils/messageBuffer.js";
import { getIO } from "../utils/socket.js";

export async function getChats(req, res, next) {
  try {
    const userId = req.userId;

    const chats = await Chat.find({ participants: userId })
      .populate("participants", "name email avatar")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        const otherParticipant = chat.participants.find((p) => p._id.toString() !== userId);
        
        const senderFilter = Types.ObjectId.isValid(userId)
          ? { $ne: new Types.ObjectId(userId) }
          : { $ne: userId };

        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          sender: senderFilter,
          readBy: { $nin: [userId] },
        });

        // Merge buffered messages into the chat object & calculate active unread
        let activeLastMessage = chat.lastMessage;
        let activeLastMessageAt = chat.lastMessageAt;
        let activeUnreadCount = unreadCount;
        
        const buffered = getBufferedMessages(chat._id.toString());
        if (buffered.length > 0) {
          const latestBuffered = buffered[buffered.length - 1];
          activeLastMessage = latestBuffered;
          activeLastMessageAt = latestBuffered.createdAt;

          for (const bMsg of buffered) {
            const bSenderId = typeof bMsg.sender === "object" && bMsg.sender?._id
              ? bMsg.sender._id.toString()
              : bMsg.sender?.toString();
            const isReadByMe = bMsg.readBy && bMsg.readBy.some((id) => id.toString() === userId);
            if (bSenderId !== userId && !isReadByMe) {
              activeUnreadCount++;
            }
          }
        }

        // If the current activeLastMessage was deleted for the user, dig deeper into DB
        if (activeLastMessage && activeLastMessage.deletedFor && activeLastMessage.deletedFor.includes(userId)) {
          const fallbackMsg = await Message.findOne({
            chat: chat._id,
            deletedFor: { $ne: userId }
          }).sort({ createdAt: -1 });

          if (fallbackMsg) {
            activeLastMessage = fallbackMsg;
            activeLastMessageAt = fallbackMsg.createdAt;
          } else {
            activeLastMessage = null;
          }
        }

        return {
          _id: chat._id,
          participant: otherParticipant ?? null,
          lastMessage: activeLastMessage,
          lastMessageAt: activeLastMessageAt,
          createdAt: chat.createdAt,
          unreadCount: activeUnreadCount,
        };
      })
    );

    res.json(formattedChats);
  } catch (error) {
    res.status(500);
    next(error);
  }
}

export async function getOrCreateChat(req, res, next) {
  try {
    const userId = req.userId;
    const { participantId } = req.params;

    if (!participantId) {
      res.status(400).json({ message: "Participant ID is required" });
      return;
    }

    if (!Types.ObjectId.isValid(participantId)) {
      return res.status(400).json({ message: "Invalid participant ID" });
    }

    if (userId === participantId) {
      res.status(400).json({ message: "Cannot create chat with yourself" });
      return;
    }

    // check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [userId, participantId] },
    })
      .populate("participants", "name email avatar")
      .populate("lastMessage");

    if (!chat) {
      // Must be friends to initiate a new chat
      const isFriend = await FriendRequest.exists({
        status: "accepted",
        $or: [
          { sender: userId, recipient: participantId },
          { sender: participantId, recipient: userId },
        ],
      });

      if (!isFriend) {
        return res.status(403).json({
          message: "You must be accepted friends with this user to start chatting",
        });
      }

      const newChat = new Chat({ participants: [userId, participantId] });
      await newChat.save();
      chat = await newChat.populate("participants", "name email avatar");
    }

    const otherParticipant = chat.participants.find((p) => p._id.toString() !== userId);

    let activeLastMessage = chat.lastMessage;
    let activeLastMessageAt = chat.lastMessageAt;
        
    const buffered = getBufferedMessages(chat._id.toString());
    if (buffered.length > 0) {
      const latestBuffered = buffered[buffered.length - 1];
      activeLastMessage = latestBuffered;
      activeLastMessageAt = latestBuffered.createdAt;
    }

    if (activeLastMessage && activeLastMessage.deletedFor && activeLastMessage.deletedFor.includes(userId)) {
      const fallbackMsg = await Message.findOne({
        chat: chat._id,
        deletedFor: { $ne: userId }
      }).sort({ createdAt: -1 });

      if (fallbackMsg) {
        activeLastMessage = fallbackMsg;
        activeLastMessageAt = fallbackMsg.createdAt;
      } else {
        activeLastMessage = null;
      }
    }

    res.json({
      _id: chat._id,
      participant: otherParticipant ?? null,
      lastMessage: activeLastMessage,
      lastMessageAt: activeLastMessageAt,
      createdAt: chat.createdAt,
    });
  } catch (error) {
    res.status(500);
    next(error);
  }
}

export async function markMessagesAsRead(req, res, next) {
  try {
    const userId = req.userId;
    const { chatId } = req.params;

    if (!Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID" });
    }

    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const senderFilter = Types.ObjectId.isValid(userId)
      ? { $ne: new Types.ObjectId(userId) }
      : { $ne: userId };

    // Mark all unread messages as read
    const result = await Message.updateMany(
      {
        chat: chatId,
        sender: senderFilter, // Only mark messages from other users
        readBy: { $nin: [userId] } // Only mark messages not already read
      },
      {
        $addToSet: { readBy: userId } // Add userId to readBy array
      }
    );

    // ALSO mutate any messages currently sitting in the delay buffer
    const buffered = getBufferedMessages(chatId.toString());
    let bufferUpdatedCount = 0;
    if (buffered && buffered.length > 0) {
      buffered.forEach(msg => {
        // Resolve sender ID safely whether populated or not
        const senderId = typeof msg.sender === 'object' && msg.sender._id 
          ? msg.sender._id.toString() 
          : msg.sender.toString();
          
        const isRead = msg.readBy.some(id => id.toString() === userId);
        
        if (senderId !== userId && !isRead) {
          msg.readBy.push(userId);
          bufferUpdatedCount++;
        }
      });
    }

    // Broadcast messages_read event via socket
    const io = getIO();
    if (io) {
      io.to(`chat:${chatId}`).emit("messages_read", { chatId, readerId: userId });
      for (const participantId of chat.participants) {
        if (participantId.toString() !== userId) {
          io.to(`user:${participantId}`).emit("messages_read", { chatId, readerId: userId });
        }
      }
    }

    res.json({ 
      message: "Messages marked as read",
      markedCount: result.modifiedCount + bufferUpdatedCount
    });
  } catch (error) {
    res.status(500);
    next(error);
  }
}
