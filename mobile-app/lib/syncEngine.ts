import NetInfo from "@react-native-community/netinfo";
import { useSocketStore } from "./socket";
import { getOldestPendingMessage, updateMessageStatus, resetSendingToPending } from "../db/messageQueries";

let isProcessing = false;

export const processQueueSequentially = async () => {
  if (isProcessing) return; // Prevent concurrent processing
  
  const { socket, queryClient } = useSocketStore.getState();
  if (!socket?.connected) return; // Socket disconnected, pause queue

  isProcessing = true;

  try {
    const msg = await getOldestPendingMessage();
    
    if (!msg) {
      isProcessing = false;
      return; // Queue empty
    }

    if (msg.retry_count > 5) {
      await updateMessageStatus(msg.id, 'failed');
      isProcessing = false;
      // Recursively process next
      processQueueSequentially();
      return;
    }

    // Mark as sending
    await updateMessageStatus(msg.id, 'sending');

    // Emit via Socket
    const payload = {
      localId: msg.id,
      chatId: msg.chat_id,
      ciphertext: msg.cipher_text,
      nonce: msg.nonce,
      senderCiphertext: msg.sender_cipher_text,
      senderNonce: msg.sender_nonce,
      senderPublicKey: msg.sender_public_key,
    };

    const ackPromise = new Promise<{ message_ack?: boolean, serverId?: string, error?: string }>((resolve, reject) => {
      // 5 second timeout for ACK
      const timer = setTimeout(() => {
        resolve({ error: "timeout" });
      }, 5000);

      // Listen for socket response
      socket.emit("send-message", payload);

      // We expect the server to emit message_ack immediately per socket.ts we'll write
      const ackHandler = (response: { localId: string, serverId: string }) => {
        if (response.localId === msg.id) {
          clearTimeout(timer);
          socket.off("message_ack", ackHandler);
          socket.off("socket-error", errorHandler);
          resolve({ message_ack: true, serverId: response.serverId });
        }
      };

      const errorHandler = (response: { message: string, localId?: string }) => {
        if (!response.localId || response.localId === msg.id) {
          clearTimeout(timer);
          socket.off("message_ack", ackHandler);
          socket.off("socket-error", errorHandler);
          resolve({ error: response.message });
        }
      };

      socket.on("message_ack", ackHandler);
      socket.on("socket-error", errorHandler);
    });

    const result = await ackPromise;

    if (result.message_ack && result.serverId) {
      // Success
      await updateMessageStatus(msg.id, 'sent', result.serverId);
      if (queryClient) {
        // Now that the backend /chats API includes the RAM buffer,
        // it is safe to invalidate 'chats' to keep the home screen freshly in sync!
        queryClient.invalidateQueries({ queryKey: ["messages", msg.chat_id] });
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    } else {
      // Failed or Timeout -> re-queue with retry bump
      console.warn("Queue item failed:", result.error);
      await updateMessageStatus(msg.id, 'pending', undefined, true);
    }

  } catch (error) {
    console.error("Queue loop error:", error);
  } finally {
    isProcessing = false;
  }

  // Check if there are more pending messages
  const nextMsg = await getOldestPendingMessage();
  if (nextMsg && nextMsg.retry_count <= 5) {
    processQueueSequentially();
  }
};

// Start sync loop on net reconnect or app start
export const triggerSync = async () => {
  await resetSendingToPending(); // Reset stuck 'sending' to 'pending'
  processQueueSequentially();
};

