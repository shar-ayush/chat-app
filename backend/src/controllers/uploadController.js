import fs from "fs";
import { uploadToCloudinary } from "../services/cloudinary.service.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/upload
 * Expects: multipart/form-data with field "file"
 * Returns: { url, public_id, format, bytes, resource_type, fileName, mimeType }
 */
export const uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  const { path: filePath, originalname, mimetype, size } = req.file;

  if (size > MAX_FILE_SIZE) {
    // Delete the temp file
    fs.unlink(filePath, () => {});
    return res.status(413).json({ error: "File size exceeds 10MB limit" });
  }

  try {
    const result = await uploadToCloudinary(filePath);

    return res.status(200).json({
      url: result.url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes,
      resource_type: result.resource_type,
      fileName: originalname,
      mimeType: mimetype,
    });
  } catch (err) {
    console.error("[Upload] Cloudinary upload failed:", err);
    return res.status(500).json({ error: "Upload to Cloudinary failed. Please try again." });
  } finally {
    // Always clean up the temp file
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.warn("[Upload] Failed to delete temp file:", err.message);
      });
    }
  }
};
