import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../utils/firebase';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const SignUpScreen = () => {
  const navigate = useNavigate();
  const [sdt, setSDT] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    setEnabled(phoneRegex.test(sdt));
  }, [sdt]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((p) => p - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
      });
    }
  };

  // Chuyển SĐT Việt Nam sang định dạng E.164
  const toE164 = (phone: string) => {
    if (phone.startsWith('0')) return '+84' + phone.slice(1);
    return phone;
  };

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      setError('');

      // Kiểm tra SĐT đã tồn tại chưa
      const responseSDT = await axios.post('http://localhost:5000/api/users/checksdt', { sdt });
      if (responseSDT.data.exists) {
        setError('Số điện thoại đã được đăng ký!');
        toast.error('Số điện thoại đã được đăng ký!', { duration: 3000, position: 'top-center' });
        return;
      }

      setupRecaptcha();
      const phoneE164 = toE164(sdt);
      const confirmation = await signInWithPhoneNumber(auth, phoneE164, window.recaptchaVerifier!);
      confirmationRef.current = confirmation;

      setStep('otp');
      setResendTimer(60);
      toast.success('Mã OTP đã được gửi đến số điện thoại của bạn! 📱', {
        duration: 3000,
        position: 'top-center',
      });
    } catch (err: any) {
      console.error(err);
      // Reset recaptcha nếu lỗi
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
      if (err.code === 'auth/too-many-requests') {
        setError('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Số điện thoại không hợp lệ.');
      } else {
        setError('Có lỗi xảy ra: ' + (err.message || 'Vui lòng thử lại'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số');
      return;
    }
    if (!confirmationRef.current) {
      setError('Phiên xác thực hết hạn, vui lòng gửi lại OTP');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const result = await confirmationRef.current.confirm(otp);
      const idToken = await result.user.getIdToken();

      // Verify với backend để lấy sdt chuẩn hóa
      const res = await axios.post('http://localhost:5000/api/verify-firebase-phone', { idToken });
      if (res.data.verified) {
        toast.success('Xác thực thành công! 🎉', { duration: 2000, position: 'top-center' });
        setTimeout(() => navigate('/signup-info', { state: { sdt: res.data.sdt } }), 800);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-verification-code') {
        setError('Mã OTP không chính xác');
      } else if (err.code === 'auth/code-expired') {
        setError('Mã OTP đã hết hạn, vui lòng gửi lại');
      } else {
        setError('Có lỗi xảy ra, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setLoading(true);
      setError('');
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
      setupRecaptcha();
      const phoneE164 = toE164(sdt);
      const confirmation = await signInWithPhoneNumber(auth, phoneE164, window.recaptchaVerifier!);
      confirmationRef.current = confirmation;
      setResendTimer(60);
      toast.success('Đã gửi lại mã OTP! 📱', { duration: 2000, position: 'top-center' });
    } catch (err: any) {
      setError('Không thể gửi lại OTP, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster />
      {/* Invisible recaptcha container */}
      <div id="recaptcha-container" />

      <div className="min-h-screen flex bg-linear-to-br from-primary-50 via-white to-primary-100">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-br from-primary-400 via-primary-500 to-primary-700" />
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/10 animate-float" />
          <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-white/10 animate-float [animation-delay:2s]" />
          <div className="absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-white/10 animate-float [animation-delay:4s]" />

          <div className="relative z-10 flex flex-col justify-center items-center px-12 xl:px-20 w-full">
            <div className="max-w-md animate-slide-in-left">
              <div className="mb-8">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                </div>
              </div>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                Tham gia
                <span className="block text-accent-400">OTT Education</span>
              </h1>
              <p className="text-primary-100 text-lg mb-10 leading-relaxed">
                Đăng ký bằng số điện thoại — nhanh chóng và bảo mật.
              </p>
              <div className="space-y-4">
                {[
                  { icon: '📱', text: 'Xác thực qua SMS OTP' },
                  { icon: '🔒', text: 'Bảo mật thông tin cá nhân' },
                  { icon: '🎓', text: 'Kết nối với cộng đồng giáo dục' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                    <span className="text-xl shrink-0">{feature.icon}</span>
                    <span className="text-white/90 text-sm font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md animate-fade-in-up">
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-linear-to-br from-primary-400 to-primary-600 rounded-2xl mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">OTT Education</h2>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Đăng ký</h2>
                <p className="text-gray-400 text-sm">
                  {step === 'phone' ? 'Nhập số điện thoại để nhận mã OTP' : `Nhập mã OTP đã gửi đến ${sdt}`}
                </p>
              </div>

              <div className="space-y-5">
                {step === 'phone' ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Số điện thoại</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Nhập số điện thoại (VD: 0912345678)"
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300"
                        value={sdt}
                        onChange={(e) => setSDT(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mã OTP</label>
                    <input
                      type="text"
                      placeholder="● ● ● ● ● ●"
                      maxLength={6}
                      className="w-full text-center text-3xl py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    />
                    <div className="text-center mt-3">
                      {resendTimer > 0 ? (
                        <span className="text-gray-400 text-sm">Gửi lại sau {resendTimer}s</span>
                      ) : (
                        <button
                          onClick={handleResendOtp}
                          disabled={loading}
                          className="text-primary-500 hover:text-primary-700 text-sm font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Gửi lại mã
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={step === 'phone' ? handleSendOtp : handleVerifyOtp}
                  disabled={(step === 'phone' ? !enabled : otp.length !== 6) || loading}
                  className="w-full bg-linear-to-r from-primary-400 via-primary-500 to-primary-600 text-white py-3.5 rounded-xl font-semibold text-sm shadow-lg shadow-primary-300/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Đang xử lý...
                    </span>
                  ) : step === 'phone' ? 'Gửi mã OTP' : 'Xác nhận'}
                </button>

                {step === 'otp' && (
                  <button
                    onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                    className="w-full text-gray-400 text-sm hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    ← Thay đổi số điện thoại
                  </button>
                )}
              </div>

              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-200" />
                <span className="px-4 text-xs text-gray-400 uppercase tracking-wider">hoặc</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  Bạn đã có tài khoản?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-primary-500 hover:text-primary-700 font-semibold transition-colors hover:underline underline-offset-2 cursor-pointer"
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
