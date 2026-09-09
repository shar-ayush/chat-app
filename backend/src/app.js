import express from "express";
import {clerkMiddleware} from "@clerk/express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import {errorHandler} from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

const healthHandler = (req, res) => {
  if (req.method === "HEAD") {
    return res.status(200).end();
  }
  res.status(200).json({ status: "ok", message: "Server is running" });
};

// Health endpoints explicitly supporting both GET and HEAD
app.route("/health").get(healthHandler).head(healthHandler);
app.route("/api/health").get(healthHandler).head(healthHandler);
app.route("/").get(healthHandler).head(healthHandler);

app.use(clerkMiddleware());

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/upload", uploadRoutes);

app.use(errorHandler);

export default app;
