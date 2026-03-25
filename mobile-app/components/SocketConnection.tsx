import { useSocketStore } from "@/lib/socket";
import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNetworkSync } from "@/hooks/useNetworkSync";

import { triggerSync } from "@/lib/syncEngine";

const SocketConnection = () => {
  useNetworkSync();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => {
        if (token) connect(token, queryClient);
      });
    } else disconnect();

    return () => {
      disconnect();
    };
  }, [isSignedIn, connect, disconnect, getToken, queryClient]);

  // Failsafe aggressive background polling for stuck messages
  useEffect(() => {
    const interval = setInterval(() => {
      const socket = useSocketStore.getState().socket;
      if (socket?.connected) {
         triggerSync();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return null;
};

export default SocketConnection;
