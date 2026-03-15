const DEFAULT_API_BASE_URL = 'https://srv-d6o6nji4d50c73fdl27g.onrender.com/api';

const normalizeApiUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return DEFAULT_API_BASE_URL;
  }

  let url = value.trim();
  if (!url) {
    return DEFAULT_API_BASE_URL;
  }

  if (url.includes('railway.app')) {
    return DEFAULT_API_BASE_URL;
  }

  url = url.replace(/\/$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }

  return url;
};

export const API_BASE_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);
export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');
