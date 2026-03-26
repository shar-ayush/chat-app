import express from "express";
import multer from "multer";
import { requireAuth } from "@clerk/express";
import { uploadFile } from "../controllers/uploadController.js";

const router = express.Router();

// Store file temporarily on disk; we delete it after Cloudinary upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB hard limit (multer rejects early)
});

// POST /api/upload — requires valid Clerk auth token
router.post(
  "/",
  requireAuth(),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "File size exceeds 10MB limit" });
        }
        return res.status(400).json({ error: err.message || "File upload error" });
      }
      next();
    });
  },
  uploadFile
);

export default router;
