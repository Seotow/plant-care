import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(undefined); // undefined=loading, null=no auth, string=authenticated
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem("token").then((stored) => {
      if (stored) {
        setToken(stored);
        api.setToken(stored);
        AsyncStorage.getItem("user").then((u) => {
          if (u) setUser(JSON.parse(u));
        });
      } else {
        setToken(null);
      }
    });
  }, []);

  const login = async (tokenValue, userData) => {
    await AsyncStorage.setItem("token", tokenValue);
    await AsyncStorage.setItem("user", JSON.stringify(userData));
    api.setToken(tokenValue);
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    api.setToken(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading: token === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
