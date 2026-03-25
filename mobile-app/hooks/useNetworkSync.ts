import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { triggerSync } from '../lib/syncEngine';
import { useSocketStore } from '../lib/socket';

export const useNetworkSync = () => {
  useEffect(() => {
    triggerSync();

    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const { socket } = useSocketStore.getState();
      if (state.isConnected) {
        console.log("Network connected, triggering sync");
        if (socket && !socket.connected) {
          socket.connect();
        }
        triggerSync();
      } else {
        console.log("Network disconnected, forcing socket disconnect");
        if (socket && socket.connected) {
          socket.disconnect();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
};
