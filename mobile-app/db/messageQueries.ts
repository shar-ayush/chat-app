import { getDb } from './database';

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed';

export interface LocalMessage {
  id: string; // local UI UUID
  chat_id: string;
  sender_id: string;
  cipher_text: string | null;
  nonce: string | null;
  sender_cipher_text: string | null;
  sender_nonce: string | null;
  sender_public_key: string | null;
  status: MessageStatus;
  created_at: number; // timestamp
  server_id: string | null; // MongoDB _id
  retry_count: number;
}

export const insertMessage = async (msg: LocalMessage) => {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO messages (id, chat_id, sender_id, cipher_text, nonce, sender_cipher_text, sender_nonce, sender_public_key, status, created_at, server_id, retry_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, server_id = excluded.server_id, retry_count = excluded.retry_count",
    [
      msg.id, msg.chat_id, msg.sender_id, msg.cipher_text || null, msg.nonce || null, 
      msg.sender_cipher_text || null, msg.sender_nonce || null, msg.sender_public_key || null, 
      msg.status, msg.created_at, msg.server_id || null, msg.retry_count || 0
    ]
  );
};

export const updateMessageStatus = async (
  id: string, 
  status: MessageStatus, 
  serverId?: string,
  incrementRetry?: boolean
) => {
  const db = await getDb();
  let query = "UPDATE messages SET status = ?";
  const params: any[] = [status];

  if (serverId) {
    query += ", server_id = ?";
    params.push(serverId);
  }

  if (incrementRetry) {
    query += ", retry_count = retry_count + 1";
  }

  query += " WHERE id = ?";
  params.push(id);

  await db.runAsync(query, params);
};

export const getOldestPendingMessage = async (): Promise<LocalMessage | null> => {
  const db = await getDb();
  return await db.getFirstAsync<LocalMessage>(
    "SELECT * FROM messages WHERE status IN ('pending', 'sending') ORDER BY created_at ASC LIMIT 1"
  );
};

export const getMessagesByChatId = async (chatId: string): Promise<LocalMessage[]> => {
  const db = await getDb();
  return await db.getAllAsync<LocalMessage>(
    "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
    [chatId]
  );
};

export const resetSendingToPending = async () => {
  const db = await getDb();
  await db.runAsync("UPDATE messages SET status = 'pending' WHERE status = 'sending';");
};

export const markMessageAsFailed = async (id: string) => {
  await updateMessageStatus(id, 'failed');
};

export const checkMessageExistsByServerId = async (serverId: string): Promise<boolean> => {
  const db = await getDb();
  const result = await db.getFirstAsync<{ count: number }>(
    "SELECT count(*) as count FROM messages WHERE server_id = ?",
    [serverId]
  );
  return (result?.count || 0) > 0;
};
