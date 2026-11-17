import { createContext, useContext, useEffect, useState } from 'react';
import axiosClient, { TOKEN_STORAGE_KEY } from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveSession = (data) => {
    if (data.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    }
    setUser(data.user);
    setBusinessProfile(data.businessProfile);
  };

  const clearSession = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setBusinessProfile(null);
  };

  useEffect(() => {
    const verifyExistingSession = async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axiosClient.get('/auth/me');
        setUser(res.data.data.user);
        setBusinessProfile(res.data.data.businessProfile);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    verifyExistingSession();
  }, []);

  const register = async (payload) => {
    const res = await axiosClient.post('/auth/register', payload);
    saveSession(res.data.data);
    return res.data.data;
  };

  const login = async (payload) => {
    const res = await axiosClient.post('/auth/login', payload);
    saveSession(res.data.data);
    return res.data.data;
  };

  const updateProfile = async (payload) => {
    const res = await axiosClient.put('/auth/profile', payload);
    setUser(res.data.data.user);
    setBusinessProfile(res.data.data.businessProfile);
    return res.data.data;
  };

  const uploadLogo = async (file) => {
    const res = await axiosClient.post('/auth/logo', file, {
      headers: {
        'Content-Type': file.type,
      },
    });
    setUser(res.data.data.user);
    setBusinessProfile(res.data.data.businessProfile);
    return res.data.data;
  };

  const logout = async () => {
    try {
      await axiosClient.post('/auth/logout');
    } catch {
      // Clear local session even if the server request fails
    } finally {
      clearSession();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        businessProfile,
        isAuthenticated: Boolean(user),
        loading,
        register,
        login,
        logout,
        updateProfile,
        uploadLogo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

