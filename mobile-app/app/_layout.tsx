import 'react-native-get-random-values';
import { Stack } from "expo-router";
import "../global.css";
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthSync from "@/components/AuthSync";
import { StatusBar } from "expo-status-bar";
import SocketConnection from "@/components/SocketConnection";

import { useEffect, useState } from 'react';
import { initDb } from '@/db/database';
// Moved useNetworkSync to SocketConnection

const queryClient = new QueryClient();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDb().then(() => {
      console.log("Database initialized successfully");
      setDbReady(true);
    }).catch(console.error);
  }, []);

  if (!dbReady) return null;

  return (
    <ClerkProvider 
    tokenCache={tokenCache} 
    publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <SocketConnection />
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
