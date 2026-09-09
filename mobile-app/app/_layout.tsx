import 'react-native-get-random-values';
import { Stack } from "expo-router";
import "../global.css";
import { ClerkProvider } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthSync from "@/components/AuthSync";
import { StatusBar } from "expo-status-bar";
import SocketConnection from "@/components/SocketConnection";

import { useEffect, useState } from 'react';
import { initDb } from '@/db/database';
import { useThemeStore } from '@/lib/theme';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    Promise.all([
      initDb().then(() => setDbReady(true)),
      useThemeStore.getState().initTheme(),
    ]).catch(console.error);
  }, []);

  if (!dbReady) return null;

  return (
    <ClerkProvider 
      tokenCache={tokenCache} 
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    >
      <QueryClientProvider client={queryClient}>
        <AuthSync />
        <SocketConnection />
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: isDark ? '#0D0D0F' : '#F8FAFC' } }}>
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
