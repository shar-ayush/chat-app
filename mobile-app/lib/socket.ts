import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { QueryClient } from "@tanstack/react-query";
import { Chat, MessageSender, User } from "@/types";
import { encryptMessage, decryptMessage } from "@/crypto/messageCrypto";
import * as Crypto from 'expo-crypto';
import { insertMessage } from "../db/messageQueries";
import { triggerSync } from "./syncEngine";
import { getDb } from "../db/database";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SOCKET_URL = "https://chat-app-muyj.onrender.com";
// export const SOCKET_URL = "http://172.16.216.225:3000";

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  typingUsers: Map<string, string>; // chatId -> userId
  unreadChats: Set<string>;
  currentChatId: string | null;
  queryClient: QueryClient | null;

  connect: (token: string, queryClient: QueryClient) => void;
  disconnect: () => void;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  sendMessage: (chatId: string, text: string, currentUser: MessageSender, recipientPublicKey: string) => Promise<void>;
  sendFileMessage: (chatId: string, filePayload: { fileUrl: string; fileName: string; mimeType: string; fileSize: number }, currentUser: MessageSender) => Promise<void>;
  sendTyping: (chatId: string, isTyping: boolean) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  typingUsers: new Map(),
  unreadChats: new Set(),
  currentChatId: null,
  queryClient: null,

  connect: (token, queryClient) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    if (existingSocket) existingSocket.disconnect();

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on("connect", async () => {
      console.log("Socket connected, id:", socket.id);
      set({ isConnected: true });
      triggerSync(); // start syncing pending messages when reconnected

      try {
        // Pull Sync Missed Messages
        const after = await AsyncStorage.getItem('lastSyncTimestamp') || "0";

        const response = await fetch(`${SOCKET_URL}/api/messages/sync?after=${after}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const missedMessages = await response.json();
          console.log(`PULL SYNC: Fetched ${missedMessages.length} missed messages from backend since ${after}`);
          let syncedCount = 0;
          for (const msg of missedMessages) {
            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            await insertMessage({
              id: msg.localId || Crypto.randomUUID(),
              chat_id: msg.chat,
              sender_id: senderId,
              type: msg.type ?? 'text',
              cipher_text: msg.ciphertext,
              nonce: msg.nonce,
              sender_cipher_text: msg.senderCiphertext,
              sender_nonce: msg.senderNonce,
              sender_public_key: msg.senderPublicKey,
              file_url: msg.fileUrl ?? null,
              file_name: msg.fileName ?? null,
              mime_type: msg.mimeType ?? null,
              file_size: msg.fileSize ?? null,
              local_uri: null,
              status: 'delivered',
              created_at: new Date(msg.createdAt).getTime(),
              server_id: msg._id,
              retry_count: 0
            });
            syncedCount++;
          }
          if (syncedCount > 0) {
            queryClient.invalidateQueries({ queryKey: ["messages"] });
            queryClient.invalidateQueries({ queryKey: ["chats"] });
          }

          await AsyncStorage.setItem('lastSyncTimestamp', Date.now().toString());
        } else {
          console.error("PULL SYNC FAILED:", response.status, await response.text());
        }
      } catch (err) {
        console.error("Failed to pull sync messages:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnect", socket.id);
      set({ isConnected: false });
    });

    socket.on("online-users", ({ userIds }: { userIds: string[] }) => {
      set({ onlineUsers: new Set(userIds) });
    });

    socket.on("user-online", ({ userId }: { userId: string }) => {
      set((state) => ({
        onlineUsers: new Set([...state.onlineUsers, userId]),
      }));
    });

    socket.on("user-offline", ({ userId }: { userId: string }) => {
      set((state) => {
        const onlineUsers = new Set(state.onlineUsers);
        onlineUsers.delete(userId);
        return { onlineUsers: onlineUsers };
      });
    });

    socket.on("socket-error", (error: { message: string, localId?: string }) => {
      console.error("Socket error:", error.message, "localId:", error.localId);
    });

    socket.on("receive_message", async (message: any) => {
      const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
      const { currentChatId } = get();

      // Ensure it goes into SQLite as delivered
      await insertMessage({
        id: message.localId || Crypto.randomUUID(),
        chat_id: message.chat,
        sender_id: senderId,
        type: message.type ?? 'text',
        cipher_text: message.ciphertext,
        nonce: message.nonce,
        sender_cipher_text: message.senderCiphertext,
        sender_nonce: message.senderNonce,
        sender_public_key: message.senderPublicKey,
        file_url: message.fileUrl ?? null,
        file_name: message.fileName ?? null,
        mime_type: message.mimeType ?? null,
        file_size: message.fileSize ?? null,
        local_uri: null,
        status: 'delivered',
        created_at: new Date(message.createdAt).getTime(),
        server_id: message._id,
        retry_count: 0
      });

      // Force UI to pick up new SQLite message
      queryClient.invalidateQueries({ queryKey: ["messages", message.chat] });

      await AsyncStorage.setItem('lastSyncTimestamp', Date.now().toString());

      // Determine preview text
      let plaintext = "[Encrypted Message]";
      if (message.type === 'file') {
        // For file messages use the file name as preview
        plaintext = message.fileName ?? "📎 File";
      } else {
        try {
          const payload = {
            ciphertext: message.ciphertext,
            nonce: message.nonce,
            senderPublicKey: message.senderPublicKey,
          };
          if (payload.ciphertext && payload.nonce && payload.senderPublicKey) {
            plaintext = await decryptMessage(payload);
          }
        } catch (e) {
          console.warn("Decrypt error in socket:", e);
        }
      }

      // Update chat's lastMessage directly for instant UI update.
      queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
        return oldChats?.map((chat) => {
          if (chat._id === message.chat) {
            const alreadyProcessed = chat.lastMessage?._id === message._id;
            const isFromParticipant = chat.participant && senderId === chat.participant._id;
            const shouldIncrementUnread = !alreadyProcessed && currentChatId !== message.chat && isFromParticipant;

            return {
              ...chat,
              lastMessage: {
                _id: message._id,
                text: plaintext,
                sender: senderId,
                createdAt: message.createdAt,
              },
              lastMessageAt: message.createdAt,
              unreadCount: shouldIncrementUnread ? (chat.unreadCount ?? 0) + 1 : chat.unreadCount,
            };
          }
          return chat;
        });
      });

      // mark as unread if not currently viewing this chat and message is from other user
      if (currentChatId !== message.chat) {
        const chats = queryClient.getQueryData<Chat[]>(["chats"]);
        const chat = chats?.find((c) => c._id === message.chat);
        if (chat?.participant && senderId === chat.participant._id) {
          set((state) => ({
            unreadChats: new Set([...state.unreadChats, message.chat]),
          }));
        }
      }

      // clear typing indicator when message received
      set((state) => {
        const typingUsers = new Map(state.typingUsers);
        typingUsers.delete(message.chat);
        return { typingUsers: typingUsers };
      });
    });

    // Handle new-message from sender's perspective (when sender makes request from another device, etc)
    socket.on("new-message", async (message: any) => {
      // Just forward to receive_message logic
      socket.emit("receive_message", message);
    });

    socket.on(
      "typing",
      ({ userId, chatId, isTyping }: { userId: string; chatId: string; isTyping: boolean }) => {
        set((state) => {
          const typingUsers = new Map(state.typingUsers);
          if (isTyping) typingUsers.set(chatId, userId);
          else typingUsers.delete(chatId);

          return { typingUsers: typingUsers };
        });
      }
    );

    set({ socket, queryClient });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({
        socket: null,
        isConnected: false,
        onlineUsers: new Set(),
        typingUsers: new Map(),
        unreadChats: new Set(),
        currentChatId: null,
        queryClient: null,
      });
    }
  },
  joinChat: (chatId) => {
    const socket = get().socket;
    set((state) => {
      const unreadChats = new Set(state.unreadChats);
      unreadChats.delete(chatId);
      return { currentChatId: chatId, unreadChats: unreadChats };
    });

    if (socket?.connected) {
      socket.emit("join-chat", chatId);
    }
  },
  leaveChat: (chatId) => {
    const { socket } = get();
    set({ currentChatId: null });
    if (socket?.connected) {
      socket.emit("leave-chat", chatId);
    }
  },
  sendFileMessage: async (chatId, filePayload, currentUser) => {
    const { socket, queryClient } = get();
    if (!queryClient) return;

    const localId = Crypto.randomUUID();

    try {
      // Insert directly to SQLite as a delivered file message (already uploaded)
      await insertMessage({
        id: localId,
        chat_id: chatId,
        sender_id: currentUser._id,
        type: 'file',
        cipher_text: null,
        nonce: null,
        sender_cipher_text: null,
        sender_nonce: null,
        sender_public_key: null,
        file_url: filePayload.fileUrl,
        file_name: filePayload.fileName,
        mime_type: filePayload.mimeType,
        file_size: filePayload.fileSize,
        local_uri: null,
        status: 'sent',
        created_at: Date.now(),
        server_id: null,
        retry_count: 0,
      });

      // Force UI to pick up immediately
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });

      // Update chat's lastMessage for home screen
      queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
        return oldChats?.map((chat) => {
          if (chat._id === chatId) {
            return {
              ...chat,
              lastMessage: {
                _id: localId,
                text: "",
                fileName: filePayload.fileName,
                sender: currentUser._id,
                createdAt: new Date().toISOString(),
              },
              lastMessageAt: new Date().toISOString(),
            };
          }
          return chat;
        });
      });

      // Emit via socket (backend stores only metadata, no re-upload)
      if (socket?.connected) {
        socket.emit("send-message", {
          localId,
          chatId,
          filePayload,
        });
      }
    } catch (e) {
      console.error("File message send fail:", e);
    }
  },

  sendMessage: async (chatId, text, currentUser, recipientPublicKey) => {
    const { queryClient } = get();
    if (!queryClient) return;

    const localId = Crypto.randomUUID();

    try {
      // Encrypt before saving locally
      const { ciphertext, nonce, senderCiphertext, senderNonce, senderPublicKey } = await encryptMessage(
        text,
        recipientPublicKey
      );

      // Insert directly to SQLite as pending
      await insertMessage({
        id: localId,
        chat_id: chatId,
        sender_id: currentUser._id,
        cipher_text: ciphertext,
        nonce,
        sender_cipher_text: senderCiphertext,
        sender_nonce: senderNonce,
        sender_public_key: senderPublicKey,
        status: 'pending',
        created_at: Date.now(),
        server_id: null,
        retry_count: 0
      });

      // Force UI to pick up new SQLite message immediately
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });

      // Update chat's lastMessage directly for instant UI update.
      queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
        return oldChats?.map((chat) => {
          if (chat._id === chatId) {
            return {
              ...chat,
              lastMessage: {
                _id: localId,
                text: text,
                sender: currentUser._id,
                createdAt: new Date().toISOString(),
              },
              lastMessageAt: new Date().toISOString(),
            };
          }
          return chat;
        });
      });

      // Trigger sync engine to push to backend
      triggerSync();

    } catch (e) {
      console.error("Encryption/Save fail:", e);
    }
  },

  sendTyping: (chatId, isTyping) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit("typing", { chatId, isTyping });
    }
  },
}));
