import { useAuthCallback } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { initializeKeyPair } from "@/crypto/keyManager";


const AuthSync = () => {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { mutate: syncUser } = useAuthCallback();
  const hasSynced = useRef(false); // not run useEffect more than once

  useEffect(() => {
    if (isSignedIn && user && !hasSynced.current) {
      hasSynced.current = true;

      syncUser(undefined, {
        onSuccess: async (data) => {
          // console.log("User synced with backend:", data.name);
          // Initialize E2E keypair once after login
          try {
            const token = await getToken();
            if (!token) {
              // console.error("Failed to get auth token");
              return;
            }
            // console.log("Starting E2E keypair initialization for user:", user.id);
            await initializeKeyPair(user.id, token);
            // console.log("E2E keypair initialized successfully");
          } catch (e) {
            // console.error("E2E key init failed:", e instanceof Error ? e.message : e);
            // Don't throw - allow user to continue even if E2E setup fails
          }
        },
        onError: (error) => {
          // console.log("User sync failed for the user:", error);
        },
      });
    }

    if (!isSignedIn) {
      hasSynced.current = false;
    }
  }, [isSignedIn, user, syncUser, getToken]);

  return null;
};

export default AuthSync;
