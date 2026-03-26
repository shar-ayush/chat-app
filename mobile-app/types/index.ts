export interface User {
  _id: string;
  name: string;
  email: string;
  avatar: string;
  publicKey?: string;
}

export interface MessageSender {
  _id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Message {
  _id: string;
  chat: string;
  sender: MessageSender | string;
  text: string;
  type?: "text" | "file";
  // File message fields
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  localUri?: string; // local cached path (offline)
  // Encrypted text fields
  ciphertext?: string;
  nonce?: string;
  senderCiphertext?: string;
  senderNonce?: string;
  senderPublicKey?: string;
  createdAt: string;
  updatedAt: string;
  status?: "pending" | "sending" | "sent" | "delivered" | "failed";
}

export interface ChatLastMessage {
  _id: string;
  text: string;
  sender: string;
  fileName?: string; // populated for file messages
  ciphertext?: string;
  nonce?: string;
  senderCiphertext?: string;
  senderNonce?: string;
  senderPublicKey?: string;
  createdAt: string;
}

export interface Chat {
  _id: string;
  participant: MessageSender;
  lastMessage: ChatLastMessage | null;
  lastMessageAt: string;
  createdAt: string;
  unreadCount?: number;
}
