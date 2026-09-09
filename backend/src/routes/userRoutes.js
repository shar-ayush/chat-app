import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import { getUsers, searchUsers, updateUsername, deleteAccount } from "../controllers/userController.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/", protectRoute, getUsers);
router.get("/search", protectRoute, searchUsers);
router.put("/username", protectRoute, updateUsername);
router.delete("/account", protectRoute, deleteAccount);

// Get authenticated user's own keypair backup
router.get("/key-pair", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("publicKey secretKey");
    if (!user || !user.publicKey || !user.secretKey) {
      return res.status(404).json({ error: "Key backup not found" });
    }
    res.json({ publicKey: user.publicKey, secretKey: user.secretKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save or update authenticated user's keypair backup
router.post("/key-pair", protectRoute, async (req, res) => {
  try {
    const { publicKey, secretKey } = req.body;
    const userId = req.userId;

    if (!publicKey || !secretKey) {
      return res.status(400).json({ error: "Both publicKey and secretKey are required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { publicKey, secretKey },
      { new: true }
    );

    res.json({ success: true, publicKey: user.publicKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload or update public key (with optional secretKey backup)
router.post("/public-key", protectRoute, async (req, res) => {
  try {
    const { publicKey, secretKey } = req.body;
    const userId = req.userId;

    const decoded = Buffer.from(publicKey, 'base64');
    if (decoded.length !== 32) {
      return res.status(400).json({ error: 'Invalid public key length' });
    }

    const updateFields = { publicKey };
    if (secretKey) updateFields.secretKey = secretKey;

    const user = await User.findByIdAndUpdate(
      userId,
      updateFields,
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
