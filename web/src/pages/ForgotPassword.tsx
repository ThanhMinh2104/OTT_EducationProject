import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Kiểm tra định dạng số điện thoại Việt Nam
const isValidPhone = (p: string): boolean => /^(0[35789])[0-9]{8}$/.test(p);

// Kiểm tra định dạng email
const isValidEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [sdt, setSdt] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate đầu vào phía client
    if (!isValidPhone(sdt)) {
      setError('Số điện thoại không hợp lệ! (Bắt đầu 03, 05, 07, 08, 09 và có 10 chữ số)');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Địa chỉ email không hợp lệ!');
      return;
    }

    setIsLoading(true);
    try {
      // Bước 1: Kiểm tra SĐT có tồn tại trong hệ thống không
      const checkRes = await axios.post('http://localhost:5000/api/users/checksdt', { sdt });
      if (!checkRes.data.exists) {
        setError('Số điện thoại chưa được đăng ký trong hệ thống!');
        return;
      }

      // Bước 2: Gửi mã OTP về email người dùng vừa nhập
      await axios.post('http://localhost:5000/api/send-otp', { email });

      // Lưu tạm SĐT và email vào sessionStorage để dùng ở các bước tiếp theo
      sessionStorage.setItem('resetSdt', sdt);
      sessionStorage.setItem('resetEmail', email);

      // Chuyển sang màn xác thực OTP
      navigate('/verify-code');
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-50 via-white to-primary-100">

      {/* ===== Cột trái - Branding (ẩn trên mobile) ===== */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Nền gradient chính */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700" />

        {/* Các hình tròn trang trí nền */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 animate-float" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/10 animate-float [animation-delay:2s]" />
        <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-white/10 animate-float [animation-delay:4s]" />

        {/* Nội dung cột trái */}
        <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full">
          <div className="max-w-md animate-slide-in-left">
            {/* Icon khóa */}
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
            </div>

            {/* Tiêu đề thương hiệu */}
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
              OTT
              <span className="block text-accent-400">Education</span>
            </h1>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed">
              Khôi phục tài khoản của bạn nhanh chóng và an toàn.
            </p>

            {/* Danh sách gợi ý */}
            <div className="space-y-4">
              {[
                { icon: '🔐', text: 'Bảo mật tài khoản hai lớp' },
                { icon: '📧', text: 'Xác thực OTP qua email' },
                { icon: '🔑', text: 'Đặt lại mật khẩu an toàn' },
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

      {/* ===== Cột phải - Form quên mật khẩu ===== */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in-up">

          {/* Logo hiển thị trên mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">OTT Education</h2>
          </div>

          {/* Card chứa form */}
          <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10 animate-pulse-glow">

            {/* Tiêu đề form */}
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Quên mật khẩu</h2>
              <p className="text-gray-400 text-sm">Nhập SĐT và email để nhận mã xác thực OTP</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Trường nhập số điện thoại */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Số điện thoại
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                    </svg>
                  </div>
                  <input
                    id="forgot-phone-input"
                    type="text"
                    placeholder="Nhập số điện thoại đã đăng ký"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                    value={sdt}
                    onChange={(e) => setSdt(e.target.value)}
                  />
                </div>
              </div>

              {/* Trường nhập email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    id="forgot-email-input"
                    type="email"
                    placeholder="Nhập email đã đăng ký"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
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

              {/* Nút gửi OTP */}
              <button
                id="forgot-submit-btn"
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
                    Đang gửi...
                  </span>
                ) : 'Gửi mã OTP'}
              </button>
            </form>

            {/* Link quay lại đăng nhập */}
            <div className="text-center mt-6">
              <button
                id="back-to-login-btn"
                onClick={() => navigate('/login')}
                className="text-primary-500 hover:text-primary-700 text-sm font-medium transition-colors duration-200 hover:underline underline-offset-2 cursor-pointer"
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-400 text-xs mt-8">
            © 2025 OTT Education. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
