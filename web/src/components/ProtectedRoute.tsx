import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../utils/auth';
import axiosInstance from '../utils/axios';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      // Kiểm tra xem có user trong storage không
      const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          if (userData && userData.userID) {
            // Đảm bảo user có trong cả 2 storage
            sessionStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('user', JSON.stringify(userData));
            setIsAuthenticated(true);
            return;
          }
        } catch (err) {
          console.error('Failed to parse stored user:', err);
        }
      }

      // Nếu không có user, thử fetch từ API
      try {
        const response = await axiosInstance.get('/auth/me');
        if (response.data && response.data.userID) {
          const userData = response.data;
          sessionStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('user', JSON.stringify(userData));
          setIsAuthenticated(true);
          return;
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      }

      setIsAuthenticated(false);
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
