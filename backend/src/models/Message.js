import mongoose, { Schema, Document } from "mongoose";

const MessageSchema = new Schema(
  {
    localId: { type: String, unique: true, sparse: true }, // For idempotency
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["text", "file"], default: "text" },
    text: {
      type: String,
      default: "",
      trim: true,
    },
    // File message fields
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    mimeType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    ciphertext: { type: String, default: null }, // base64
    nonce: { type: String, default: null }, // base64
    senderCiphertext: { type: String, default: null }, // base64 (sender copy)
    senderNonce: { type: String, default: null }, // base64 (sender copy)
    senderPublicKey: { type: String, default: null }, // base64
    createdAt: { type: Date, default: Date.now },
    readBy: [String],
  },
  { timestamps: true },
);

// indexes for faster queries
MessageSchema.index({ chat: 1, createdAt: 1 }); 

export const Message = mongoose.model("Message", MessageSchema);
