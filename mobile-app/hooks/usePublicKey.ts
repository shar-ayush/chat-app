import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

export const usePublicKey = (userId: string | undefined) => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["publicKey", userId],
    queryFn: async (): Promise<string> => {
      try {
        const { data } = await apiWithAuth<{ publicKey: string }>({
          method: "GET",
          url: `/users/${userId}/public-key`,
        });
        if (data.publicKey) {
          await AsyncStorage.setItem(`pubkey_${userId}`, data.publicKey);
        }
        return data.publicKey;
      } catch (err) {
        const cached = await AsyncStorage.getItem(`pubkey_${userId}`);
        if (cached) return cached;
        throw err;
      }
    },
    enabled: !!userId,
    // Cache aggressively — public keys rarely change
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};
