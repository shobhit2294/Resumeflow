import { create } from 'zustand';
import api from '../utils/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: true,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  register: async (name, email, password, title) => {
    const { data } = await api.post('/auth/register', { name, email, password, title });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isLoading: false });
    } catch (err) {
      // Only clear token if the server explicitly rejected it (401)
      // Don't clear on network errors, server down, etc.
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        set({ user: null, token: null, isLoading: false });
      } else {
        // Keep the token, just mark loading done
        set({ isLoading: false });
      }
    }
  },

  updateProfile: async (updates) => {
    const { data } = await api.put('/auth/profile', updates);
    set({ user: data.user });
    return data;
  },
}));

export default useAuthStore;