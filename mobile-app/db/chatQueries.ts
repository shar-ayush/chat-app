import { runWithDb } from "./database";
import type { Chat, MessageSender } from "@/types";

export interface LocalChatRow {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_email: string | null;
  participant_avatar: string | null;
  last_message_id: string | null;
  last_message_text: string | null;
  last_message_sender: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string | null;
}

export const upsertLocalChat = async (chat: Chat): Promise<void> => {
  if (!chat || !chat._id || !chat.participant) return;

  const chatId = String(chat._id);
  const participantId = String(
    typeof chat.participant._id === 'object'
      ? (chat.participant._id as any)?.toString?.() || ''
      : (chat.participant._id || '')
  );
  const participantName = String(chat.participant.name || 'Unknown User');
  const participantEmail = chat.participant.email ? String(chat.participant.email) : null;
  const participantAvatar = chat.participant.avatar ? String(chat.participant.avatar) : null;

  let lastMessageId: string | null = null;
  if (chat.lastMessage?._id) {
    lastMessageId = String(
      typeof chat.lastMessage._id === 'object'
        ? (chat.lastMessage._id as any)?.toString?.() || ''
        : chat.lastMessage._id
    );
  }

  const lastMessageText = typeof chat.lastMessage?.text === 'string' ? chat.lastMessage.text : null;

  let lastMessageSender: string | null = null;
  if (chat.lastMessage?.sender) {
    lastMessageSender = String(
      typeof chat.lastMessage.sender === 'object'
        ? (chat.lastMessage.sender as any)?._id?.toString?.() || ''
        : chat.lastMessage.sender
    );
  }

  const lastMessageAt = chat.lastMessageAt ? String(chat.lastMessageAt) : new Date().toISOString();
  const unreadCount = typeof chat.unreadCount === 'number' ? chat.unreadCount : 0;
  const createdAt = chat.createdAt ? String(chat.createdAt) : new Date().toISOString();

  await runWithDb(async (db) => {
    await db.runAsync(
      `INSERT INTO chats (
        id, participant_id, participant_name, participant_email, participant_avatar,
        last_message_id, last_message_text, last_message_sender, last_message_at,
        unread_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        participant_name = excluded.participant_name,
        participant_email = excluded.participant_email,
        participant_avatar = excluded.participant_avatar,
        last_message_id = COALESCE(excluded.last_message_id, chats.last_message_id),
        last_message_text = COALESCE(excluded.last_message_text, chats.last_message_text),
        last_message_sender = COALESCE(excluded.last_message_sender, chats.last_message_sender),
        last_message_at = COALESCE(excluded.last_message_at, chats.last_message_at),
        unread_count = excluded.unread_count,
        created_at = COALESCE(excluded.created_at, chats.created_at);`,
      [
        chatId,
        participantId,
        participantName,
        participantEmail,
        participantAvatar,
        lastMessageId,
        lastMessageText,
        lastMessageSender,
        lastMessageAt,
        unreadCount,
        createdAt,
      ]
    );
  });
};

export const getLocalChats = async (): Promise<Chat[]> => {
  return runWithDb(async (db) => {
    const rows = await db.getAllAsync<LocalChatRow>(
      "SELECT * FROM chats ORDER BY last_message_at DESC"
    );

    return rows.map((row) => ({
      _id: row.id,
      participant: {
        _id: row.participant_id,
        name: row.participant_name,
        email: row.participant_email || "",
        avatar: row.participant_avatar || "",
      },
      lastMessage: row.last_message_id
        ? {
            _id: row.last_message_id,
            text: row.last_message_text || "",
            sender: row.last_message_sender || "",
            createdAt: row.last_message_at || new Date().toISOString(),
          }
        : null,
      lastMessageAt: row.last_message_at || new Date().toISOString(),
      createdAt: row.created_at || new Date().toISOString(),
      unreadCount: row.unread_count,
    }));
  });
};

export const getLocalChatByParticipantId = async (participantId: string): Promise<Chat | null> => {
  return runWithDb(async (db) => {
    const row = await db.getFirstAsync<LocalChatRow>(
      "SELECT * FROM chats WHERE participant_id = ? LIMIT 1",
      [String(participantId)]
    );

    if (!row) return null;

    return {
      _id: row.id,
      participant: {
        _id: row.participant_id,
        name: row.participant_name,
        email: row.participant_email || "",
        avatar: row.participant_avatar || "",
      },
      lastMessage: row.last_message_id
        ? {
            _id: row.last_message_id,
            text: row.last_message_text || "",
            sender: row.last_message_sender || "",
            createdAt: row.last_message_at || new Date().toISOString(),
          }
        : null,
      lastMessageAt: row.last_message_at || new Date().toISOString(),
      createdAt: row.created_at || new Date().toISOString(),
      unreadCount: row.unread_count,
    };
  });
};


export const updateLocalChatLastMessage = async (
  chatId: string,
  lastMessage: { id: string; text: string; sender: any; createdAt: string },
  incrementUnread: boolean = false
): Promise<void> => {
  if (!chatId || !lastMessage) return;

  const safeChatId = String(chatId);
  const safeMessageId = lastMessage.id ? String(lastMessage.id) : null;
  const safeText = typeof lastMessage.text === 'string' ? lastMessage.text : null;
  const safeSender = lastMessage.sender
    ? String(typeof lastMessage.sender === 'object' ? (lastMessage.sender as any)?._id?.toString?.() || '' : lastMessage.sender)
    : null;
  const safeCreatedAt = lastMessage.createdAt ? String(lastMessage.createdAt) : new Date().toISOString();

  let query = `
    UPDATE chats 
    SET last_message_id = ?,
        last_message_text = ?,
        last_message_sender = ?,
        last_message_at = ?
  `;

  const params: (string | number | null)[] = [
    safeMessageId,
    safeText,
    safeSender,
    safeCreatedAt,
  ];

  if (incrementUnread) {
    query += `, unread_count = unread_count + 1`;
  }

  query += ` WHERE id = ?;`;
  params.push(safeChatId);

  await runWithDb(async (db) => {
    await db.runAsync(query, params);
  });
};

export const markLocalChatAsRead = async (chatId: string): Promise<void> => {
  await runWithDb(async (db) => {
    await db.runAsync("UPDATE chats SET unread_count = 0 WHERE id = ?;", [String(chatId)]);
  });
};

export const deleteLocalChat = async (chatId: string): Promise<void> => {
  await runWithDb(async (db) => {
    await db.runAsync("DELETE FROM chats WHERE id = ?;", [String(chatId)]);
  });
};

export const clearLocalChats = async (): Promise<void> => {
  await runWithDb(async (db) => {
    await db.runAsync("DELETE FROM chats;");
  });
};
