import { getDb } from './database';

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed';

export interface LocalMessage {
  id: string; // local UI UUID
  chat_id: string;
  sender_id: string;
  type?: 'text' | 'file';
  cipher_text: string | null;
  nonce: string | null;
  sender_cipher_text: string | null;
  sender_nonce: string | null;
  sender_public_key: string | null;
  // File fields
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  local_uri?: string | null;
  status: MessageStatus;
  created_at: number; // timestamp
  server_id: string | null; // MongoDB _id
  retry_count: number;
  is_deleted?: number; 
  deleted_at?: number | null;
  deleted_for?: string | null; // stringified JSON array
}

export const insertMessage = async (msg: LocalMessage) => {
  const db = await getDb();
  
  const safeCreatedAt = (typeof msg.created_at !== 'number' || Number.isNaN(msg.created_at)) ? Date.now() : msg.created_at;

  await db.runAsync(
    `INSERT INTO messages (
       id, chat_id, sender_id, type,
       cipher_text, nonce, sender_cipher_text, sender_nonce, sender_public_key,
       file_url, file_name, mime_type, file_size, local_uri,
       status, created_at, server_id, retry_count,
       is_deleted, deleted_at, deleted_for
     ) VALUES (
       $id, $chat_id, $sender_id, $type,
       $cipher_text, $nonce, $sender_cipher_text, $sender_nonce, $sender_public_key,
       $file_url, $file_name, $mime_type, $file_size, $local_uri,
       $status, $created_at, $server_id, $retry_count,
       $is_deleted, $deleted_at, $deleted_for
     ) ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       server_id = excluded.server_id,
       retry_count = excluded.retry_count,
       local_uri = excluded.local_uri,
       is_deleted = excluded.is_deleted,
       deleted_at = excluded.deleted_at,
       deleted_for = excluded.deleted_for`,
    {
      $id: msg.id || "temp-id-fallback",
      $chat_id: msg.chat_id || "unknown_chat",
      $sender_id: msg.sender_id || "unknown_sender",
      $type: msg.type ?? 'text',
      $cipher_text: msg.cipher_text ?? "",
      $nonce: msg.nonce ?? "",
      $sender_cipher_text: msg.sender_cipher_text ?? "",
      $sender_nonce: msg.sender_nonce ?? "",
      $sender_public_key: msg.sender_public_key ?? "",
      $file_url: msg.file_url ?? null,
      $file_name: msg.file_name ?? null,
      $mime_type: msg.mime_type ?? null,
      $file_size: msg.file_size ?? null,
      $local_uri: msg.local_uri ?? null,
      $status: msg.status || 'pending',
      $created_at: safeCreatedAt,
      $server_id: msg.server_id ?? "",
      $retry_count: msg.retry_count ?? 0,
      $is_deleted: msg.is_deleted ?? 0,
      $deleted_at: msg.deleted_at ?? null,
      $deleted_for: msg.deleted_for ?? null
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

// ── Pending Actions & Deletions ──────────────────────────────────────────────

export interface PendingAction {
  id: string;
  type: 'delete_for_me' | 'delete_for_everyone';
  payload: string; // JSON string
  created_at: number;
}

export const insertPendingAction = async (action: PendingAction) => {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO pending_actions (id, type, payload, created_at) VALUES ($id, $type, $payload, $created_at)",
    {
      $id: action.id,
      $type: action.type,
      $payload: action.payload,
      $created_at: action.created_at
    }
  );
};

export const getPendingActions = async (): Promise<PendingAction[]> => {
  const db = await getDb();
  return await db.getAllAsync<PendingAction>(
    "SELECT * FROM pending_actions ORDER BY created_at ASC"
  );
};

export const deletePendingAction = async (id: string) => {
  const db = await getDb();
  await db.runAsync("DELETE FROM pending_actions WHERE id = $id", { $id: id });
};

export const markMessagesDeletedForMeLocal = async (messageIds: string[], userId: string) => {
  const db = await getDb();
  // Since deleted_for is a stringified JSON array, if it's null we set it to single item array, else we parse and append in application logic or we can write a simple replace approach.
  // SQLite doesn't easily JSON append, so we select, update, and save.
  for (const id of messageIds) {
    const msg = await db.getFirstAsync<{ deleted_for: string }>(
      "SELECT deleted_for FROM messages WHERE id = $id OR server_id = $id", 
      { $id: id }
    );
    if (msg) {
      let arr: string[] = [];
      try { arr = JSON.parse(msg.deleted_for || "[]"); } catch (e) {}
      if (!arr.includes(userId)) {
        arr.push(userId);
        await db.runAsync(
          "UPDATE messages SET deleted_for = $deleted_for WHERE id = $id OR server_id = $id", 
          {
            $deleted_for: JSON.stringify(arr),
            $id: id
          }
        );
      }
    }
  }
};

export const markMessagesDeletedForEveryoneLocal = async (messageIds: string[]) => {
  const db = await getDb();
  for (const id of messageIds) {
    await db.runAsync(
      "UPDATE messages SET is_deleted = 1, deleted_at = $deleted_at WHERE id = $id OR server_id = $id",
      { $deleted_at: Date.now(), $id: id }
    );
  }
};
