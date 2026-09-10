import axios from "axios";
import { useAuth } from "@clerk/expo";
import { useCallback } from "react";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});


export const useApi = () => {
  const { getToken } = useAuth();

  const apiWithAuth = useCallback(
    async <T>(config: Parameters<typeof api.request>[0]) => {
      const token = await getToken().catch(() => null);
      return api.request<T>({
        ...config,
        headers: { ...config.headers, ...(token && { Authorization: `Bearer ${token}` }) },
      });
    },
    [getToken]
  );

  return { api, apiWithAuth };
};
