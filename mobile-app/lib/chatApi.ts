import { useApi } from "@/lib/axios";
import { QueryClient } from "@tanstack/react-query";
import { Chat } from "@/types";
import { useCallback } from "react";

export const useChatApi = () => {
  const { apiWithAuth } = useApi();

  const markMessagesAsRead = useCallback(async (chatId: string, queryClient?: QueryClient) => {
    try {
      const { data } = await apiWithAuth({
        method: "PUT",
        url: `/chats/${chatId}/read`,
      });

      // Update local state if queryClient is provided
      if (queryClient) {
        queryClient.setQueryData<Chat[]>(["chats"], (oldChats) => {
          return oldChats?.map((chat) => {
            if (chat._id === chatId) {
              return { ...chat, unreadCount: 0 };
            }
            return chat;
          });
        });
      }

      return data;
    } catch (error) {
      // console.error("Failed to mark messages as read:", error);
      throw error;
    }
  }, [apiWithAuth]);

  return { markMessagesAsRead };
};
