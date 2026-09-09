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

    let afterDate = new Date(0);
    const timestamp = Number(after);
    if (!isNaN(timestamp) && timestamp > 0) {
      afterDate = new Date(timestamp);
    } else {
      const parsedDate = new Date(after);
      if (!isNaN(parsedDate.valueOf())) {
        afterDate = parsedDate;
      }
    }

    matchQuery.$or = [
      { updatedAt: { $gt: afterDate } },
      { createdAt: { $gt: afterDate } },
    ];

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
        if (msgDate > afterDate) {
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

    const messages = await Message.find({ chat: chatId, deletedFor: { $ne: userId } })
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 }); 

    const buffered = getBufferedMessages(chatId.toString()).filter(
      (msg) => !msg.deletedFor || !msg.deletedFor.includes(userId)
    );
    if (buffered.length > 0) {
      messages.push(...buffered);
    }

    res.json(messages);
  } catch (error) {
    res.status(500);
    next(error);
  }
}
