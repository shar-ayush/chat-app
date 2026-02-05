import { Stack } from "expo-router";
import "../global.css";
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthSync from "@/components/AuthSync";
import { StatusBar } from "expo-status-bar";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0F' } }}>
          <Stack.Screen name="(auth)" options={{ animation: "fade"}} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade"}} />
          <Stack.Screen 
          name="new-chat" 
          options={{ 
            animation: "slide_from_bottom", 
            presentation:"modal",
            gestureEnabled: true,
            }} />
        </Stack>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
