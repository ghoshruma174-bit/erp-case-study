import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../services/api";

const AuthContext = createContext(null);

function readSavedUser() {
  try {
    const saved = sessionStorage.getItem("erp-user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    sessionStorage.removeItem("erp-token");
    sessionStorage.removeItem("erp-user");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);

  useEffect(() => {
    const clearSession = () => {
      sessionStorage.removeItem("erp-token");
      sessionStorage.removeItem("erp-user");
      setUser(null);
    };
    window.addEventListener("erp:unauthorized", clearSession);
    return () => window.removeEventListener("erp:unauthorized", clearSession);
  }, []);

  async function login(email, password) {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    sessionStorage.setItem("erp-token", result.token);
    sessionStorage.setItem("erp-user", JSON.stringify(result.user));
    setUser(result.user);
  }

  function logout() {
    sessionStorage.removeItem("erp-token");
    sessionStorage.removeItem("erp-user");
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
