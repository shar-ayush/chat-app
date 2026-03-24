import { getAuth } from "@clerk/express";
import { User } from "../models/User.js";
import { requireAuth } from "@clerk/express";


export const protectRoute = [
  requireAuth(),
  async (req, res, next) => {
    try {
      const { userId: clerkId } = getAuth(req);


      const user = await User.findOne({ clerkId });
      if (!user) return res.status(404).json({ message: "User not found" });

      req.userId = user._id.toString();
      req.user = user;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500);
      next(error);
    }
  },
];
