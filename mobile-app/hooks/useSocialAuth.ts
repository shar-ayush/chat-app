import { useAuth, useSSO } from "@clerk/clerk-expo";
import { useState } from "react";
import { Alert } from "react-native";
import * as AuthSession from "expo-auth-session";


function useAuthSocial() {
  const [loadingStrategy, setLoadingStrategy] = useState<string | null>(null);
  const { startSSOFlow } = useSSO();
  const { isSignedIn } = useAuth();

  const handleSocialAuth = async (strategy: "oauth_google" | "oauth_apple") => {
    if (loadingStrategy || isSignedIn) {
      console.log("Already signed in, skipping auth");
      return;
    }
    
    setLoadingStrategy(strategy);

    try {
      const redirectUrl = AuthSession.makeRedirectUri({ path: "oauth-native-callback" });
      const { createdSessionId, setActive } = await startSSOFlow({ strategy, redirectUrl });
      if (!createdSessionId || !setActive) {
        const provider = strategy === "oauth_google" ? "Google" : "Apple";
        Alert.alert(
          "Sign-in incomplete",
          `${provider} sign-in did not complete. Please try again.`
        );
        return;
      }

      await setActive({ session: createdSessionId });
    } catch (error) {
      console.log("Error in social auth:", error);
      const provider = strategy === "oauth_google" ? "Google" : "Apple";
      Alert.alert("Error", `Failed to sign in with ${provider}. Please try again.`);
    } finally {
      setLoadingStrategy(null);
    }
  };

  return { handleSocialAuth, loadingStrategy };
}

export default useAuthSocial;
