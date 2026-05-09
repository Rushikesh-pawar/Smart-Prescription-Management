import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setDoctor(res.data.doctor))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setDoctor(data.doctor);
    return data.doctor;
  }

  async function signup(payload) {
    const { data } = await api.post('/auth/signup', payload);
    localStorage.setItem('token', data.token);
    setDoctor(data.doctor);
    return data.doctor;
  }

  function logout() {
    localStorage.removeItem('token');
    setDoctor(null);
  }

  async function updateProfile(payload) {
    const { data } = await api.patch('/auth/me', payload);
    setDoctor(data.doctor);
    return data.doctor;
  }

  async function changePassword(currentPassword, newPassword) {
    await api.post('/auth/me/password', { currentPassword, newPassword });
  }

  return (
    <AuthContext.Provider
      value={{ doctor, loading, login, signup, logout, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
