import axios from "axios";
import { useAuthStore } from "@repo/ui/store/useAuthStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is missing");
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const accessTokenFromStore = useAuthStore.getState().token;
  const accessToken =
    accessTokenFromStore || localStorage.getItem("accessToken");

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

export { API_BASE_URL, api };
