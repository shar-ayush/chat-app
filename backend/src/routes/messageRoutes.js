import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import { getMessages, syncMessages } from "../controllers/messageController.js";

const router = Router();

router.get("/sync", protectRoute, syncMessages);
router.get("/chat/:chatId", protectRoute, getMessages);

export default router;
