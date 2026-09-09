export interface User {
  _id: string;
  name: string;
  username?: string;
  email: string;
  avatar: string;
  publicKey?: string;
}

export interface MessageSender {
  _id: string;
  name: string;
  username?: string;
  email: string;
  avatar: string;
}

export type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface SearchUserResult {
  _id: string;
  name: string;
  username?: string;
  avatar: string;
  status: FriendshipStatus;
  requestId?: string | null;
}

export interface FriendUser {
  _id: string;
  name: string;
  username?: string;
  avatar: string;
  email: string;
  publicKey?: string;
  friendshipId: string;
  since: string;
}

export interface FriendRequest {
  _id: string;
  sender: {
    _id: string;
    name: string;
    username?: string;
    avatar: string;
  };
  recipient: {
    _id: string;
    name: string;
    username?: string;
    avatar: string;
  };
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
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
  isDeleted?: boolean;
  deletedAt?: string;
  deletedFor?: string[];
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
  isDeleted?: boolean;
}

export interface Chat {
  _id: string;
  participant: MessageSender;
  lastMessage: ChatLastMessage | null;
  lastMessageAt: string;
  createdAt: string;
  unreadCount?: number;
}
