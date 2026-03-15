import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, userAPI } from '../services/api';

const useAuthStore = create(
    persist(
        (set, get) => ({
            // State
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            // Actions
            setUser: (user) => set({ user, isAuthenticated: !!user }),

            setTokens: (accessToken, refreshToken) => {
                // Store in localStorage for API interceptor
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', refreshToken);
                set({ accessToken, refreshToken });
            },

            // Register new user
            register: async (userData) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await authAPI.register(userData);
                    const { user, tokens } = response;
                    const { accessToken, refreshToken } = tokens;

                    get().setTokens(accessToken, refreshToken);
                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    return { success: true, user };
                } catch (error) {
                    const errorMessage = error.response?.data?.error || 'Registration failed';
                    set({ error: errorMessage, isLoading: false });
                    return { success: false, error: errorMessage };
                }
            },

            // Login user
            login: async (credentials) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await authAPI.login(credentials);
                    const { user, tokens } = response;
                    const { accessToken, refreshToken } = tokens;

                    get().setTokens(accessToken, refreshToken);
                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    return { success: true, user };
                } catch (error) {
                    const errorMessage = error.response?.data?.error || 'Login failed';
                    set({ error: errorMessage, isLoading: false });
                    return { success: false, error: errorMessage };
                }
            },

            // Login user with Google
            loginWithGoogle: async (idToken) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await authAPI.googleLogin(idToken);
                    const { user, tokens } = response;
                    const { accessToken, refreshToken } = tokens;

                    get().setTokens(accessToken, refreshToken);
                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    return { success: true, user };
                } catch (error) {
                    const errorMessage = error.response?.data?.error || 'Google login failed';
                    set({ error: errorMessage, isLoading: false });
                    return { success: false, error: errorMessage };
                }
            },

            // Logout user
            logout: () => {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            // Update user profile
            updateProfile: async (data) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await userAPI.updateProfile(data);
                    set({
                        user: response.user,
                        isLoading: false,
                    });
                    return { success: true, user: response.user };
                } catch (error) {
                    const errorMessage = error.response?.data?.error || 'Update failed';
                    set({ error: errorMessage, isLoading: false });
                    return { success: false, error: errorMessage };
                }
            },

            // Fetch current user profile
            fetchProfile: async () => {
                set({ isLoading: true, error: null });
                try {
                    const response = await userAPI.getProfile();
                    set({
                        user: response.user,
                        isLoading: false,
                    });
                    return { success: true, user: response.user };
                } catch (error) {
                    const errorMessage = error.response?.data?.error || 'Failed to fetch profile';
                    set({ error: errorMessage, isLoading: false });
                    return { success: false, error: errorMessage };
                }
            },

            // Update online status
            updateStatus: async (isOnline) => {
                try {
                    await userAPI.updateStatus(isOnline);
                    set((state) => ({
                        user: state.user ? { ...state.user, isOnline } : null,
                    }));
                } catch (error) {
                    console.error('Failed to update status:', error);
                }
            },

            // Clear error
            clearError: () => set({ error: null }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

export default useAuthStore;
