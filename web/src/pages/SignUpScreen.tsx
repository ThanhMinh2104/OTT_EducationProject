import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import toast, { Toaster } from 'react-hot-toast';

const SignUpScreen = () => {
  const navigate = useNavigate();
  const [sdt, setSDT] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setError('');
      // Kiểm tra SĐT đã tồn tại chưa
      const responseSDT = await axiosInstance.post('/users/checksdt', { sdt });
      if (responseSDT.data.exists) {
        setError('Số điện thoại đã được đăng ký!');
        toast.error('Số điện thoại đã được đăng ký!', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#ef4444',
            color: '#fff',
            fontWeight: '600',
            padding: '16px',
            borderRadius: '12px',
          },
        });
        return;
      }

      // Gửi OTP qua SMS (InfiniReach)
      await axiosInstance.post('/send-otp-sms', { sdt });
      toast.success('Mã OTP đã được gửi qua SMS!', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '600',
          padding: '16px',
          borderRadius: '12px',
        },
      });
      setTimeout(() => navigate('/verify-otp', { state: { sdt } }), 1000);
    } catch (_err: any) {
      const errorMsg =
        _err?.response?.data?.error ||
        _err?.response?.data?.message ||
        _err?.message ||
        'Có lỗi xảy ra';
      setError('Có lỗi: ' + errorMsg);
      toast.error(errorMsg, {
        duration: 4000,
        position: 'top-center',
        style: {
          background: '#ef4444',
          color: '#fff',
          fontWeight: '600',
          padding: '16px',
          borderRadius: '12px',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    setEnabled(phoneRegex.test(sdt));
  }, [sdt]);

  return (
    <>
      <Toaster />
      <div className="min-h-screen flex bg-linear-to-br from-primary-50 via-white to-primary-100">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary-400 via-primary-500 to-primary-700" />

        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 animate-float" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/10 animate-float [animation-delay:2s]" />
        <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-white/10 animate-float [animation-delay:4s]" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full bg-accent-400/20 animate-float [animation-delay:3s]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full">
          <div className="max-w-md animate-slide-in-left">
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
                    d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
              Tham gia
              <span className="block text-accent-400">OTT Education</span>
            </h1>
            <p className="text-primary-100 text-lg mb-10 leading-relaxed">
              Tạo tài khoản để bắt đầu hành trình học tập và kết nối cùng bạn bè, giảng viên.
            </p>

            <div className="space-y-4">
              {[
                { icon: '🚀', text: 'Đăng ký nhanh chóng, dễ dàng' },
                { icon: '🔒', text: 'Bảo mật thông tin cá nhân' },
                { icon: '🎓', text: 'Kết nối với cộng đồng giáo dục' },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 transition-all duration-300 hover:bg-white/20 hover:translate-x-1 animate-slide-in-left"
                  style={{ animationDelay: `${0.2 + i * 0.1}s`, opacity: 0 }}
                >
                  <span className="text-xl shrink-0">{feature.icon}</span>
                  <span className="text-white/90 text-sm font-medium">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-linear-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg">
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
                  d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">OTT Education</h2>
          </div>

          {/* Signup Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10 animate-pulse-glow">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Đăng ký</h2>
              <p className="text-gray-400 text-sm">Tạo tài khoản mới để bắt đầu 🎉</p>
            </div>

            <div className="space-y-5">
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
                    onChange={(e) => setSDT(e.target.value)}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm animate-fade-in-up">
                  <svg
                    className="w-5 h-5 shrink-0"
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

              {/* Submit */}
              <button
                id="signup-button"
                onClick={handleSignUp}
                disabled={!enabled || loading}
                className="w-full bg-linear-to-r from-primary-400 via-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary-300/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary-400/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg cursor-pointer"
              >
                {loading ? (
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
                    Đang xử lý...
                  </span>
                ) : (
                  'Tiếp tục'
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-4 text-xs text-gray-400 uppercase tracking-wider">hoặc</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Login link */}
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Bạn đã có tài khoản?{' '}
                <button
                  id="login-link"
                  onClick={() => navigate('/login')}
                  className="text-primary-500 hover:text-primary-700 font-semibold transition-colors duration-200 hover:underline underline-offset-2 cursor-pointer"
                >
                  Đăng nhập
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-gray-400 text-xs mt-8">
            © 2025 OTT Education. All rights reserved.
          </p>
        </div>
      </div>
    </div>
    </>
  );
};

export default SignUpScreen;
