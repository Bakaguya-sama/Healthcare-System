import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@repo/ui/store/useAuthStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is missing");
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

type QueueItem = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

const refreshQueue: QueueItem[] = [];
let isRefreshing = false;

const authFreePaths = new Set([
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/send-otp",
  "/auth/confirm-otp",
  "/auth/change-password",
]);

function clearAuthStorage() {
  useAuthStore.getState().logout();
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

function notifySessionExpired() {
  window.dispatchEvent(
    new CustomEvent("auth:session-expired", {
      detail: {
        message: "Session expired. Please log in again!",
      },
    }),
  );
}

function resolveRefreshQueue(token: string) {
  while (refreshQueue.length > 0) {
    const item = refreshQueue.shift();
    item?.resolve(token);
  }
}

function rejectRefreshQueue(error: unknown) {
  while (refreshQueue.length > 0) {
    const item = refreshQueue.shift();
    item?.reject(error);
  }
}

api.interceptors.request.use((config) => {
  const accessTokenFromStore = useAuthStore.getState().token;
  const accessToken =
    accessTokenFromStore || localStorage.getItem("accessToken");

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestPath = originalRequest.url ?? "";
    const isAuthFreeRequest = authFreePaths.has(requestPath);

    if (error.response?.status !== 401 || isAuthFreeRequest) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearAuthStorage();
      notifySessionExpired();
      return Promise.reject(error);
    }

    const currentUser = useAuthStore.getState().user;
    const refreshToken =
      useAuthStore.getState().refreshToken ||
      localStorage.getItem("refreshToken");

    if (!currentUser?.id || !refreshToken) {
      clearAuthStorage();
      notifySessionExpired();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newAccessToken) => {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await refreshApi.post<RefreshResponse>(
        "/auth/refresh",
        {
          userId: currentUser.id,
          refreshToken,
        },
      );

      const nextAccessToken = refreshResponse.data.accessToken;
      const nextRefreshToken = refreshResponse.data.refreshToken;

      localStorage.setItem("accessToken", nextAccessToken);
      localStorage.setItem("refreshToken", nextRefreshToken);
      useAuthStore
        .getState()
        .setUser(currentUser, nextAccessToken, nextRefreshToken);

      resolveRefreshQueue(nextAccessToken);
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      rejectRefreshQueue(refreshError);
      clearAuthStorage();
      notifySessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export { API_BASE_URL, api };
