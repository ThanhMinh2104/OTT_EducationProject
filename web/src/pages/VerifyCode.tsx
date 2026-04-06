import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const VerifyCode = () => {
  const navigate = useNavigate();

  // Lấy email từ sessionStorage (được lưu ở bước ForgotPassword)
  const email = sessionStorage.getItem('resetEmail') || '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Kiểm tra OTP phải đúng 6 chữ số
    if (!/^\d{6}$/.test(otp)) {
      setError('Mã OTP phải gồm đúng 6 chữ số!');
      return;
    }

    setIsLoading(true);
    try {
      // Gọi API xác thực mã OTP
      const res = await axios.post('http://localhost:5000/api/verify-otp', { email, otp });

      if (res.data.verified) {
        toast.success('Xác thực OTP thành công! ✅', {
          duration: 2000,
          position: 'top-center',
          style: { background: '#10b981', color: '#fff', fontWeight: '600', padding: '16px', borderRadius: '12px' },
          iconTheme: { primary: '#fff', secondary: '#10b981' },
        });
        setTimeout(() => navigate('/confirm-password'), 1000);
      } else {
        setError('Mã OTP không đúng hoặc đã hết hạn!');
        toast.error('Mã OTP không đúng hoặc đã hết hạn!', {
          duration: 3000,
          position: 'top-center',
          style: { background: '#ef4444', color: '#fff', fontWeight: '600', padding: '16px', borderRadius: '12px' },
        });
      }
    } catch {
      setError('Có lỗi xảy ra, vui lòng thử lại!');
      toast.error('Có lỗi xảy ra, vui lòng thử lại!', {
        duration: 3000,
        position: 'top-center',
        style: { background: '#ef4444', color: '#fff', fontWeight: '600', padding: '16px', borderRadius: '12px' },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    setResendSuccess(false);
    try {
      // Gửi lại OTP về email đã lưu
      await axios.post('http://localhost:5000/api/send-otp', { email });
      setResendSuccess(true);
      toast.success('Đã gửi lại mã OTP thành công! 📧', {
        duration: 3000,
        position: 'top-center',
        style: { background: '#10b981', color: '#fff', fontWeight: '600', padding: '16px', borderRadius: '12px' },
      });
    } catch {
      setError('Gửi lại OTP thất bại, vui lòng thử lại!');
      toast.error('Gửi lại OTP thất bại!', {
        duration: 3000,
        position: 'top-center',
        style: { background: '#ef4444', color: '#fff', fontWeight: '600', padding: '16px', borderRadius: '12px' },
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <Toaster />
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
            {/* Icon khiên bảo mật */}
            <div className="mb-8">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
              OTT
              <span className="block text-accent-400">Education</span>
            </h1>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed">
              Nhập mã OTP để xác minh danh tính và tiếp tục đặt lại mật khẩu.
            </p>

            <div className="space-y-4">
              {[
                { icon: '📨', text: 'Mã OTP có hiệu lực trong 5 phút' },
                { icon: '🔒', text: 'Không chia sẻ mã này với ai' },
                { icon: '🔄', text: 'Có thể gửi lại nếu không nhận được' },
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

      {/* ===== Cột phải - Form nhập OTP ===== */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in-up">

          {/* Logo hiển thị trên mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">OTT Education</h2>
          </div>

          {/* Card chứa form */}
          <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10 animate-pulse-glow">

            {/* Tiêu đề + email hiển thị */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-50 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Xác thực OTP</h2>
              <p className="text-gray-400 text-sm">
                Mã xác thực đã được gửi đến email
              </p>
              {/* Hiển thị email người dùng đã nhập */}
              <p className="text-primary-500 font-semibold text-sm mt-1">{email}</p>
            </div>

            <form onSubmit={handleVerify} className="space-y-5">

              {/* Ô nhập mã OTP - căn giữa, khoảng cách rộng */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mã OTP (6 chữ số)
                </label>
                <input
                  id="otp-reset-input"
                  type="text"
                  maxLength={6}
                  placeholder="● ● ● ● ● ●"
                  className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-xl text-center tracking-[0.5em] placeholder-gray-300 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                  value={otp}
                  // Chỉ cho phép nhập chữ số
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {/* Hiển thị thông báo gửi lại thành công */}
              {resendSuccess && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>Đã gửi lại mã OTP thành công!</span>
                </div>
              )}

              {/* Hiển thị lỗi nếu có */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-fade-in-up">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Nút xác nhận OTP */}
              <button
                id="verify-otp-reset-btn"
                type="submit"
                disabled={isLoading || otp.length < 6}
                className="w-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary-300/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary-400/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang xác thực...
                  </span>
                ) : 'Xác nhận'}
              </button>
            </form>

            {/* Gửi lại OTP và quay lại */}
            <div className="text-center mt-6 space-y-3">
              <button
                id="resend-otp-btn"
                onClick={handleResend}
                disabled={isResending}
                className="text-primary-500 hover:text-primary-700 text-sm font-medium transition-colors duration-200 hover:underline underline-offset-2 disabled:opacity-50 cursor-pointer"
              >
                {isResending ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
              </button>
              <br />
              <button
                id="back-to-forgot-btn"
                onClick={() => navigate('/forgot-password')}
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
    </div>
    </>
  );
};

export default VerifyCode;
