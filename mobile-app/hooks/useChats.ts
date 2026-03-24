import { useApi } from "@/lib/axios";
import type { Chat } from "@/types";
import { decryptMessage } from "@/crypto/messageCrypto";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useChats = () => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["chats"],
    queryFn: async (): Promise<Chat[]> => {
      const { data } = await apiWithAuth<Chat[]>({ method: "GET", url: "/chats" });
      
      return Promise.all(
        data.map(async (chat) => {
          if (chat.lastMessage?.ciphertext && chat.lastMessage?.nonce && chat.lastMessage?.senderPublicKey) {
            try {
              const plaintext = await decryptMessage({
                ciphertext: chat.lastMessage.ciphertext,
                nonce: chat.lastMessage.nonce,
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
  });
};

export const useGetOrCreateChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (participantId: string): Promise<Chat> => {
      const { data } = await apiWithAuth<Chat>({
        method: "POST",
        url: `/chats/with/${participantId}`,
      });
      
      let chat = data;
      if (chat.lastMessage?.ciphertext && chat.lastMessage?.nonce && chat.lastMessage?.senderPublicKey) {
        try {
          const plaintext = await decryptMessage({
            ciphertext: chat.lastMessage.ciphertext,
            nonce: chat.lastMessage.nonce,
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
