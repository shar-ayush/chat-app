import mongoose, { Schema } from "mongoose";

const FriendRequestSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate friend requests between the same sender and recipient
FriendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });
FriendRequestSchema.index({ recipient: 1, status: 1 });
FriendRequestSchema.index({ sender: 1, status: 1 });

export const FriendRequest = mongoose.model("FriendRequest", FriendRequestSchema);
