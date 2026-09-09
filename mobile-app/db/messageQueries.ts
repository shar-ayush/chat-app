import { runWithDb } from './database';

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
  const safeCreatedAt = (typeof msg.created_at !== 'number' || Number.isNaN(msg.created_at)) ? Date.now() : msg.created_at;

  const params: (string | number | null)[] = [
    String(msg.id || "temp-id-fallback"),
    String(msg.chat_id || "unknown_chat"),
    String(msg.sender_id || "unknown_sender"),
    String(msg.type ?? 'text'),
    msg.cipher_text ? String(msg.cipher_text) : "",
    msg.nonce ? String(msg.nonce) : "",
    msg.sender_cipher_text ? String(msg.sender_cipher_text) : "",
    msg.sender_nonce ? String(msg.sender_nonce) : "",
    msg.sender_public_key ? String(msg.sender_public_key) : "",
    msg.file_url ? String(msg.file_url) : null,
    msg.file_name ? String(msg.file_name) : null,
    msg.mime_type ? String(msg.mime_type) : null,
    typeof msg.file_size === 'number' ? msg.file_size : null,
    msg.local_uri ? String(msg.local_uri) : null,
    String(msg.status || 'pending'),
    safeCreatedAt,
    msg.server_id ? String(msg.server_id) : "",
    typeof msg.retry_count === 'number' ? msg.retry_count : 0,
    msg.is_deleted ? 1 : 0,
    typeof msg.deleted_at === 'number' ? msg.deleted_at : null,
    msg.deleted_for ? String(msg.deleted_for) : null,
  ];

  await runWithDb(async (db) => {
    await db.runAsync(
      `INSERT INTO messages (
         id, chat_id, sender_id, type,
         cipher_text, nonce, sender_cipher_text, sender_nonce, sender_public_key,
         file_url, file_name, mime_type, file_size, local_uri,
         status, created_at, server_id, retry_count,
         is_deleted, deleted_at, deleted_for
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         server_id = excluded.server_id,
         retry_count = excluded.retry_count,
         local_uri = excluded.local_uri,
         is_deleted = excluded.is_deleted,
         deleted_at = excluded.deleted_at,
         deleted_for = excluded.deleted_for;`,
      params
    );
  });
};

export const updateMessageStatus = async (
  id: string, 
  status: MessageStatus, 
  serverId?: string,
  incrementRetry?: boolean
) => {
  const safeId = String(id);
  const safeStatus = String(status);
  let query = "UPDATE messages SET status = ?";
  const params: (string | number | null)[] = [safeStatus];

  if (serverId) {
    query += ", server_id = ?";
    params.push(String(serverId));
  }

  if (incrementRetry) {
    query += ", retry_count = retry_count + 1";
  }

  query += " WHERE id = ?;";
  params.push(safeId);

  await runWithDb(async (db) => {
    await db.runAsync(query, params);
  });
};

export const getOldestPendingMessage = async (): Promise<LocalMessage | null> => {
  return runWithDb(async (db) => {
    return await db.getFirstAsync<LocalMessage>(
      "SELECT * FROM messages WHERE status IN ('pending', 'sending') ORDER BY created_at ASC LIMIT 1"
    );
  });
};

export const getMessagesByChatId = async (chatId: string): Promise<LocalMessage[]> => {
  return runWithDb(async (db) => {
    return await db.getAllAsync<LocalMessage>(
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
      [String(chatId)]
    );
  });
};

export const resetSendingToPending = async () => {
  await runWithDb(async (db) => {
    await db.runAsync("UPDATE messages SET status = 'pending' WHERE status = 'sending';");
  });
};

export const markMessageAsFailed = async (id: string) => {
  await updateMessageStatus(id, 'failed');
};

export const checkMessageExistsByServerId = async (serverId: string): Promise<boolean> => {
  return runWithDb(async (db) => {
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM messages WHERE server_id = ?",
      [String(serverId)]
    );
    return (result?.count || 0) > 0;
  });
};

// ── Pending Actions & Deletions ──────────────────────────────────────────────

export interface PendingAction {
  id: string;
  type: 'delete_for_me' | 'delete_for_everyone';
  payload: string; // JSON string
  created_at: number;
}

export const insertPendingAction = async (action: PendingAction) => {
  await runWithDb(async (db) => {
    await db.runAsync(
      "INSERT INTO pending_actions (id, type, payload, created_at) VALUES (?, ?, ?, ?)",
      [String(action.id), String(action.type), String(action.payload), Number(action.created_at) || Date.now()]
    );
  });
};

export const getPendingActions = async (): Promise<PendingAction[]> => {
  return runWithDb(async (db) => {
    return await db.getAllAsync<PendingAction>(
      "SELECT * FROM pending_actions ORDER BY created_at ASC"
    );
  });
};

export const deletePendingAction = async (id: string) => {
  await runWithDb(async (db) => {
    await db.runAsync("DELETE FROM pending_actions WHERE id = ?", [String(id)]);
  });
};

export const markMessagesDeletedForMeLocal = async (messageIds: string[], userId: string) => {
  await runWithDb(async (db) => {
    for (const id of messageIds) {
      const msg = await db.getFirstAsync<{ deleted_for: string }>(
        "SELECT deleted_for FROM messages WHERE id = ? OR server_id = ?", 
        [String(id), String(id)]
      );
      if (msg) {
        let arr: string[] = [];
        try { arr = JSON.parse(msg.deleted_for || "[]"); } catch (e) {}
        if (!arr.includes(userId)) {
          arr.push(userId);
          await db.runAsync(
            "UPDATE messages SET deleted_for = ? WHERE id = ? OR server_id = ?", 
            [JSON.stringify(arr), String(id), String(id)]
          );
        }
      }
    }
  });
};

export const markMessagesDeletedForEveryoneLocal = async (messageIds: string[]) => {
  await runWithDb(async (db) => {
    for (const id of messageIds) {
      await db.runAsync(
        "UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE id = ? OR server_id = ?",
        [Date.now(), String(id), String(id)]
      );
    }
  });
};

