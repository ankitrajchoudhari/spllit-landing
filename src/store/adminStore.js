import { create } from 'zustand';
import { authAPI } from '../services/api';
import { API_BASE_URL } from '../config/backendUrl';

const API_URL = API_BASE_URL;

// Admin authentication store
const useAdminStore = create((set) => ({
  admin: null,
  token: localStorage.getItem('adminToken'),
  isAuthenticated: !!localStorage.getItem('adminToken'),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.adminLogin(credentials);
      const { admin, token } = response;
      
      localStorage.setItem('adminToken', token);
      // Also set as accessToken for compatibility with user routes (for subadmins)
      localStorage.setItem('accessToken', token);
      localStorage.setItem('admin', JSON.stringify(admin));
      
      set({
        admin,
        token,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  logout: () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    set({
      admin: null,
      token: null,
      isAuthenticated: false,
      error: null
    });
  },

  loadAdmin: () => {
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('admin');
    if (token && admin) {
      set({
        token,
        admin: JSON.parse(admin),
        isAuthenticated: true
      });
    }
  }
}));

export default useAdminStore;
