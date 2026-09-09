import { FriendRequest } from "../models/FriendRequest.js";
import { User } from "../models/User.js";
import { Chat } from "../models/Chat.js";
import { getIO } from "../utils/socket.js";
import mongoose from "mongoose";

/**
 * Send a friend request to a user by their user ID.
 */
export async function sendFriendRequest(req, res, next) {
  try {
    const senderId = req.userId;
    const recipientId = req.params.userId;

    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ message: "Cannot send a friend request to yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if a relationship already exists in either direction
    const existing = await FriendRequest.findOne({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ message: "You are already friends with this user" });
      }

      // If the recipient already sent a request to the sender, auto-accept it!
      if (existing.sender.toString() === recipientId && existing.status === "pending") {
        existing.status = "accepted";
        await existing.save();

        const populated = await FriendRequest.findById(existing._id)
          .populate("sender", "name username avatar")
          .populate("recipient", "name username avatar");

        // Notify both users via socket
        const io = getIO();
        if (io) {
          io.to(`user:${recipientId}`).emit("friend_request_accepted", populated);
          io.to(`user:${senderId}`).emit("friend_request_accepted", populated);
        }

        return res.json({ message: "Friend request accepted", friendship: populated });
      }

      if (existing.sender.toString() === senderId && existing.status === "pending") {
        return res.status(400).json({ message: "Friend request already sent" });
      }

      // If previously rejected, re-open the request
      if (existing.status === "rejected") {
        existing.sender = senderId;
        existing.recipient = recipientId;
        existing.status = "pending";
        await existing.save();

        const populated = await FriendRequest.findById(existing._id)
          .populate("sender", "name username avatar");

        const io = getIO();
        if (io) {
          io.to(`user:${recipientId}`).emit("friend_request_received", populated);
        }

        return res.status(201).json({ message: "Friend request sent", request: populated });
      }
    }

    const newRequest = await FriendRequest.create({
      sender: senderId,
      recipient: recipientId,
      status: "pending",
    });

    const populated = await FriendRequest.findById(newRequest._id)
      .populate("sender", "name username avatar");

    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit("friend_request_received", populated);
    }

    res.status(201).json({ message: "Friend request sent", request: populated });
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Get pending incoming and outgoing friend requests.
 */
export async function getFriendRequests(req, res, next) {
  try {
    const userId = req.userId;

    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ recipient: userId, status: "pending" })
        .populate("sender", "name username avatar")
        .sort({ createdAt: -1 }),
      FriendRequest.find({ sender: userId, status: "pending" })
        .populate("recipient", "name username avatar")
        .sort({ createdAt: -1 }),
    ]);

    res.json({ incoming, outgoing });
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Accept an incoming friend request.
 */
export async function acceptFriendRequest(req, res, next) {
  try {
    const userId = req.userId;
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      recipient: userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found or already handled" });
    }

    request.status = "accepted";
    await request.save();

    const populated = await FriendRequest.findById(request._id)
      .populate("sender", "name username avatar")
      .populate("recipient", "name username avatar");

    // Pre-create or fetch Chat between both users
    const senderId = request.sender.toString();
    let chat = await Chat.findOne({
      participants: { $all: [userId, senderId] },
    });

    if (!chat) {
      chat = await Chat.create({ participants: [userId, senderId] });
    }

    const io = getIO();
    if (io) {
      io.to(`user:${senderId}`).emit("friend_request_accepted", populated);
      io.to(`user:${userId}`).emit("friend_request_accepted", populated);
    }

    res.json({ message: "Friend request accepted", friendship: populated, chat });
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Reject / decline a friend request.
 */
export async function rejectFriendRequest(req, res, next) {
  try {
    const userId = req.userId;
    const { requestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      recipient: userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    request.status = "rejected";
    await request.save();

    res.json({ message: "Friend request rejected" });
  } catch (error) {
    res.status(500);
    next(error);
  }
}

/**
 * Get all accepted friends of the current user.
 */
export async function getFriends(req, res, next) {
  try {
    const userId = req.userId;

    const friendships = await FriendRequest.find({
      status: "accepted",
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .populate("sender", "name username avatar email publicKey")
      .populate("recipient", "name username avatar email publicKey")
      .sort({ updatedAt: -1 });

    const friends = friendships.map((f) => {
      const isSender = f.sender._id.toString() === userId;
      const friendUser = isSender ? f.recipient : f.sender;
      return {
        _id: friendUser._id,
        name: friendUser.name,
        username: friendUser.username,
        avatar: friendUser.avatar,
        email: friendUser.email,
        publicKey: friendUser.publicKey,
        friendshipId: f._id,
        since: f.updatedAt,
      };
    });

    res.json(friends);
  } catch (error) {
    res.status(500);
    next(error);
  }
}
