import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { QueryClient } from "@tanstack/react-query";
import { Chat, Message, MessageSender, User } from "@/types";
import { encryptMessage, decryptMessage, selectEncryptedPayloadForUser } from "@/crypto/messageCrypto";

// const SOCKET_URL = "https://chat-app-muyj.onrender.com";
const SOCKET_URL = "http://172.16.213.18:3000";

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

    socket.on("connect", () => {
      console.log("Socket connected, id:", socket.id);
      set({ isConnected: true });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnect", socket.id);
      set({ isConnected: false });
    });

    socket.on("online-users", ({ userIds }: { userIds: string[] }) => {
      console.log("Received online-users:", userIds);
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

    socket.on("socket-error", (error: { message: string }) => {
      console.error("Socket error:", error.message);
    });

    socket.on("new-message", async (message: Message) => {
      const senderId = (message.sender as MessageSender)._id;
      const { currentChatId } = get();
      const currentUser = queryClient.getQueryData<User>(["currentUser"]);

      // Decrypt the message if it has an encrypted payload
      let displayMessage = message;
      const payload = selectEncryptedPayloadForUser(message, currentUser?._id);
      if (payload && message.senderPublicKey) {
        try {
          const plaintext = await decryptMessage({
            ciphertext: payload.ciphertext,
            nonce: payload.nonce,
            senderPublicKey: message.senderPublicKey,
          });
          displayMessage = { ...message, text: plaintext };
        } catch (e) {
          console.warn("Failed to decrypt incoming message:", e);
          displayMessage = { ...message, text: "[Encrypted message]" };
        }
      }

      // add message to the chat's message list, replacing optimistic messages
      queryClient.setQueryData<Message[]>(["messages", message.chat], (old) => {
        if (!old) return [displayMessage];
        // remove any optimistic messages (temp IDs) and add the real one
        const filtered = old.filter((m) => !m._id.startsWith("temp-"));
        if (filtered.some((m) => m._id === message._id)) return filtered;
        return [...filtered, displayMessage];
      });

      // Update chat's lastMessage directly for instant UI update.
      // If the message is from the other participant and this chat isn't open,
      // increment unreadCount exactly once per real message id.
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
                text: displayMessage.text,
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
  sendMessage: async (chatId, text, currentUser, recipientPublicKey) => {
    const { socket, queryClient } = get();
    if (!socket?.connected || !queryClient) return;

    // optimistic update — show plaintext immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      chat: chatId,
      sender: currentUser,
      text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
      if (!old) return [optimisticMessage];
      return [...old, optimisticMessage];
    });

    try {
      // Encrypt before sending — server never sees plaintext
      const { ciphertext, nonce, senderCiphertext, senderNonce, senderPublicKey } = await encryptMessage(
        text,
        recipientPublicKey
      );
      socket.emit("send-message", {
        chatId,
        ciphertext,
        nonce,
        senderCiphertext,
        senderNonce,
        senderPublicKey,
      });
    } catch (e) {
      console.error("Encryption failed:", e);
      // Roll back optimistic message on encryption failure
      queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
        if (!old) return [];
        return old.filter((m) => m._id !== tempId);
      });
      return;
    }

    const errorHandler = (error: { message: string }) => {
      queryClient.setQueryData<Message[]>(["messages", chatId], (old) => {
        if (!old) return [];
        return old.filter((m) => m._id !== tempId);
      });
      socket.off("socket-error", errorHandler);
    };

    socket.once("socket-error", errorHandler);
  },

  sendTyping: (chatId, isTyping) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit("typing", { chatId, isTyping });
    }
  },
}));
