import { SOCKET_URL } from "./socket";

export interface UploadResult {
  url: string;
  public_id: string;
  format: string;
  bytes: number;
  resource_type: string;
  fileName: string;
  mimeType: string;
}

/**
 * Upload a file to the backend using XMLHttpRequest so we can track progress.
 * @param uri - local file URI
 * @param name - original filename
 * @param mimeType - MIME type string
 * @param token - Clerk auth token
 * @param onProgress - callback with value 0..1
 * @returns UploadResult metadata from Cloudinary
 */
export const uploadFile = (
  uri: string,
  name: string,
  mimeType: string,
  token: string,
  onProgress: (progress: number) => void
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();

    // React Native FormData accepts { uri, name, type } objects
    formData.append("file", {
      uri,
      name,
      type: mimeType,
    } as any);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(event.loaded / event.total, 1));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const result: UploadResult = JSON.parse(xhr.responseText);
          onProgress(1);
          resolve(result);
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        let message = "Upload failed";
        try {
          const err = JSON.parse(xhr.responseText);
          message = err.error || message;
        } catch {}
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error — check your connection and try again"));
    };

    xhr.ontimeout = () => {
      reject(new Error("Upload timed out — please try again"));
    };

    xhr.timeout = 60_000; // 60s timeout

    xhr.open("POST", `${SOCKET_URL}/api/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
};
