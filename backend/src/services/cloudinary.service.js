import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

/**
 * Upload a local file to Cloudinary
 * @param {string} filePath - Absolute path to the temp file
 * @returns {{ url, public_id, format, bytes, resource_type }}
 */
export const uploadToCloudinary = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "auto",
    folder: "chat-app",
  });

  return {
    url: result.secure_url,
    public_id: result.public_id,
    format: result.format,
    bytes: result.bytes,
    resource_type: result.resource_type,
  };
};
