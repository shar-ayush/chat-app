import { User } from "../models/User.js";
import { Message } from "../models/Message.js";
import { Chat } from "../models/Chat.js";
import { FriendRequest } from "../models/FriendRequest.js";
import { isValidUsername } from "../utils/username.js";
import { clerkClient } from "@clerk/express";
import { onlineUsers, getIO } from "../utils/socket.js";

/**
 * Search users by username (with friendship status indicator).
 */
export async function searchUsers(req, res, next) {
  try {
    const userId = req.userId;
    const query = (req.query.username || "").trim().toLowerCase();

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      _id: { $ne: userId },
      username: { $regex: query, $options: "i" },
    })
      .select("name username avatar email")
      .limit(20);

    const userIds = users.map((u) => u._id);

    // Fetch friend requests involving these users and current user
    const requests = await FriendRequest.find({
      $or: [
        { sender: userId, recipient: { $in: userIds } },
        { recipient: userId, sender: { $in: userIds } },
      ],
    });

    const results = users.map((u) => {
      const reqDoc = requests.find(
        (r) =>
          (r.sender.toString() === userId && r.recipient.toString() === u._id.toString()) ||
          (r.recipient.toString() === userId && r.sender.toString() === u._id.toString())
      );

      let status = "none";
      let requestId = null;

      if (reqDoc) {
        requestId = reqDoc._id;
        if (reqDoc.status === "accepted") {
          status = "friends";
        } else if (reqDoc.status === "pending") {
          status = reqDoc.sender.toString() === userId ? "pending_sent" : "pending_received";
        }
      }

      return {
        _id: u._id,
        name: u.name,
        username: u.username,
        avatar: u.avatar,
        status,
        requestId,
      };
    });

    res.json(results);
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Update current user's username.
 */
export async function updateUsername(req, res, next) {
  try {
    const userId = req.userId;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({
        message: "Username must be 3-20 characters long and contain only lowercase letters, numbers, and underscores",
      });
    }

    // Check if taken by someone else
    const existing = await User.findOne({
      username: cleanUsername,
      _id: { $ne: userId },
    });

    if (existing) {
      return res.status(400).json({ message: "This username is already taken" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username: cleanUsername },
      { new: true }
    );

    res.json({ message: "Username updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Fallback users query (returns users with username included).
 */
export async function getUsers(req, res, next) {
  try {
    const userId = req.userId;

    const users = await User.find({ _id: { $ne: userId } })
      .select("name username email avatar")
      .limit(50);

    res.json(users);
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Permanently delete user account and all related data (messages, chats, friend requests, clerk user).
 */
export async function deleteAccount(req, res, next) {
  try {
    const userId = req.userId;
    const clerkId = req.user?.clerkId;

    console.log(`[Delete Account] Starting full deletion for user ${userId} (Clerk: ${clerkId})`);

    // 1. Delete all messages sent by this user
    await Message.deleteMany({ sender: userId });

    // 2. Remove user from readBy and deletedFor arrays in messages
    await Message.updateMany({ readBy: userId }, { $pull: { readBy: userId } });
    await Message.updateMany({ deletedFor: userId }, { $pull: { deletedFor: userId } });

    // 3. Remove user from all chats
    await Chat.updateMany({ participants: userId }, { $pull: { participants: userId } });
    // Delete any empty chats
    await Chat.deleteMany({ participants: { $size: 0 } });

    // 4. Delete all friend requests involving this user
    await FriendRequest.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }],
    });

    // 5. Delete User document from MongoDB
    await User.findByIdAndDelete(userId);

    // 6. Delete User from Clerk
    if (clerkId) {
      try {
        await clerkClient.users.deleteUser(clerkId);
        console.log(`[Delete Account] Successfully deleted user from Clerk: ${clerkId}`);
      } catch (clerkErr) {
        console.warn(`[Delete Account] Warning: Could not delete user from Clerk:`, clerkErr?.message);
      }
    }

    // 7. Clean up socket presence
    onlineUsers.delete(userId);
    const io = getIO();
    if (io) {
      io.emit("user-offline", { userId });
    }

    console.log(`[Delete Account] Complete deletion finished for user ${userId}`);
    res.json({ success: true, message: "Account and all associated data deleted successfully" });
  } catch (error) {
    console.error("[Delete Account Error]:", error);
    res.status(500);
    next(error);
  }
}
