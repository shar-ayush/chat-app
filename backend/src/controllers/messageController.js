import { Message } from "../models/Message.js";
import { Chat } from "../models/Chat.js";
import { getBufferedMessages } from "../utils/messageBuffer.js";

export async function syncMessages(req, res, next) {
  try {
    const userId = req.userId;
    const { after } = req.query;

    if (!after) {
      return res.status(400).json({ message: "Missing 'after' query parameter" });
    }

    const chats = await Chat.find({ participants: userId });
    const chatIds = chats.map((c) => c._id);

    const matchQuery = {
      chat: { $in: chatIds },
    };

    const timestamp = Number(after);
    if (!isNaN(timestamp)) {
      matchQuery.createdAt = { $gt: new Date(timestamp) };
    } else {
      const date = new Date(after);
      if (!isNaN(date.valueOf())) {
        matchQuery.createdAt = { $gt: date };
      }
    }

    const messages = await Message.find(matchQuery)
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 });

    // Inject any new messages sitting in the RAM buffer
    let hasBuffered = false;
    for (const chatId of chatIds) {
      const buffered = getBufferedMessages(chatId.toString());
      for (const msg of buffered) {
        // Only include if it meets the 'after' criteria
        const msgDate = new Date(msg.createdAt);
        if (!matchQuery.createdAt || msgDate > matchQuery.createdAt.$gt) {
          messages.push(msg);
          hasBuffered = true;
        }
      }
    }

    if (hasBuffered) {
      messages.sort((a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());
    }

    res.json(messages);
  } catch (error) {
    res.status(500);
    next(error);
  }
}

export async function getMessages(req, res, next) {
  try {
    const userId = req.userId;
    const { chatId } = req.params;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 }); 

    const buffered = getBufferedMessages(chatId.toString());
    if (buffered.length > 0) {
      messages.push(...buffered);
    }

    res.json(messages);
  } catch (error) {
    res.status(500);
    next(error);
  }
}
