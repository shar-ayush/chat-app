import { useApi } from "@/lib/axios";
import { User } from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAuthCallback = () => {
  const { apiWithAuth } = useApi();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiWithAuth<User>({ method: "POST", url: "/auth/callback" });
      if (data) {
        await AsyncStorage.setItem("cached_current_user", JSON.stringify(data));
      }
      return data;
    },
  });
};

export const useCurrentUser = () => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async (): Promise<User | null> => {
      try {
        const { data } = await apiWithAuth<User>({ method: "GET", url: "/auth/me" });
        if (data) {
          await AsyncStorage.setItem("cached_current_user", JSON.stringify(data));
        }
        return data;
      } catch (err) {
        console.log("Offline mode: loading current user from local storage...");
        const cached = await AsyncStorage.getItem("cached_current_user");
        if (cached) {
          try {
            return JSON.parse(cached) as User;
          } catch {}
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

