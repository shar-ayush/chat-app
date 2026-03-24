import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/axios";

export const usePublicKey = (userId: string | undefined) => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["publicKey", userId],
    queryFn: async (): Promise<string> => {
      const { data } = await apiWithAuth<{ publicKey: string }>({
        method: "GET",
        url: `/users/${userId}/public-key`,
      });
      return data.publicKey;
    },
    enabled: !!userId,
    // Cache aggressively — public keys rarely change
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};
