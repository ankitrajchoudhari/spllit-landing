import axios from 'axios';
import { API_BASE_URL } from '../config/backendUrl';

const API_URL = API_BASE_URL;

// Create axios instance with default config
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false,
});

// Request interceptor to add token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                const response = await axios.post(`${API_URL}/auth/refresh`, {
                    refreshToken,
                });

                const { accessToken } = response.data;
                localStorage.setItem('accessToken', accessToken);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed, logout user
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// ============ AUTH API ============

export const authAPI = {
    // Register new user
    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        return response.data;
    },

    // Login user
    login: async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },

    // Login user with Google id token
    googleLogin: async (idToken) => {
        const response = await api.post('/auth/google', { idToken });
        return response.data;
    },

    // Refresh access token
    refreshToken: async (refreshToken) => {
        const response = await api.post('/auth/refresh', { refreshToken });
        return response.data;
    },
};

// ============ USER API ============

export const userAPI = {
    // Get user profile
    getProfile: async () => {
        const response = await api.get('/users/me');
        return response.data;
    },

    // Update user profile
    updateProfile: async (data) => {
        const response = await api.put('/users/me', data);
        return response.data;
    },

    // Update online status
    updateStatus: async (isOnline) => {
        const response = await api.patch('/users/status', { isOnline });
        return response.data;
    },
};

// ============ RIDES API ============

export const ridesAPI = {
    // Create a new ride request
    createRide: async (rideData) => {
        const response = await api.post('/rides', rideData);
        return response.data;
    },

    // Search for matching rides
    searchRides: async (searchParams) => {
        const response = await api.get('/rides/search', { params: searchParams });
        return response.data;
    },

    // Get all available rides (simpler endpoint)
    getAvailableRides: async () => {
        const response = await api.get('/rides/available');
        return response.data;
    },

    // Get user's rides
    getMyRides: async () => {
        const response = await api.get('/rides/my');
        return response.data;
    },

    // Get ride by ID
    getRideById: async (rideId) => {
        const response = await api.get(`/rides/${rideId}`);
        return response.data;
    },

    // Get recent ride announcements for the dashboard bell
    getAnnouncements: async () => {
        const response = await api.get('/rides/announcements');
        return response.data;
    },

    // Update ride
    updateRide: async (rideId, data) => {
        const response = await api.put(`/rides/${rideId}`, data);
        return response.data;
    },

    // Delete ride
    deleteRide: async (rideId) => {
        const response = await api.delete(`/rides/${rideId}`);
        return response.data;
    },
};

// ============ MATCHES API ============

export const matchesAPI = {
    // Create a new match request
    createMatch: async (rideId) => {
        const response = await api.post('/matches', { rideId });
        return response.data;
    },

    // Get all matches for current user
    getMyMatches: async () => {
        const response = await api.get('/matches/my');
        return response.data;
    },

    // Accept a match
    acceptMatch: async (matchId) => {
        const response = await api.post(`/matches/${matchId}/accept`);
        return response.data;
    },

    // Reject a match
    rejectMatch: async (matchId) => {
        const response = await api.post(`/matches/${matchId}/reject`);
        return response.data;
    },

    // Get messages for a match
    getMessages: async (matchId) => {
        const response = await api.get(`/matches/${matchId}/messages`);
        return response.data;
    },

    // Send a message
    sendMessage: async (matchId, content) => {
        const response = await api.post(`/matches/${matchId}/messages`, { content });
        return response.data;
    },

    // Edit a message
    editMessage: async (matchId, messageId, content) => {
        const response = await api.put(`/matches/${matchId}/messages/${messageId}`, { content });
        return response.data;
    },

    // Delete a message
    deleteMessage: async (matchId, messageId) => {
        const response = await api.delete(`/matches/${matchId}/messages/${messageId}`);
        return response.data;
    },

    // Block a user
    blockUser: async (userId, reason) => {
        const response = await api.post('/matches/block', { userId, reason });
        return response.data;
    },
};

// ============ EARLY ACCESS API ============

export const earlyAccessAPI = {
    register: async (data) => {
        const response = await api.post('/early-access', data);
        return response.data;
    },
    checkStatus: async (email) => {
        const encodedEmail = encodeURIComponent(email);
        const response = await api.get(`/early-access/status/${encodedEmail}`);
        return response.data;
    },
};

export default api;
