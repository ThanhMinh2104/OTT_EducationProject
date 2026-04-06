import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Kiểm tra định dạng số điện thoại Việt Nam (10 chữ số, bắt đầu 03, 05, 07, 08, 09)
const isValidPhone = (p: string): boolean => /^(0[35789])[0-9]{8}$/.test(p);

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [sdt, setSdt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate đầu vào phía client (Kiểm tra độ dài và định dạng SĐT)
    if (!isValidPhone(sdt)) {
      setError('Số điện thoại không hợp lệ! (Phải có 10 chữ số và bắt đầu bằng 03, 05, 07, 08, 09)');
      return;
    }

    setIsLoading(true);
    try {
      // Bước 1: Lấy thông tin email từ hệ thống dựa trên số điện thoại
      // (Route này đảm bảo OTP sẽ luôn được gửi đến đúng email đã đăng ký của chủ SĐT)
      const resPhone = await axios.post('http://localhost:5000/api/users/get-email-by-phone', { sdt });
      const email = resPhone.data.email;

      // Bước 2: Gửi mã OTP về email lấy được từ hệ thống
      await axios.post('http://localhost:5000/api/send-otp', { email });

      // Lưu tạm SĐT và email vào sessionStorage để dùng cho các bước xác thực sau
      sessionStorage.setItem('resetSdt', sdt);
      sessionStorage.setItem('resetEmail', email);

      // Chuyển sang màn xác thực OTP
      navigate('/verify-code');
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setError('Số điện thoại chưa được đăng ký trong hệ thống!');
      } else {
        setError('Có lỗi xảy ra trong quá trình xử lý, vui lòng thử lại!');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-50 via-white to-primary-100">
      
      {/* ===== Cột trái - Branding (ẩn trên mobile) ===== */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700" />
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 animate-float" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/10 animate-float [animation-delay:2s]" />
        <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-white/10 animate-float [animation-delay:4s]" />
        
        <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full text-white">
          <div className="max-w-md animate-slide-in-left">
            <h1 className="text-4xl xl:text-5xl font-extrabold mb-4 leading-tight">
              OTT<span className="text-accent-400">Education</span>
            </h1>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed">
              Bạn mất mật khẩu? Đừng lo lắng, chúng tôi sẽ hỗ trợ khôi phục tài khoản cho bạn chỉ trong vài phút.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <span className="text-xl">📱</span>
                <span className="text-white/90 text-sm font-medium">Xác thực qua mã OTP</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                <span className="text-xl">📧</span>
                <span className="text-white/90 text-sm font-medium">OTP sẽ gửi tới email đã đăng ký</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Cột phải - Form quên mật khẩu ===== */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in-up text-center lg:text-left">
          
          {/* Logo mobile */}
          <div className="lg:hidden mb-8">
            <h2 className="text-3xl font-extrabold text-primary-500">OTT Education</h2>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-primary-100/50 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Quên mật khẩu?</h2>
              <p className="text-gray-400 text-sm">Hệ thống sẽ gửi mã OTP đến email của bạn.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Trường nhập số điện thoại - Chỉ cho phép nhập số */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 text-left">
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
                    maxLength={10}
                    placeholder="VD: 0912345678"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                    value={sdt}
                    // THAY ĐỔI: Chỉ cho phép nhập các chữ số (digits only)
                    onChange={(e) => setSdt(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              {/* Thông báo lỗi */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-fade-in-up">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span className="text-left">{error}</span>
                </div>
              )}

              {/* Nút gửi yêu cầu */}
              <button
                id="forgot-submit-btn"
                type="submit"
                disabled={isLoading || !sdt}
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
                ) : 'Gửi mã xác thực'}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                id="back-to-login-btn"
                onClick={() => navigate('/login')}
                className="text-primary-500 hover:text-primary-700 text-sm font-medium transition-colors hover:underline cursor-pointer"
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
