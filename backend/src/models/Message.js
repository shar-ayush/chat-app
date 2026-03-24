import mongoose, { Schema, Document } from "mongoose";

const MessageSchema = new Schema(
  {
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
    text: {
      type: String,
      default: "",
      trim: true,
    },
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
