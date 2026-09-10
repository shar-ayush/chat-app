import { useApi } from "@/lib/axios";
import type { Chat } from "@/types";
import { decryptMessage, selectEncryptedPayloadForUser } from "@/crypto/messageCrypto";
import { useCurrentUser } from "./useAuth";
import { getLocalChats, upsertLocalChat, getLocalChatByParticipantId } from "../db/chatQueries";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useChats = () => {
  const { apiWithAuth } = useApi();
  const { data: currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ["chats"],
    queryFn: async (): Promise<Chat[]> => {
      try {
        const { data } = await apiWithAuth<Chat[]>({ method: "GET", url: "/chats", timeout: 7000 });
        
        const decryptedChats = await Promise.all(
          data.map(async (chat) => {
            const payload = chat.lastMessage
              ? selectEncryptedPayloadForUser(chat.lastMessage, currentUser?._id)
              : null;

            let text = chat.lastMessage?.text || "";
            if (payload && chat.lastMessage?.senderPublicKey) {
              try {
                text = await decryptMessage({
                  ciphertext: payload.ciphertext,
                  nonce: payload.nonce,
                  senderPublicKey: chat.lastMessage.senderPublicKey,
                }, currentUser?._id);
              } catch (err: any) {
                console.error("[useChats] Decryption failed for chat:", chat._id, "error:", err?.message);
                text = "[Encrypted message]";
              }
            } else if (chat.lastMessage && !chat.lastMessage.text) {
              console.warn("[useChats] Missing payload or senderPublicKey for chat:", chat._id, {
                hasPayload: !!payload,
                hasSenderPubKey: !!chat.lastMessage?.senderPublicKey,
              });
            }

            const formattedChat = {
              ...chat,
              lastMessage: chat.lastMessage
                ? ({ ...chat.lastMessage, text } as typeof chat.lastMessage)
                : null,
            };

            return formattedChat;
          })
        );

        // Cache to local SQLite sequentially in background for offline cold boot
        (async () => {
          for (const c of decryptedChats) {
            try {
              await upsertLocalChat(c);
            } catch (err) {
              console.warn("Failed to cache chat in SQLite:", err);
            }
          }
        })();

        return decryptedChats;
      } catch (networkError) {
        console.log("Offline mode: loading chats from local SQLite...");
        const localChats = await getLocalChats();
        return localChats || [];
      }
    },
    enabled: !!currentUser,
    staleTime: 5000, // 5 seconds so returning to home screen or reopening app refreshes unread count from server
  });
};

export const useGetOrCreateChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async (participantId: string): Promise<Chat> => {
      try {
        const { data } = await apiWithAuth<Chat>({
          method: "POST",
          url: `/chats/with/${participantId}`,
          timeout: 7000,
        });
        
        let chat = data;
        const payload = chat.lastMessage
          ? selectEncryptedPayloadForUser(chat.lastMessage, currentUser?._id)
          : null;

        if (payload && chat.lastMessage?.senderPublicKey) {
          try {
            const plaintext = await decryptMessage({
              ciphertext: payload.ciphertext,
              nonce: payload.nonce,
              senderPublicKey: chat.lastMessage.senderPublicKey,
            });
            chat = { ...chat, lastMessage: { ...chat.lastMessage, text: plaintext } as typeof chat.lastMessage };
          } catch {
            chat = { ...chat, lastMessage: { ...chat.lastMessage, text: "[Encrypted message]" } as typeof chat.lastMessage };
          }
        }

        upsertLocalChat(chat).catch(() => {});
        return chat;
      } catch (err) {
        // If offline or network fails, try to return existing local conversation with this participant
        const localChat = await getLocalChatByParticipantId(participantId);
        if (localChat) {
          return localChat;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
};
