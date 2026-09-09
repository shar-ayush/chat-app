import { getDb } from "./database";
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
  const db = await getDb();
  if (!chat || !chat._id || !chat.participant) return;

  await db.runAsync(
    `INSERT INTO chats (
      id, participant_id, participant_name, participant_email, participant_avatar,
      last_message_id, last_message_text, last_message_sender, last_message_at,
      unread_count, created_at
    ) VALUES (
      $id, $participant_id, $participant_name, $participant_email, $participant_avatar,
      $last_message_id, $last_message_text, $last_message_sender, $last_message_at,
      $unread_count, $created_at
    ) ON CONFLICT(id) DO UPDATE SET
      participant_name = excluded.participant_name,
      participant_email = excluded.participant_email,
      participant_avatar = excluded.participant_avatar,
      last_message_id = COALESCE(excluded.last_message_id, chats.last_message_id),
      last_message_text = COALESCE(excluded.last_message_text, chats.last_message_text),
      last_message_sender = COALESCE(excluded.last_message_sender, chats.last_message_sender),
      last_message_at = COALESCE(excluded.last_message_at, chats.last_message_at),
      unread_count = excluded.unread_count,
      created_at = COALESCE(excluded.created_at, chats.created_at);`,
    {
      $id: chat._id,
      $participant_id: chat.participant._id,
      $participant_name: chat.participant.name || "Unknown User",
      $participant_email: chat.participant.email || null,
      $participant_avatar: chat.participant.avatar || null,
      $last_message_id: chat.lastMessage?._id || null,
      $last_message_text: chat.lastMessage?.text || null,
      $last_message_sender: chat.lastMessage?.sender || null,
      $last_message_at: chat.lastMessageAt || new Date().toISOString(),
      $unread_count: chat.unreadCount ?? 0,
      $created_at: chat.createdAt || new Date().toISOString(),
    }
  );
};

export const getLocalChats = async (): Promise<Chat[]> => {
  const db = await getDb();
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
};

export const updateLocalChatLastMessage = async (
  chatId: string,
  lastMessage: { id: string; text: string; sender: string; createdAt: string },
  incrementUnread: boolean = false
): Promise<void> => {
  const db = await getDb();
  let query = `
    UPDATE chats 
    SET last_message_id = $last_message_id,
        last_message_text = $last_message_text,
        last_message_sender = $last_message_sender,
        last_message_at = $last_message_at
  `;

  if (incrementUnread) {
    query += `, unread_count = unread_count + 1`;
  }

  query += ` WHERE id = $id;`;

  await db.runAsync(query, {
    $id: chatId,
    $last_message_id: lastMessage.id,
    $last_message_text: lastMessage.text,
    $last_message_sender: lastMessage.sender,
    $last_message_at: lastMessage.createdAt,
  });
};

export const markLocalChatAsRead = async (chatId: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync("UPDATE chats SET unread_count = 0 WHERE id = $id;", {
    $id: chatId,
  });
};

export const deleteLocalChat = async (chatId: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync("DELETE FROM chats WHERE id = $id;", { $id: chatId });
};

export const clearLocalChats = async (): Promise<void> => {
  const db = await getDb();
  await db.runAsync("DELETE FROM chats;");
};
