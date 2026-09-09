import { Router } from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
} from "../controllers/friendController.js";

const router = Router();

router.use(protectRoute);

router.get("/", getFriends);
router.get("/requests", getFriendRequests);
router.post("/request/:userId", sendFriendRequest);
router.put("/request/:requestId/accept", acceptFriendRequest);
router.put("/request/:requestId/reject", rejectFriendRequest);

export default router;
