import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken } from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Restore session from a stored token on first load.
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api("/auth/me");
          setUser(user);
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api("/auth/login", { method: "POST", auth: false, body: { email, password } });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (payload) => {
    const { token, user } = await api("/auth/register", { method: "POST", auth: false, body: payload });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const changePassword = useCallback(async (current_password, password) => {
    const { token, user } = await api("/auth/change-password", {
      method: "POST",
      body: { current_password, password },
    });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout, changePassword, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}
