import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = FileSystem.documentDirectory + "file_cache/";

/**
 * Ensure the cache directory exists
 */
const ensureCacheDir = async () => {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

/**
 * Build a deterministic local filename from the remote URL.
 * Uses a hash-like approach (timestamp embedded in the URL + original name) to avoid collisions.
 */
const buildLocalPath = (fileUrl: string, fileName: string): string => {
  // Extract a stable ID from the URL (last segment of Cloudinary path)
  const urlSegment = fileUrl.split("/").pop()?.split("?")[0] ?? Date.now().toString();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return CACHE_DIR + urlSegment + "_" + safeName;
};

/**
 * Returns the local cached URI for a file if it already exists, otherwise null.
 */
export const getCachedFile = async (fileUrl: string, fileName: string): Promise<string | null> => {
  try {
    const localPath = buildLocalPath(fileUrl, fileName);
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists ? localPath : null;
  } catch {
    return null;
  }
};

/**
 * Downloads a file and caches it locally.
 * Returns the local URI on success, or null on failure.
 */
export const downloadAndCache = async (
  fileUrl: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string | null> => {
  try {
    await ensureCacheDir();
    const localPath = buildLocalPath(fileUrl, fileName);

    // Double-check — avoid re-downloading
    const existingInfo = await FileSystem.getInfoAsync(localPath);
    if (existingInfo.exists) {
      return localPath;
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      fileUrl,
      localPath,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
            : 0;
        onProgress?.(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result?.uri) {
      onProgress?.(1);
      return result.uri;
    }
    return null;
  } catch (err) {
    console.error("[FileCache] Download failed:", err);
    return null;
  }
};

/**
 * Format bytes to a human-readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
