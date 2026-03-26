import { Message } from "../models/Message.js";
import { Chat } from "../models/Chat.js";

const messageBuffer = new Map();

const chatTimers = new Map();

const FLUSH_INTERVAL_MS = 45000; // 45 seconds
const MAX_BUFFER_SIZE = 10;

/**
 * Get currently buffered messages for a chat
 * @param {string} chatId - The ID of the chat.
 */
export const getBufferedMessages = (chatId) => {
  return messageBuffer.get(chatId.toString()) || [];
};

export const flushChat = async (chatId) => {
  const messages = messageBuffer.get(chatId);
  if (!messages || messages.length === 0) return;

  messageBuffer.delete(chatId);

  if (chatTimers.has(chatId)) {
    clearTimeout(chatTimers.get(chatId));
    chatTimers.delete(chatId);
  }

  console.log(`[Buffer] Flushing ${messages.length} messages for chat ${chatId} to MongoDB...`);

  try {
    await Message.insertMany(messages);
    console.log(`[Buffer] Successfully inserted ${messages.length} messages.`);

    const latestMessage = messages[messages.length - 1];

    await Chat.updateOne(
      { _id: chatId },
      {
        $set: {
          lastMessage: latestMessage._id,
          lastMessageAt: latestMessage.createdAt
        }
      }
    );
  } catch (error) {
    console.error(`Failed to flush messages for chat ${chatId}:`, error);
    const existing = messageBuffer.get(chatId) || [];
    messageBuffer.set(chatId, [...messages, ...existing]);
  }
};

export const addMessageToBuffer = (message) => {
  const chatId = message.chat.toString();

  if (!messageBuffer.has(chatId)) {
    messageBuffer.set(chatId, []);
    chatTimers.set(
      chatId,
      setTimeout(() => {
        console.log(`[Buffer] 30-second timer elapsed for chat ${chatId}. Triggering flush.`);
        flushChat(chatId);
      }, FLUSH_INTERVAL_MS)
    );
  }

  const chatMessages = messageBuffer.get(chatId);
  chatMessages.push(message);

  console.log(`[Buffer] Added message to chat ${chatId}. Queue size: ${chatMessages.length}/${MAX_BUFFER_SIZE}`);

  if (chatMessages.length >= MAX_BUFFER_SIZE) {
    console.log(`[Buffer] Reached max capacity of ${MAX_BUFFER_SIZE}. Triggering immediate flush.`);
    flushChat(chatId);
  }
};


export const flushMessages = async () => {
  const chatIds = Array.from(messageBuffer.keys());
  if (chatIds.length > 0) {
    console.log(`[Buffer] Periodic flush triggered. Found ${chatIds.length} active chats.`);
  }
  for (const chatId of chatIds) {
    await flushChat(chatId);
  }
};

export const flushAllOnShutdown = async () => {
  console.log("Flushing all message buffers on shutdown...");
  await flushMessages();
  console.log("All message buffers flushed.");
};
