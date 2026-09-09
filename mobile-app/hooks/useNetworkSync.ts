import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { triggerSync } from '../lib/syncEngine';
import { useSocketStore } from '../lib/socket';

export const useNetworkSync = () => {
  useEffect(() => {
    let wasConnected: boolean | null = null;

    triggerSync();

    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = Boolean(state.isConnected);
      const { socket } = useSocketStore.getState();

      if (isConnected) {
        if (wasConnected !== true) {
          wasConnected = true;
          console.log("Network connected, triggering sync");
          if (socket && !socket.connected) {
            socket.connect();
          }
          triggerSync();
        }
      } else {
        if (wasConnected !== false) {
          wasConnected = false;
          console.log("Network disconnected, forcing socket disconnect");
          if (socket && socket.connected) {
            socket.disconnect();
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
};
