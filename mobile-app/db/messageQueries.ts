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
  
  const safeCreatedAt = (typeof msg.created_at !== 'number' || Number.isNaN(msg.created_at)) ? Date.now() : msg.created_at;

  await db.runAsync(
    "INSERT INTO messages (id, chat_id, sender_id, cipher_text, nonce, sender_cipher_text, sender_nonce, sender_public_key, status, created_at, server_id, retry_count) VALUES ($id, $chat_id, $sender_id, $cipher_text, $nonce, $sender_cipher_text, $sender_nonce, $sender_public_key, $status, $created_at, $server_id, $retry_count) ON CONFLICT(id) DO UPDATE SET status = excluded.status, server_id = excluded.server_id, retry_count = excluded.retry_count",
    {
      $id: msg.id || "temp-id-fallback",
      $chat_id: msg.chat_id || "unknown_chat",
      $sender_id: msg.sender_id || "unknown_sender",
      $cipher_text: msg.cipher_text ?? "",
      $nonce: msg.nonce ?? "",
      $sender_cipher_text: msg.sender_cipher_text ?? "",
      $sender_nonce: msg.sender_nonce ?? "",
      $sender_public_key: msg.sender_public_key ?? "",
      $status: msg.status || 'pending',
      $created_at: safeCreatedAt,
      $server_id: msg.server_id ?? "",
      $retry_count: msg.retry_count ?? 0
    }
  );
};

export const updateMessageStatus = async (
  id: string, 
  status: MessageStatus, 
  serverId?: string,
  incrementRetry?: boolean
) => {
  const db = await getDb();
  let query = "UPDATE messages SET status = $status";
  const params: Record<string, any> = { $status: status, $id: id };

  if (serverId) {
    query += ", server_id = $server_id";
    params.$server_id = serverId;
  }

  if (incrementRetry) {
    query += ", retry_count = retry_count + 1";
  }

  query += " WHERE id = $id";

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
    "SELECT * FROM messages WHERE chat_id = $chatId ORDER BY created_at ASC",
    { $chatId: chatId }
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
    "SELECT count(*) as count FROM messages WHERE server_id = $serverId",
    { $serverId: serverId }
  );
  return (result?.count || 0) > 0;
};
