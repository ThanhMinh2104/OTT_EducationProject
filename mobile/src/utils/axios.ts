import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const axiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
});

// Request interceptor để tự động thêm token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor để xử lý errors
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const message = error.response?.data?.message || '';
      // Chỉ logout khi session thực sự không hợp lệ, không phải mọi 401
      if (
        message.includes('Phiên đăng nhập không hợp lệ') ||
        message.includes('Token không hợp lệ') ||
        message.includes('Token hết hạn') ||
        message.includes('Không có token xác thực') ||
        message.includes('Tài khoản không tồn tại') ||
        message.includes('jwt expired') ||
        message.includes('invalid token')
      ) {
        try {
          await AsyncStorage.clear();
        } catch (e) {
          console.error('Error clearing storage:', e);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
