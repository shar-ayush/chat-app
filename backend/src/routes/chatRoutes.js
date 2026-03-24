import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import { getChats, getOrCreateChat, markMessagesAsRead } from "../controllers/chatController.js";

const router = Router();

router.use(protectRoute);

router.get("/", getChats);
router.post("/with/:participantId", getOrCreateChat);
router.put("/:chatId/read", markMessagesAsRead);

export default router;
