import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { readTokens, saveTokens, clearTokens } from "@/lib/api";
import { resolveBackendConfig } from "@/lib/backend-config";

const { apiBaseUrl: BASE_URL } = resolveBackendConfig(
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.DEV,
);

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

// Request interceptor to inject stored Bearer token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isAuthEndpoint =
    config.url?.includes("/auth/login") ||
    config.url?.includes("/auth/register") ||
    config.url?.includes("/auth/refresh");

  if (!isAuthEndpoint) {
    const tokens = readTokens();
    if (tokens?.accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

export const resetApiClientState = () => {
  isRefreshing = false;
  failedQueue = [];
};

if (typeof window !== "undefined") {
  window.addEventListener("session-changed", resetApiClientState);
}

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to unwrap NestJS TransformResponseInterceptor format { success, statusCode, data }
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === "object" &&
      response.data.success !== undefined &&
      response.data.data !== undefined
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError<unknown>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
    }) | undefined;

    // If 401 Unauthorized and not on an auth endpoint
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/register") &&
      !originalRequest.url?.includes("/auth/refresh")
    ) {
      const tokens = readTokens();
      const refreshToken = tokens?.refreshToken;

      if (!refreshToken) {
        clearTokens();
        if (window.location.pathname !== "/login" && window.location.pathname !== "/auth/login") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const data = refreshRes.data?.data || refreshRes.data;
        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken;

        if (newAccessToken) {
          saveTokens({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken || refreshToken,
          });
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error("Invalid token refresh payload");
        }
      } catch (refreshErr: unknown) {
        processQueue(refreshErr instanceof Error ? refreshErr : new Error(String(refreshErr)), null);
        clearTokens();
        if (window.location.pathname !== "/login" && window.location.pathname !== "/auth/login") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
