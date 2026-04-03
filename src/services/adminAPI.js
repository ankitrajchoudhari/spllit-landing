import axios from 'axios';
import { API_BASE_URL } from '../config/backendUrl';

const API_URL = API_BASE_URL;

const getAdminToken = () => localStorage.getItem('adminToken') || localStorage.getItem('accessToken');

const adminAPI = axios.create({
  baseURL: `${API_URL}/admin`,
  headers: { 'Content-Type': 'application/json' }
});

// Subadmin API (uses different base URL)
const subadminAPI = axios.create({
  baseURL: `${API_URL}/subadmin`,
  headers: { 'Content-Type': 'application/json' }
});

adminAPI.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

subadminAPI.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchStats = () => adminAPI.get('/stats');
export const fetchUsers = (page = 1) => adminAPI.get(`/users?page=${page}`);
export const fetchRides = (page = 1) => adminAPI.get(`/rides?page=${page}`);
export const fetchMatches = (page = 1) => adminAPI.get(`/matches?page=${page}`);
export const fetchAdmins = () => subadminAPI.get('/list');
export const createAdmin = (data) => subadminAPI.post('/create', data);
export const deactivateAdmin = (id) => subadminAPI.put(`/${id}/deactivate`);
export const activateAdmin = (id) => subadminAPI.put(`/${id}/activate`);
export const resetAdminPassword = (id, password) => subadminAPI.put(`/${id}/reset-password`, { password });
export const deleteAdmin = (id) => subadminAPI.delete(`/${id}`);
export const fetchChartData = () => adminAPI.get('/chart-data');

export default adminAPI;
