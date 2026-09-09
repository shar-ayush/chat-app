import { User } from "../models/User.js";

/**
 * Validates a username format:
 * - 3 to 20 characters
 * - lowercase alphanumeric and underscores only
 * - cannot start or end with an underscore
 */
export function isValidUsername(username) {
  if (typeof username !== "string") return false;
  return /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/.test(username);
}

/**
 * Generates a clean, unique username based on name, email, or clerk username.
 */
export async function generateUniqueUsername(preferred = "", email = "") {
  let base = "";
  if (preferred && typeof preferred === "string") {
    base = preferred.toLowerCase().replace(/[^a-z0-9_]/g, "");
  }
  if (!base && email && typeof email === "string") {
    base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  }
  if (!base) {
    base = "user";
  }

  // Ensure minimum length
  if (base.length < 3) {
    base = base.padEnd(3, "0");
  }
  if (base.length > 15) {
    base = base.substring(0, 15);
  }

  let username = base;
  let counter = 1;

  while (await User.findOne({ username })) {
    const suffix = counter.toString();
    const truncatedBase = base.substring(0, 20 - suffix.length);
    username = `${truncatedBase}${suffix}`;
    counter++;
  }

  return username;
}
