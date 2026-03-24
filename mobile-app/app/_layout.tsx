import { Stack } from "expo-router";
import "../global.css";
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthSync from "@/components/AuthSync";
import { StatusBar } from "expo-status-bar";
import SocketConnection from "@/components/SocketConnection";
import { useAuth } from '@clerk/clerk-expo';


const queryClient = new QueryClient();

function InitialLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  console.log("Auth status - isLoaded:", isLoaded, "isSignedIn:", isSignedIn);
  if (!isLoaded) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0F' } }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen
          name="new-chat"
          options={{
            animation: "slide_from_bottom",
            presentation: "modal",
            gestureEnabled: true,
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      tokenCache={tokenCache}
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <SocketConnection />
        <StatusBar style="light" />
        <InitialLayout />
      </QueryClientProvider>
    </ClerkProvider>
  );
}
