import { create } from 'zustand';
import api from '../utils/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: true,

  setUser: (user) => set({ user }),

  // ─── Password-based auth (kept for backward compatibility) ────────────────
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

  // ─── Unified OTP-based auth (Email OR Phone) ──────────────────────────────
  /**
   * Step 1: Send OTP to email or phone number.
   * Returns { exists: boolean, type: 'email' | 'phone', identifier: string, message: string }
   */
  requestOtp: async (identifier) => {
    const { data } = await api.post('/auth/request-otp', { identifier });
    return data;
  },

  /**
   * Step 2a (login): Verify OTP for an existing account.
   */
  verifyOtpLogin: async (identifier, otp) => {
    const { data } = await api.post('/auth/verify-otp', { identifier, otp });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  /**
   * Step 2b (register): Verify OTP and create a new account with email or phone.
   */
  registerWithOtp: async (name, identifier, otp, title) => {
    const { data } = await api.post('/auth/register-with-otp', { name, identifier, otp, title });
    localStorage.setItem('token', data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  // ─── Shared ───────────────────────────────────────────────────────────────
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isLoading: false });
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        set({ user: null, token: null, isLoading: false });
      } else {
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
