import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';

// Kiểm tra mật khẩu: tối thiểu 8 ký tự, phải có cả chữ và số
const isValidPassword = (p: string): boolean =>
  /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(p);

// Component icon mắt để ẩn/hiện mật khẩu
const EyeIcon = ({ visible }: { visible: boolean }) => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    {visible ? (
      // Icon mắt gạch (đang hiện mật khẩu)
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    ) : (
      // Icon mắt (đang ẩn mật khẩu)
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    )}
  </svg>
);

const ConfirmPassword = () => {
  const navigate = useNavigate();

  // Lấy SĐT từ sessionStorage (được lưu ở bước ForgotPassword)
  const sdt = sessionStorage.getItem('resetSdt') || '';

  const [matKhauMoi, setMatKhauMoi] = useState('');
  const [xacNhanMatKhau, setXacNhanMatKhau] = useState('');
  const [showNew, setShowNew] = useState(false);       // Trạng thái ẩn/hiện mật khẩu mới
  const [showConfirm, setShowConfirm] = useState(false); // Trạng thái ẩn/hiện xác nhận mật khẩu
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State cho Modal thông báo thành công
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Xử lý đếm ngược khi Modal hiện lên
  useEffect(() => {
    if (showSuccessModal) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleGoToLogin();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showSuccessModal]);

  const handleGoToLogin = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowSuccessModal(false);
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Kiểm tra định dạng mật khẩu mới
    if (!isValidPassword(matKhauMoi)) {
      setError('Mật khẩu tối thiểu 8 ký tự, phải bao gồm cả chữ cái và chữ số!');
      return;
    }

    // Kiểm tra hai mật khẩu có khớp nhau không
    if (matKhauMoi !== xacNhanMatKhau) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    setIsLoading(true);
    try {
      const res = await axiosInstance.post('/users/doimatkhau', {
        sdt,
        matKhauMoi,
      });

      if (res.status === 200) {
        sessionStorage.removeItem('resetSdt');
        sessionStorage.removeItem('resetEmail');
        setShowSuccessModal(true);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Đổi mật khẩu thất bại, vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-50 via-white to-primary-100">

      {/* ===== Cột trái - Branding (ẩn trên mobile) ===== */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Nền gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700" />

        {/* Hình tròn trang trí */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 animate-float" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/10 animate-float [animation-delay:2s]" />
        <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-white/10 animate-float [animation-delay:4s]" />

        {/* Nội dung cột trái */}
        <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full">
          <div className="max-w-md animate-slide-in-left">
            {/* Icon chìa khóa */}
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
                </svg>
              </div>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
              OTT
              <span className="block text-accent-400">Education</span>
            </h1>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed">
              Tạo mật khẩu mới mạnh để bảo vệ tài khoản của bạn tốt hơn.
            </p>

            {/* Các gợi ý tạo mật khẩu mạnh */}
            <div className="space-y-4">
              {[
                { icon: '✅', text: 'Tối thiểu 8 ký tự' },
                { icon: '✅', text: 'Kết hợp chữ cái và chữ số' },
                { icon: '✅', text: 'Không dùng thông tin cá nhân' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 transition-all duration-300 hover:bg-white/20 hover:translate-x-1 animate-slide-in-left"
                  style={{ animationDelay: `${0.2 + i * 0.1}s`, opacity: 0 }}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <span className="text-white/90 text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Cột phải - Form đặt mật khẩu mới ===== */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in-up">

          {/* Logo hiển thị trên mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">OTT Education</h2>
          </div>

          {/* Card chứa form */}
          <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10 animate-pulse-glow">

            {/* Tiêu đề form */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                Đặt mật khẩu mới
              </h2>
              <p className="text-gray-400 text-sm">
                Nhập mật khẩu mới cho tài khoản của bạn
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Trường mật khẩu mới */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  {/* Icon khóa bên trái */}
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <input
                    id="new-password-input"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu mới"
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                    value={matKhauMoi}
                    onChange={(e) => setMatKhauMoi(e.target.value)}
                  />
                  {/* Nút ẩn/hiện mật khẩu bên phải */}
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    <EyeIcon visible={showNew} />
                  </button>
                </div>
              </div>

              {/* Trường xác nhận mật khẩu */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  {/* Icon khóa bên trái */}
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <input
                    id="confirm-password-input"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                    value={xacNhanMatKhau}
                    onChange={(e) => setXacNhanMatKhau(e.target.value)}
                  />
                  {/* Nút ẩn/hiện xác nhận mật khẩu */}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    <EyeIcon visible={showConfirm} />
                  </button>
                </div>
              </div>

              {/* Hiển thị lỗi nếu có */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-fade-in-up">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Nút xác nhận đổi mật khẩu */}
              <button
                id="confirm-password-btn"
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary-300/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary-400/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang xử lý...
                  </span>
                ) : 'Xác nhận đổi mật khẩu'}
              </button>
            </form>

            {/* Link quay lại bước trước */}
            <div className="text-center mt-6">
              <button
                id="back-to-verify-btn"
                onClick={() => navigate('/verify-code')}
                className="text-gray-400 hover:text-gray-600 text-sm transition-colors cursor-pointer"
              >
                ← Quay lại
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-400 text-xs mt-8">
            © 2025 OTT Education. All rights reserved.
          </p>
        </div>
      </div>

      {/* MODAL THÔNG BÁO THÀNH CÔNG (WEB) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-10 max-w-sm w-full shadow-2xl animate-fade-in-up text-center border border-primary-50">
            {/* Icon thành công */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-3">Thành công!</h3>
            <p className="text-gray-500 text-[15px] leading-relaxed mb-6">
              Mật khẩu của bạn đã được thay đổi. Hệ thống sẽ tự động chuyển hướng sau:
            </p>

            {/* Bộ đếm ngược */}
            <div className="text-4xl font-extrabold text-primary-500 mb-8 bg-primary-50 w-20 h-20 flex items-center justify-center rounded-full mx-auto border-2 border-primary-100">
              {countdown}
            </div>

            <button
              onClick={handleGoToLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.98] cursor-pointer"
            >
              Đăng nhập ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmPassword;
