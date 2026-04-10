import axios from 'axios';
import toast from 'react-hot-toast';

// Tạo axios instance
const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Response interceptor để xử lý 401 (Unauthorized) và 403 (Forbidden)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Xử lý tài khoản bị khóa (403)
    if (error.response?.status === 403) {
      const data = error.response?.data;
      if (data?.message?.includes('bị khóa')) {
        const reason = data.reason || 'Vi phạm điều khoản';
        toast.error(`Tài khoản đã bị khóa\nLý do: ${reason}`, {
          duration: 5000,
          position: 'top-center',
          icon: '🔒',
          style: {
            background: '#ef4444',
            color: '#fff',
            minWidth: '300px',
            whiteSpace: 'pre-line',
          },
        });

        setTimeout(() => {
          sessionStorage.clear();
          localStorage.clear();
          window.location.href = '/';
        }, 2000);
      }
      return Promise.reject(error);
    }

    // Xử lý session không hợp lệ (401)
    if (error.response?.status === 401) {
      const message = error.response?.data?.message || '';

      if (
        message.includes('Phiên đăng nhập không hợp lệ') ||
        message.includes('Token không hợp lệ')
      ) {
        toast.error('Tài khoản của bạn đã đăng nhập ở thiết bị khác', {
          duration: 3000,
          position: 'top-center',
          icon: '🔒',
        });

        setTimeout(() => {
          sessionStorage.clear();
          localStorage.clear();
          window.location.href = '/';
        }, 1000);
      }
    }
    return Promise.reject(error);
  }
);

// Request interceptor để tự động thêm token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
