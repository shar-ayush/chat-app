import { User } from "../models/User.js";
import { clerkClient, getAuth } from "@clerk/express";
import { generateUniqueUsername } from "../utils/username.js";

export async function getMe(req, res, next) {
  try {
    const userId = req.userId;

    let user = await User.findById(userId);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.username) {
      user.username = await generateUniqueUsername(user.name, user.email);
      await user.save();
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500);
    next(error);
  }
}

export async function authCallback(req, res, next) {
  try {
    const { userId: clerkId } = getAuth(req);

    if (!clerkId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    let user = await User.findOne({ clerkId });

    if (!user) {
      // get user info from clerk and save to db
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const name = clerkUser.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
        : clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] || "User";
      const email = clerkUser.emailAddresses[0]?.emailAddress || "";
      const username = await generateUniqueUsername(clerkUser.username || name, email);

      user = await User.create({
        clerkId,
        name,
        username,
        email,
        avatar: clerkUser.imageUrl || "",
      });
    } else if (!user.username) {
      user.username = await generateUniqueUsername(user.name, user.email);
      await user.save();
    }

    res.json(user);
  } catch (error) {
    res.status(500);
    next(error);
  }
}

