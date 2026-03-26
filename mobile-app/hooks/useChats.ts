import { useApi } from "@/lib/axios";
import type { Chat } from "@/types";
import { decryptMessage, selectEncryptedPayloadForUser } from "@/crypto/messageCrypto";
import { useCurrentUser } from "./useAuth";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useChats = () => {
  const { apiWithAuth } = useApi();
  const { data: currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ["chats"],
    queryFn: async (): Promise<Chat[]> => {
      const { data } = await apiWithAuth<Chat[]>({ method: "GET", url: "/chats" });
      
      return Promise.all(
        data.map(async (chat) => {
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
              return { ...chat, lastMessage: { ...chat.lastMessage, text: plaintext } as typeof chat.lastMessage };
            } catch {
              return { ...chat, lastMessage: { ...chat.lastMessage, text: "[Encrypted message]" } as typeof chat.lastMessage };
            }
          }
          return chat;
        })
      );
    },
    enabled: !!currentUser,
    staleTime: 60000, // 60 seconds to prevent background refetches from overwriting optimistic UI
  });
};

export const useGetOrCreateChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async (participantId: string): Promise<Chat> => {
      const { data } = await apiWithAuth<Chat>({
        method: "POST",
        url: `/chats/with/${participantId}`,
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
      return chat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
};
