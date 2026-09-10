import 'react-native-get-random-values';
import { Stack } from "expo-router";
import "../global.css";
import { ClerkProvider } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
import { resourceCache } from '@clerk/expo/resource-cache'
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthSync from "@/components/AuthSync";
import { StatusBar } from "expo-status-bar";
import SocketConnection from "@/components/SocketConnection";

import { useEffect, useState } from 'react';
import { initDb } from '@/db/database';
import { getLocalChats } from '@/db/chatQueries';
import { getLocalFriends } from '@/db/friendQueries';
import { useThemeStore } from '@/lib/theme';

// Connect TanStack Query to NetInfo for accurate online/offline detection
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      retry: 1,
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    Promise.all([
      initDb().then(async () => {
        try {
          const [cachedUserStr, localChats, localFriends] = await Promise.all([
            AsyncStorage.getItem("cached_current_user").catch(() => null),
            getLocalChats().catch(() => []),
            getLocalFriends().catch(() => []),
          ]);

          if (cachedUserStr) {
            try {
              const cachedUser = JSON.parse(cachedUserStr);
              if (cachedUser) {
                queryClient.setQueryData(["currentUser"], cachedUser);
              }
            } catch {}
          }

          if (localChats && localChats.length > 0) {
            queryClient.setQueryData(["chats"], localChats);
          }

          if (localFriends && localFriends.length > 0) {
            queryClient.setQueryData(["friends"], localFriends);
          }
        } catch (err) {
          console.warn("Failed to pre-populate local cache:", err);
        } finally {
          setDbReady(true);
        }
      }),
      useThemeStore.getState().initTheme(),
    ]).catch(console.error);
  }, []);

  if (!dbReady) return null;

  return (
    <ClerkProvider 
      tokenCache={tokenCache} 
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      __experimental_resourceCache={resourceCache}
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
