import mongoose, { Schema,Document } from "mongoose";

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
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// indexes for faster queries
MessageSchema.index({ chat: 1, createdAt: 1 }); // oldest one first

export const Message = mongoose.model("Message", MessageSchema);
