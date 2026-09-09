import { useAuthCallback } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/expo";
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
              return;
            }
            // Initialize E2E keypair with MongoDB user _id immediately on login/signup
            if (data?._id) {
              await initializeKeyPair(data._id, token);
            }
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
