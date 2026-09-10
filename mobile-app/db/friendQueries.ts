import { runWithDb } from "./database";
import type { FriendUser } from "@/types";

export interface LocalFriendRow {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  email: string | null;
  public_key: string | null;
  friendship_id: string | null;
  since: string | null;
}

export const upsertLocalFriends = async (friends: FriendUser[]): Promise<void> => {
  if (!Array.isArray(friends) || friends.length === 0) return;

  await runWithDb(async (db) => {
    for (const friend of friends) {
      if (!friend || !friend._id) continue;
      const safeId = String(friend._id);
      const safeName = String(friend.name || "Unknown");
      const safeUsername = friend.username ? String(friend.username) : null;
      const safeAvatar = friend.avatar ? String(friend.avatar) : "";
      const safeEmail = friend.email ? String(friend.email) : "";
      const safePublicKey = friend.publicKey ? String(friend.publicKey) : null;
      const safeFriendshipId = friend.friendshipId ? String(friend.friendshipId) : "";
      const safeSince = friend.since ? String(friend.since) : new Date().toISOString();

      await db.runAsync(
        `INSERT INTO friends (
          id, name, username, avatar, email, public_key, friendship_id, since
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          username = excluded.username,
          avatar = excluded.avatar,
          email = excluded.email,
          public_key = excluded.public_key,
          friendship_id = excluded.friendship_id,
          since = excluded.since;`,
        [
          safeId,
          safeName,
          safeUsername,
          safeAvatar,
          safeEmail,
          safePublicKey,
          safeFriendshipId,
          safeSince,
        ]
      );
    }
  });
};

export const getLocalFriends = async (): Promise<FriendUser[]> => {
  return runWithDb(async (db) => {
    const rows = await db.getAllAsync<LocalFriendRow>(
      "SELECT * FROM friends ORDER BY name ASC"
    );

    return rows.map((row) => ({
      _id: row.id,
      name: row.name,
      username: row.username || undefined,
      avatar: row.avatar || "",
      email: row.email || "",
      publicKey: row.public_key || undefined,
      friendshipId: row.friendship_id || "",
      since: row.since || new Date().toISOString(),
    }));
  });
};

export const deleteLocalFriend = async (friendId: string): Promise<void> => {
  await runWithDb(async (db) => {
    await db.runAsync("DELETE FROM friends WHERE id = ?;", [String(friendId)]);
  });
};

export const clearLocalFriends = async (): Promise<void> => {
  await runWithDb(async (db) => {
    await db.runAsync("DELETE FROM friends;");
  });
};
