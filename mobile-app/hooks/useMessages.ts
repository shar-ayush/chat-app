import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/axios";
import type { Message } from "@/types";
import { decryptMessage } from "@/crypto/messageCrypto";

export const useMessages = (chatId: string) => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async (): Promise<Message[]> => {
      const { data } = await apiWithAuth<Message[]>({
        method: "GET",
        url: `/messages/chat/${chatId}`,
      });

      // Decrypt any E2E-encrypted messages
      return Promise.all(
        data.map(async (msg) => {
          if (msg.ciphertext && msg.nonce && msg.senderPublicKey) {
            try {
              const plaintext = await decryptMessage({
                ciphertext: msg.ciphertext,
                nonce: msg.nonce,
                senderPublicKey: msg.senderPublicKey,
              });
              return { ...msg, text: plaintext };
            } catch {
              return { ...msg, text: "[Encrypted message]" };
            }
          }
          return msg;
        })
      );
    },
    enabled: !!chatId,
  });
};
