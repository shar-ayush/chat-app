import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { triggerSync } from '../lib/syncEngine';

export const useNetworkSync = () => {
  useEffect(() => {
    // 1. Reset pending items on mount, and start sync
    triggerSync();

    // 2. Listen for network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        console.log("Network connected, triggering sync");
        triggerSync();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
};
