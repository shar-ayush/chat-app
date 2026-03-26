import { useQuery } from "@tanstack/react-query";
import type { Message } from "@/types";
import { decryptMessage } from "@/crypto/messageCrypto";
import { useCurrentUser } from "./useAuth";
import { getMessagesByChatId, LocalMessage } from "../db/messageQueries";

export const useMessages = (chatId: string) => {
  const { data: currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async (): Promise<Message[]> => {
      if (!currentUser) return [];

      const localMessages = await getMessagesByChatId(chatId);

      const mappedMessages = await Promise.all(
        localMessages.map(async (msg: LocalMessage) => {
          const isFileMessage = msg.type === "file";
          let text = "[Encrypted message]";

          if (!isFileMessage) {
            const isFromCurrentUser = msg.sender_id === currentUser._id;

            const ciphertextToDecrypt = isFromCurrentUser ? msg.sender_cipher_text : msg.cipher_text;
            const nonceToDecrypt = isFromCurrentUser ? msg.sender_nonce : msg.nonce;

            if (ciphertextToDecrypt && nonceToDecrypt && msg.sender_public_key) {
              try {
                text = await decryptMessage({
                  ciphertext: ciphertextToDecrypt,
                  nonce: nonceToDecrypt,
                  senderPublicKey: msg.sender_public_key,
                });
              } catch {
                text = "[Decryption Failed]";
              }
            }
          }

          const messageObj: Message = {
            _id: msg.server_id || msg.id,
            chat: msg.chat_id,
            sender: msg.sender_id,
            text,
            type: msg.type ?? "text",
            // File fields
            fileUrl: msg.file_url ?? undefined,
            fileName: msg.file_name ?? undefined,
            mimeType: msg.mime_type ?? undefined,
            fileSize: msg.file_size ?? undefined,
            localUri: msg.local_uri ?? undefined,
            createdAt: new Date(msg.created_at).toISOString(),
            updatedAt: new Date(msg.created_at).toISOString(),
            status: msg.status,
          };

          return messageObj;
        })
      );

      return mappedMessages;
    },
    enabled: !!chatId && !!currentUser,
  });
};
