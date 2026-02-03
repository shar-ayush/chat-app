import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import { getMessages } from "../controllers/messageController.js";

const router = Router();

router.get("/chat/:chatId", protectRoute, getMessages);

export default router;
