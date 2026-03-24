import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/axios";
import type { Message } from "@/types";
import { decryptMessage, selectEncryptedPayloadForUser } from "@/crypto/messageCrypto";
import { useCurrentUser } from "./useAuth";

export const useMessages = (chatId: string) => {
  const { apiWithAuth } = useApi();
  const { data: currentUser } = useCurrentUser();

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
          const payload = selectEncryptedPayloadForUser(msg, currentUser?._id);

          if (payload && msg.senderPublicKey) {
            try {
              const plaintext = await decryptMessage({
                ciphertext: payload.ciphertext,
                nonce: payload.nonce,
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
