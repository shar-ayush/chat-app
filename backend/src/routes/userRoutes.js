import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import { getUsers } from "../controllers/userController.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/", protectRoute, getUsers);

// Upload or update public key
router.post("/public-key", protectRoute, async (req, res) => {
    try {
    const { publicKey } = req.body;
    const userId = req.userId; // Use the authenticated user's ID from protectRoute middleware

    // Validate it's a valid base64 X25519 key (32 bytes = 44 base64 chars)
    const decoded = Buffer.from(publicKey, 'base64');
    if (decoded.length !== 32) {
      return res.status(400).json({ error: 'Invalid public key length' });
    }

    // Use the already-authenticated user's ID from middleware
    const user = await User.findByIdAndUpdate(
      userId,
      { publicKey },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Public key upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get another user's public key 
router.get('/:userId/public-key', protectRoute, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = userId.match(/^[0-9a-fA-F]{24}$/) 
      ? await User.findById(userId) 
      : await User.findOne({ clerkId: userId });
    
    if (!user || !user.publicKey) {
      return res.status(404).json({ error: 'Public key not found' });
    }
    res.json({ publicKey: user.publicKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
