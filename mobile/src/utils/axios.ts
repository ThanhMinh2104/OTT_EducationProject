import axios from 'axios';
import { API_URL } from './config';

const axiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
});

// Request interceptor để tự động thêm token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage?.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor để xử lý errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage?.clear();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
