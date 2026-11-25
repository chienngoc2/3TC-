/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser, LoginPayload, RegisterPayload } from "@/features/auth/types/auth.types";
import { loginApi, registerApi, logoutApi } from "@/features/auth/services/auth-api.service";
import { readTokens, saveTokens, clearTokens, get, ApiError } from "@/lib/api";
import { SessionContext, type SessionState, type SessionValue } from "@/auth/session-context";

export type { SessionState, SessionValue };

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  state: SessionState;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  verify: () => Promise<void>;
  accept: (value: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialUser(): AuthUser | null {
  try {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      return JSON.parse(storedUser) as AuthUser;
    }
  } catch (err) {
    console.warn("Failed to parse stored user profile", err);
  }
  return null;
}

function getInitialState(): SessionState {
  const tokens = readTokens();
  if (!tokens) return "anonymous";
  const storedUser = getInitialUser();
  if (storedUser) return "authenticated";
  return "loading";
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const [state, setState] = useState<SessionState>(getInitialState);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const verify = useCallback(async () => {
    const tokens = readTokens();
    if (!tokens) {
      setUser(null);
      setState("anonymous");
      return;
    }
    try {
      const profile = await get<AuthUser>("/users/profile/me");
      setUser(profile);
      setState("authenticated");
      localStorage.setItem("auth_user", JSON.stringify(profile));
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearTokens();
        queryClient.clear();
        setUser(null);
        setState("anonymous");
      } else {
        if (!user && !getInitialUser()) {
          setState("unavailable");
        }
      }
    }
  }, [queryClient, user]);

  useEffect(() => {
    if (readTokens() && (!user || state === "loading")) {
      queueMicrotask(() => {
        void verify();
      });
    }
  }, [verify, user, state]);

  useEffect(() => {
    const syncAuth = () => {
      const tokens = readTokens();
      if (!tokens) {
        setUser(null);
        setState("anonymous");
      } else {
        const u = getInitialUser();
        setUser(u);
        setState(u ? "authenticated" : "loading");
        if (!u) {
          queueMicrotask(() => {
            void verify();
          });
        }
      }
    };
    window.addEventListener("storage", syncAuth);
    window.addEventListener("session-changed", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("session-changed", syncAuth);
    };
  }, [verify]);

  const accept = useCallback(
    (value: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      queryClient.clear();
      saveTokens({ accessToken: value.accessToken, refreshToken: value.refreshToken }, value.user);
      setUser(value.user);
      setState("authenticated");
    },
    [queryClient]
  );

  const login = useCallback(
    async (payload: LoginPayload): Promise<AuthUser> => {
      setIsLoading(true);
      try {
        const data = await loginApi(payload);
        const authUser = data.user;
        saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }, authUser);
        queryClient.clear();
        setUser(authUser);
        setState("authenticated");
        return authUser;
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient]
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<AuthUser> => {
      setIsLoading(true);
      try {
        const data = await registerApi(payload);
        const authUser = data.user;
        saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }, authUser);
        queryClient.clear();
        setUser(authUser);
        setState("authenticated");
        return authUser;
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient]
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch (error) {
      console.warn("Logout API warning:", error);
    } finally {
      clearTokens();
      queryClient.clear();
      setUser(null);
      setState("anonymous");
      setIsLoading(false);
    }
  }, [queryClient]);

  const authContextValue = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: state === "authenticated" || !!user,
      isLoading: isLoading || state === "loading",
      state,
      login,
      register,
      logout,
      verify,
      accept,
      setUser,
    }),
    [user, state, isLoading, login, register, logout, verify, accept]
  );

  const sessionContextValue = useMemo<SessionValue>(
    () => ({
      state,
      user,
      accept,
      verify,
      logout,
    }),
    [state, user, accept, verify, logout]
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      <SessionContext.Provider value={sessionContextValue}>
        {children}
      </SessionContext.Provider>
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const authCtx = useContext(AuthContext);
  const sessionCtx = useContext(SessionContext);

  if (authCtx) return authCtx;

  if (sessionCtx) {
    return {
      user: sessionCtx.user,
      isAuthenticated: sessionCtx.state === "authenticated" || !!sessionCtx.user,
      isLoading: sessionCtx.state === "loading",
      state: sessionCtx.state,
      login: async () => {
        throw new Error("login is not implemented in session test mock");
      },
      register: async () => {
        throw new Error("register is not implemented in session test mock");
      },
      logout: sessionCtx.logout,
      verify: sessionCtx.verify,
      accept: sessionCtx.accept,
      setUser: () => {},
    };
  }

  throw new Error("useAuth must be used within an AuthProvider");
};
