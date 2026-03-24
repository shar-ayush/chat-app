import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";
import { Types } from "mongoose";

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
        
        // Count unread messages (messages not read by current user and not sent by current user)
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          sender: { $ne: userId },
          readBy: { $ne: userId }
        });

        return {
          _id: chat._id,
          participant: otherParticipant ?? null,
          lastMessage: chat.lastMessage,
          lastMessageAt: chat.lastMessageAt,
          createdAt: chat.createdAt,
          unreadCount
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
      const newChat = new Chat({ participants: [userId, participantId] });
      await newChat.save();
      chat = await newChat.populate("participants", "name email avatar");
    }

    const otherParticipant = chat.participants.find((p) => p._id.toString() !== userId);

    res.json({
      _id: chat._id,
      participant: otherParticipant ?? null,
      lastMessage: chat.lastMessage,
      lastMessageAt: chat.lastMessageAt,
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

    // Mark all unread messages as read
    const result = await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId }, // Only mark messages from other users
        readBy: { $ne: userId }  // Only mark messages not already read
      },
      {
        $addToSet: { readBy: userId } // Add userId to readBy array
      }
    );

    res.json({ 
      message: "Messages marked as read",
      markedCount: result.modifiedCount 
    });
  } catch (error) {
    res.status(500);
    next(error);
  }
}
