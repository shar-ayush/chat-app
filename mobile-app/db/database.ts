import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('chat.db');
  }
  return dbPromise;
};

// Global serial execution queue to eliminate concurrent prepareAsync/runAsync race conditions in expo-sqlite on Android
let queryQueue = Promise.resolve<any>(undefined);

export const runWithDb = async <T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> => {
  const db = await getDb();
  return new Promise<T>((resolve, reject) => {
    queryQueue = queryQueue
      .catch(() => {}) // never let a previous query failure block subsequent queries
      .then(async () => {
        try {
          const result = await operation(db);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
  });
};

export const initDb = async () => {
  return runWithDb(async (db) => {
    const version = await AsyncStorage.getItem("db_version");
    if (version !== "4") {
      // Migration: drop stale local tables, reset sync timestamp
      await db.execAsync("DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS chats;");
      await AsyncStorage.removeItem('lastSyncTimestamp');
      await AsyncStorage.setItem("db_version", "4");
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

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      participant_name TEXT NOT NULL,
      participant_email TEXT,
      participant_avatar TEXT,
      last_message_id TEXT,
      last_message_text TEXT,
      last_message_sender TEXT,
      last_message_at TEXT,
      unread_count INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS friends (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      avatar TEXT,
      email TEXT,
      public_key TEXT,
      friendship_id TEXT,
      since TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_status ON messages(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at);
    CREATE INDEX IF NOT EXISTS idx_friends_id ON friends(id);
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
    ["is_read", "INTEGER DEFAULT 0"],
  ];
  for (const [col, def] of newColumns) {
    try {
      await db.execAsync(`ALTER TABLE messages ADD COLUMN ${col} ${def};`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  console.log('Database initialized successfully');
  });
};
