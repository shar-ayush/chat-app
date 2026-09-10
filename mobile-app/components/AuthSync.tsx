import { useAuthCallback } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeKeyPair } from "@/crypto/keyManager";

const AuthSync = () => {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { mutate: syncUser } = useAuthCallback();
  const queryClient = useQueryClient();
  const hasSynced = useRef(false); // not run useEffect more than once

  useEffect(() => {
    if (isSignedIn && user && !hasSynced.current) {
      hasSynced.current = true;

      syncUser(undefined, {
        onSuccess: async (data) => {
          if (data) {
            queryClient.setQueryData(["currentUser"], data);
            await AsyncStorage.setItem("cached_current_user", JSON.stringify(data)).catch(() => {});
          }

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
  }, [isSignedIn, user, syncUser, getToken, queryClient]);

  return null;
};

export default AuthSync;
