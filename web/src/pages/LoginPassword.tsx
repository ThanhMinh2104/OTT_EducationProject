import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import toast, { Toaster } from 'react-hot-toast';

// Không cần tạo socket mới nữa, đã import từ utils/socket.ts

const isValidPhoneNumber = (p: string): boolean => /^(0[35789])[0-9]{8}$/.test(p);
const isValidPassword = (p: string): boolean => /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(p);

const LoginPassword = () => {
  const navigate = useNavigate();
  const [sdt, setSDT] = useState<string>('');
  const [matKhau, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockStep, setUnlockStep] = useState<'confirm' | 'otp'>('confirm');
  const [otp, setOtp] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!isValidPhoneNumber(sdt)) {
      setError('Số điện thoại không hợp lệ! (Bắt đầu 03, 05, 07, 08, 09 và có 10 chữ số)');
      return;
    }
    if (!isValidPassword(matKhau)) {
      setError('Mật khẩu không hợp lệ! (Tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số)');
      return;
    }

    setIsLoading(true);
    try {
      // Tạo hoặc lấy deviceId từ localStorage
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `web-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('deviceId', deviceId);
      }

      const response = await axiosInstance.post('/login', {
        sdt,
        matKhau,
        deviceType: 'web',
        deviceName: navigator.userAgent.includes('Chrome')
          ? 'Chrome'
          : navigator.userAgent.includes('Firefox')
            ? 'Firefox'
            : navigator.userAgent.includes('Edge')
              ? 'Edge'
              : 'Browser',
        deviceId: deviceId,
      });
      const { token, user: loginUser } = response.data;

      sessionStorage.setItem('token', token);

      const res = await axiosInstance.post('/updateStatus', {
        userID: loginUser.userID,
        trangThai: 'online',
      });
      sessionStorage.setItem('userID', res.data.user.userID);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      socket.emit('updateStatus', res.data.user);

      // Show success toast
      toast.success(`Chào mừng ${loginUser.name}! Đăng nhập thành công 🎉`, {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '600',
          padding: '16px',
          borderRadius: '12px',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10b981',
        },
      });

      // Navigate after a short delay to show toast
      setTimeout(() => {
        navigate('/home');
      }, 1000);
    } catch (err: any) {
      // Kiểm tra nếu tài khoản bị khóa
      if (err.response?.status === 403 && err.response?.data?.isLocked) {
        const { reason, canUnlock } = err.response.data;

        // Kiểm tra xem có phải tự khóa không
        if (canUnlock) {
          setShowUnlockModal(true);
          setUnlockStep('confirm');
        } else {
          // Bị admin khóa
          toast.error(
            <div>
              <div className="font-bold">Tài khoản đã bị khóa</div>
              <div className="text-sm mt-1">Lý do: {reason}</div>
              <div className="text-xs mt-1">Vui lòng liên hệ quản trị viên</div>
            </div>,
            {
              duration: 5000,
              position: 'top-center',
              icon: '🔒',
            }
          );
        }
      } else {
        setError('Sai số điện thoại hoặc mật khẩu');
        toast.error('Đăng nhập thất bại! Vui lòng kiểm tra lại thông tin.', {
          duration: 1500,
          position: 'top-center',
          style: {
            background: '#ef4444',
            color: '#fff',
            fontWeight: '600',
            padding: '16px',
            borderRadius: '12px',
          },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendUnlockOTP = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.post('/users/unlock/send-otp', { sdt });
      setUserEmail(response.data.email);
      setUnlockStep('otp');
      toast.success('Mã OTP đã được gửi đến email của bạn');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể gửi OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyUnlockOTP = async () => {
    try {
      setIsLoading(true);
      await axiosInstance.post('/users/unlock/verify-otp', { sdt, otp });
      toast.success('Tài khoản đã được mở khóa! Bạn có thể đăng nhập lại.');
      setShowUnlockModal(false);
      setOtp('');
      setUnlockStep('confirm');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Mã OTP không đúng');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen flex bg-gradient-to-br from-primary-50 via-white to-primary-100">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700" />

          {/* Decorative circles */}
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 animate-float" />
          <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/10 animate-float [animation-delay:2s]" />
          <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-white/10 animate-float [animation-delay:4s]" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-accent-400/20 animate-float [animation-delay:3s]" />

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full">
            <div className="max-w-md animate-slide-in-left">
              {/* Logo / Icon */}
              <div className="mb-8">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <svg
                    className="w-9 h-9 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                OTT
                <span className="block text-accent-400">Education</span>
              </h1>
              <p className="text-primary-100 text-lg mb-10 leading-relaxed">
                Hệ thống nhắn tin thời gian thực cho giáo dục — kết nối giảng viên và sinh viên mọi
                lúc, mọi nơi.
              </p>

              {/* Features */}
              <div className="space-y-4">
                {[
                  { icon: '💬', text: 'Chat thời gian thực với giảng viên' },
                  { icon: '👥', text: 'Quản lý nhóm lớp học hiệu quả' },
                  { icon: '📁', text: 'Chia sẻ tài liệu và bài tập' },
                  { icon: '🤖', text: 'Tích hợp AI chatbot hỗ trợ' },
                ].map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 transition-all duration-300 hover:bg-white/20 hover:translate-x-1 animate-slide-in-left"
                    style={{ animationDelay: `${0.2 + i * 0.1}s`, opacity: 0 }}
                  >
                    <span className="text-xl flex-shrink-0">{feature.icon}</span>
                    <span className="text-white/90 text-sm font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md animate-fade-in-up">
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">OTT Education</h2>
            </div>

            {/* Login Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10 animate-pulse-glow">
              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Đăng nhập</h2>
                <p className="text-gray-400 text-sm">Chào mừng bạn quay trở lại!</p>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                        />
                      </svg>
                    </div>
                    <input
                      id="phone-input"
                      type="text"
                      placeholder="Nhập số điện thoại của bạn"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                      value={sdt}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSDT(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                        />
                      </svg>
                    </div>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Nhập mật khẩu của bạn"
                      className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                      value={matKhau}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-fade-in-up">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit button */}
                <button
                  id="login-button"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary-300/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary-400/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Đang đăng nhập...
                    </span>
                  ) : (
                    'Đăng nhập'
                  )}
                </button>
              </form>

              {/* Forgot password */}
              <div className="text-center mt-6">
                <button
                  id="forgot-password-link"
                  onClick={() => navigate('/forgot-password')}
                  className="text-primary-500 hover:text-primary-700 text-sm font-medium transition-colors duration-200 hover:underline underline-offset-2 cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-200" />
                <span className="px-4 text-xs text-gray-400 uppercase tracking-wider">hoặc</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* Signup */}
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  Chưa có tài khoản?{' '}
                  <button
                    id="signup-link"
                    onClick={() => navigate('/signup')}
                    className="text-primary-500 hover:text-primary-700 font-semibold transition-colors duration-200 hover:underline underline-offset-2 cursor-pointer"
                  >
                    Đăng ký ngay
                  </button>
                </p>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-gray-400 text-xs mt-8">
              © 2025 OTT Education. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Unlock Account Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
            {unlockStep === 'confirm' ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Tài khoản đã bị khóa</h3>
                  <p className="text-gray-600 text-sm">
                    Tài khoản của bạn đã bị vô hiệu hóa. Bạn có muốn mở lại tài khoản không?
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    Chúng tôi sẽ gửi mã OTP đến email của bạn để xác nhận.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUnlockModal(false)}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSendUnlockOTP}
                    disabled={isLoading}
                    className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Đang gửi...' : 'Mở khóa'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Xác nhận OTP</h3>
                  <p className="text-gray-600 text-sm">Mã OTP đã được gửi đến email</p>
                  <p className="text-primary-600 font-medium text-sm mt-1">{userEmail}</p>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nhập mã OTP
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập 6 chữ số"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-primary-400 focus:bg-white"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowUnlockModal(false);
                      setUnlockStep('confirm');
                      setOtp('');
                    }}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleVerifyUnlockOTP}
                    disabled={isLoading || otp.length !== 6}
                    className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Đang xác nhận...' : 'Xác nhận'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LoginPassword;
