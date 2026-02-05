import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";

const API_URL = "https://chat-app-muyj.onrender.com/api";


const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});


export const useApi = () => {
  const { getToken } = useAuth();

  const apiWithAuth = useCallback(
    async <T>(config: Parameters<typeof api.request>[0]) => {
      const token = await getToken();
      return api.request<T>({
        ...config,
        headers: { ...config.headers, ...(token && { Authorization: `Bearer ${token}` }) },
      });
    },
    [getToken]
  );

  return { api, apiWithAuth };
};
