import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import { getChats, getOrCreateChat } from "../controllers/chatController.js";

const router = Router();

router.use(protectRoute);

router.get("/", getChats);
router.post("/with/:participantId", getOrCreateChat);

export default router;
