import { useSocketStore } from "@/lib/socket";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNetworkSync } from "@/hooks/useNetworkSync";

import { triggerSync } from "@/lib/syncEngine";

const SocketConnection = () => {
  useNetworkSync();
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const connect = useSocketStore((state) => state.connect);
  const disconnect = useSocketStore((state) => state.disconnect);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (isSignedIn) {
      getTokenRef.current()
        .then((token) => {
          if (token) connect(token, queryClient, () => getTokenRef.current());
        })
        .catch(() => {});
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isSignedIn, connect, disconnect, queryClient]);

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
