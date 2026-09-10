import { useApi } from "@/lib/axios";
import { FriendUser, FriendRequest, SearchUserResult, User } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLocalFriends, upsertLocalFriends } from "@/db/friendQueries";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useFriends = () => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["friends"],
    queryFn: async (): Promise<FriendUser[]> => {
      try {
        const { data } = await apiWithAuth<FriendUser[]>({
          method: "GET",
          url: "/friends",
          timeout: 7000,
        });
        await upsertLocalFriends(data).catch(() => {});
        return data;
      } catch (err) {
        console.log("Offline mode: loading friends from local SQLite...");
        const localFriends = await getLocalFriends();
        return localFriends || [];
      }
    },
    staleTime: 30000,
  });
};

export const useFriendRequests = () => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["friendRequests"],
    queryFn: async (): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> => {
      try {
        const { data } = await apiWithAuth<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
          method: "GET",
          url: "/friends/requests",
          timeout: 7000,
        });
        await AsyncStorage.setItem("cached_friend_requests", JSON.stringify(data)).catch(() => {});
        return data;
      } catch (err) {
        const cached = await AsyncStorage.getItem("cached_friend_requests");
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
        return { incoming: [], outgoing: [] };
      }
    },
    staleTime: 30000,
  });
};

export const useSearchUsers = (query: string) => {
  const { apiWithAuth } = useApi();

  return useQuery({
    queryKey: ["searchUsers", query],
    queryFn: async (): Promise<SearchUserResult[]> => {
      if (!query || query.trim().length < 2) return [];
      const { data } = await apiWithAuth<SearchUserResult[]>({
        method: "GET",
        url: `/users/search?username=${encodeURIComponent(query.trim())}`,
      });
      return data;
    },
    enabled: query.trim().length >= 2,
  });
};

export const useSendFriendRequest = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await apiWithAuth<{ message: string; request?: any; friendship?: any }>({
        method: "POST",
        url: `/friends/request/${userId}`,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["searchUsers"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
};

export const useAcceptFriendRequest = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data } = await apiWithAuth<{ message: string; friendship: any; chat?: any }>({
        method: "PUT",
        url: `/friends/request/${requestId}/accept`,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["searchUsers"] });
    },
  });
};

export const useRejectFriendRequest = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data } = await apiWithAuth<{ message: string }>({
        method: "PUT",
        url: `/friends/request/${requestId}/reject`,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["searchUsers"] });
    },
  });
};

export const useUpdateUsername = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (username: string) => {
      const { data } = await apiWithAuth<{ message: string; user: User }>({
        method: "PUT",
        url: "/users/username",
        data: { username },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
};

export const useDeleteAccount = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiWithAuth<{ success: boolean; message: string }>({
        method: "DELETE",
        url: "/users/account",
      });
      return data;
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

