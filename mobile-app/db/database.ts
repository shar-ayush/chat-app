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
  if (version !== "2") {
    // One-time migration to reset the table for devices stuck on the old schema
    await db.execAsync("DROP TABLE IF EXISTS messages");
    await AsyncStorage.removeItem('lastSyncTimestamp');
    await AsyncStorage.setItem("db_version", "2");
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, /* localUUID */
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      cipher_text TEXT,
      nonce TEXT,
      sender_cipher_text TEXT,
      sender_nonce TEXT,
      sender_public_key TEXT,
      status TEXT NOT NULL, /* 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' */
      created_at INTEGER NOT NULL,
      server_id TEXT,
      retry_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_status ON messages(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);

  console.log('Database initialized successfully');
};
