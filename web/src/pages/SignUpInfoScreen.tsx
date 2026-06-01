import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import axiosInstance from '../utils/axios';

const validateName = (name: string) => /^([A-ZÀ-Ỵ][a-zà-ỹ]*)(\s[A-ZÀ-Ỵ][a-zà-ỹ]*)+$/.test(name);
const validateDateFormat = (date: string) =>
  /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d\d$/.test(date);
const validateAge = (dateString: string) => {
  if (!validateDateFormat(dateString)) return false;
  const [day, month, year] = dateString.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 18;
};
const isValidPassword = (p: string) => /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(p);

const SignUpInfoScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, sdt } = (location.state as { email: string; sdt: string }) || {};

  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [gender, setGender] = useState('Nam');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleSignUp = async () => {
    if (!name || !birth || !password || !rePassword) {
      setError('Vui lòng nhập đầy đủ thông tin!');
      return;
    }
    if (!agreeTerms) {
      setError('Bạn phải đồng ý với điều khoản sử dụng để tiếp tục!');
      return;
    }
    if (!validateName(name)) {
      setError('Họ tên không hợp lệ! Ít nhất 2 từ, mỗi từ bắt đầu chữ hoa.');
      return;
    }
    if (!validateDateFormat(birth)) {
      setError('Ngày sinh không đúng định dạng dd/mm/yyyy!');
      return;
    }
    if (!validateAge(birth)) {
      setError('Bạn phải từ 18 tuổi trở lên để đăng ký.');
      return;
    }
    if (!isValidPassword(password)) {
      setError('Mật khẩu không hợp lệ! Tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số.');
      return;
    }
    if (password !== rePassword) {
      setError('Mật khẩu không khớp!');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await axiosInstance.post('/registerUser', {
        sdt,
        name,
        ngaySinh: birth,
        matKhau: password,
        email,
        gioTinh: gender,
        dongYDieuKhoan: true,
      });
      toast.success('Đăng ký thành công! Chào mừng bạn đến với OTT Education 🎉', {
        duration: 2000,
        position: 'top-center',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: '600',
          padding: '16px',
          borderRadius: '12px',
        },
        iconTheme: { primary: '#fff', secondary: '#10b981' },
      });
      setTimeout(() => navigate('/login'), 1500);
    } catch {
      setError('Đăng ký thất bại. Vui lòng thử lại.');
      toast.error('Đăng ký thất bại! Vui lòng thử lại.', {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const valid =
      name.length > 0 &&
      birth.length > 0 &&
      password.length >= 8 &&
      rePassword.length > 0 &&
      validateName(name) &&
      validateDateFormat(birth) &&
      validateAge(birth) &&
      isValidPassword(password) &&
      password === rePassword;
    setEnabled(valid);

    if (name && !validateName(name)) setError('Họ tên không hợp lệ!');
    else if (birth && !validateDateFormat(birth))
      setError('Ngày sinh không đúng định dạng dd/mm/yyyy!');
    else if (birth && !validateAge(birth)) setError('Bạn phải từ 18 tuổi trở lên.');
    else if (password && !isValidPassword(password)) setError('Mật khẩu không hợp lệ!');
    else if (password && rePassword && password !== rePassword) setError('Mật khẩu không khớp!');
    else setError('');
  }, [name, birth, password, rePassword]);

  const inputClass =
    'w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 transition-all duration-300 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-4 focus:ring-primary-100 hover:border-gray-300';

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
                      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                    />
                  </svg>
                </div>
              </div>

              <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                Hoàn tất
                <span className="block text-accent-400">đăng ký</span>
              </h1>
              <p className="text-primary-100 text-lg mb-10 leading-relaxed">
                Chỉ thêm vài bước nữa để bạn có thể bắt đầu trải nghiệm OTT Education.
              </p>

              {/* Progress indicator */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white text-sm font-bold">
                    ✓
                  </div>
                  <span className="text-white/70 text-sm">Xác thực</span>
                </div>
                <div className="w-8 border-t border-white/30" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary-600 text-sm font-bold">
                    2
                  </div>
                  <span className="text-white text-sm font-medium">Thông tin</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Info Form */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md animate-fade-in-up">
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-6">
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
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Thông tin bổ sung</h2>
            </div>

            {/* Info Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-primary-200/50 border border-primary-100/50 p-8 sm:p-10 animate-pulse-glow">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                  Thông tin cá nhân
                </h2>
                <p className="text-gray-400 text-sm">Điền thông tin để hoàn tất đăng ký 📝</p>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tên hiển thị
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
                          d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                        />
                      </svg>
                    </div>
                    <input
                      id="name-input"
                      type="text"
                      placeholder="Nhập họ và tên"
                      className={inputClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Birthday */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ngày sinh
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
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                        />
                      </svg>
                    </div>
                    <input
                      id="birth-input"
                      type="date"
                      className={inputClass}
                      max={new Date().toISOString().split('T')[0]}
                      value={birth ? birth.split('/').reverse().join('-') : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [y, m, d] = val.split('-');
                          setBirth(`${d}/${m}/${y}`);
                        } else {
                          setBirth('');
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Giới tính
                  </label>
                  <div className="flex gap-3">
                    {['Nam', 'Nữ'].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-300 cursor-pointer ${
                          gender === g
                            ? 'bg-linear-to-r from-primary-400 to-primary-500 text-white shadow-lg shadow-primary-300/30'
                            : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        {g === 'Nam' ? '👨' : '👩'} {g}
                      </button>
                    ))}
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
                      type="password"
                      placeholder="Tối thiểu 8 ký tự, gồm chữ và số"
                      className={inputClass}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {/* Re-password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nhập lại mật khẩu
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
                          d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                        />
                      </svg>
                    </div>
                    <input
                      id="repassword-input"
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      className={inputClass}
                      value={rePassword}
                      onChange={(e) => setRePassword(e.target.value)}
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

                {/* Checkbox điều khoản */}
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="agree-terms"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-2 focus:ring-primary-400 cursor-pointer"
                  />
                  <label htmlFor="agree-terms" className="text-sm text-gray-700 cursor-pointer">
                    Tôi đồng ý với{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-primary-500 hover:text-primary-700 font-semibold underline"
                    >
                      Điều khoản sử dụng
                    </button>{' '}
                    và{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-primary-500 hover:text-primary-700 font-semibold underline"
                    >
                      Chính sách bảo mật
                    </button>
                  </label>
                </div>

                {/* Submit */}
                <button
                  id="create-account-button"
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
                      Đang tạo tài khoản...
                    </span>
                  ) : (
                    'Tạo tài khoản'
                  )}
                </button>
              </div>

              {/* Back link */}
              <div className="text-center mt-6">
                <button
                  id="back-link"
                  onClick={() => navigate('/signup')}
                  className="text-primary-500 hover:text-primary-700 text-sm font-medium transition-colors duration-200 hover:underline underline-offset-2 cursor-pointer inline-flex items-center gap-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                    />
                  </svg>
                  Quay lại
                </button>
              </div>
            </div>

            <p className="text-center text-gray-400 text-xs mt-8">
              © 2025 OTT Education. All rights reserved.
            </p>
          </div>
        </div>

        {/* Modal điều khoản */}
        {showTerms && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Điều khoản sử dụng</h3>
                <button
                  onClick={() => setShowTerms(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-gray-700 space-y-4">
                <h4 className="font-semibold text-base">1. Chấp nhận điều khoản</h4>
                <p>Bằng việc đăng ký và sử dụng dịch vụ, bạn đồng ý tuân thủ các điều khoản sau.</p>

                <h4 className="font-semibold text-base">2. Quy định sử dụng</h4>
                <p className="font-medium">2.1. Hành vi được phép:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Sử dụng dịch vụ cho mục đích cá nhân, hợp pháp</li>
                  <li>Giao tiếp lịch sự, tôn trọng người khác</li>
                  <li>Bảo mật thông tin tài khoản của bạn</li>
                </ul>

                <p className="font-medium">2.2. Hành vi bị cấm:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Spam, gửi tin nhắn quấy rối</li>
                  <li>Chia sẻ nội dung vi phạm pháp luật</li>
                  <li>Mạo danh người khác</li>
                  <li>Sử dụng bot, script tự động</li>
                  <li>Tấn công, hack hệ thống</li>
                  <li>Chia sẻ thông tin cá nhân của người khác</li>
                </ul>

                <h4 className="font-semibold text-base">3. Xử lý vi phạm</h4>
                <p className="font-medium">3.1. Các mức độ vi phạm:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>
                    <strong>Vi phạm nhẹ:</strong> Cảnh báo
                  </li>
                  <li>
                    <strong>Vi phạm trung bình:</strong> Khóa tài khoản tạm thời (7-30 ngày)
                  </li>
                  <li>
                    <strong>Vi phạm nghiêm trọng:</strong> Khóa tài khoản vĩnh viễn
                  </li>
                </ul>

                <p className="font-medium">3.2. Quyền của Admin:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Khóa tài khoản vi phạm điều khoản</li>
                  <li>Xóa nội dung không phù hợp</li>
                  <li>Từ chối cung cấp dịch vụ</li>
                </ul>

                <h4 className="font-semibold text-base">4. Quyền riêng tư</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Chúng tôi cam kết bảo mật thông tin cá nhân</li>
                  <li>Không chia sẻ dữ liệu cho bên thứ ba</li>
                </ul>

                <p className="text-xs text-gray-500 mt-6">Cập nhật lần cuối: 2024</p>
              </div>
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowTerms(false);
                    setAgreeTerms(true);
                  }}
                  className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors"
                >
                  Đồng ý và đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SignUpInfoScreen;
