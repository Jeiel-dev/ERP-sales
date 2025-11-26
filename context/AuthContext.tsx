import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState } from '../types';
import { getUsers } from '../services/mockBackend';

interface AuthContextType extends AuthState {
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });

  // Restore session from local storage (UI persistence only)
  useEffect(() => {
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      setAuth({ user: JSON.parse(storedUser), isAuthenticated: true });
    }
  }, []);

  const login = async (username: string, pass: string): Promise<boolean> => {
    try {
      const users = await getUsers();
      // In a real app with Supabase Auth, you would use supabase.auth.signInWithPassword
      // For this custom table implementation:
      const user = users.find(u => u.username === username && u.password === pass);

      if (user && user.active) {
        setAuth({ user, isAuthenticated: true });
        localStorage.setItem('current_user', JSON.stringify(user));
        return true;
      }
    } catch (e) {
      console.error("Login error", e);
    }
    return false;
  };

  const logout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem('current_user');
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
