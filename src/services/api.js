import axios from 'axios';

// In Electron desktop mode, use local server on port 9876
// In web mode, use the Spring Boot backend
const isElectron = typeof window !== 'undefined' && window.location &&
    (window.location.protocol === 'file:' || !!window.electronAPI);

export const BASE_URL = isElectron
    ? 'http://localhost:9876'
    : (import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8080`);

const api = axios.create({
    baseURL: BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
