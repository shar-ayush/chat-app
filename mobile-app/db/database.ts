import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
  if (dbInstance) return dbInstance;
  
  dbInstance = await SQLite.openDatabaseAsync('chat.db');
  return dbInstance;
};

import AsyncStorage from '@react-native-async-storage/async-storage';

export const initDb = async () => {
  const db = await getDb();
  
  const version = await AsyncStorage.getItem("db_version");
  if (version !== "3") {
    // Migration: drop old table, update version
    await db.execAsync("DROP TABLE IF EXISTS messages");
    await AsyncStorage.removeItem('lastSyncTimestamp');
    await AsyncStorage.setItem("db_version", "3");
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, /* localUUID */
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      type TEXT DEFAULT 'text', /* 'text' | 'file' */
      cipher_text TEXT,
      nonce TEXT,
      sender_cipher_text TEXT,
      sender_nonce TEXT,
      sender_public_key TEXT,
      file_url TEXT,
      file_name TEXT,
      mime_type TEXT,
      file_size INTEGER,
      local_uri TEXT,
      status TEXT NOT NULL, /* 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' */
      created_at INTEGER NOT NULL,
      server_id TEXT,
      retry_count INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      deleted_for TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_actions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_status ON messages(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);

  // Safety: add new columns on existing tables that may have skipped the migration
  // (e.g. hot-reload loaded old cached DB before migration ran).
  // ALTER TABLE ADD COLUMN is a no-op if the column already exists via try/catch.
  const newColumns: [string, string][] = [
    ["type", "TEXT DEFAULT 'text'"],
    ["file_url", "TEXT"],
    ["file_name", "TEXT"],
    ["mime_type", "TEXT"],
    ["file_size", "INTEGER"],
    ["local_uri", "TEXT"],
    ["is_deleted", "INTEGER DEFAULT 0"],
    ["deleted_at", "INTEGER"],
    ["deleted_for", "TEXT"],
  ];
  for (const [col, def] of newColumns) {
    try {
      await db.execAsync(`ALTER TABLE messages ADD COLUMN ${col} ${def};`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  console.log('Database initialized successfully');
};
