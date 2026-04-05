import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';

const SignUpScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sdt, setSDT] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setError('');
      const responseSDT = await axios.post('http://localhost:5000/api/users/checksdt', { sdt });
      if (responseSDT.data.exists) { setError('Số điện thoại đã được đăng ký!'); return; }

      const otpRes = await axios.post('http://localhost:5000/api/send-otp', { email });
      window.localStorage.setItem('otpCode', otpRes.data.otp);
      window.localStorage.setItem('emailForSignIn', email);
      window.localStorage.setItem('sdt', sdt);
      navigate('/verify-otp');
    } catch (_err) {
      setError('Có lỗi xảy ra: ' + (_err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    setEnabled(phoneRegex.test(sdt) && emailRegex.test(email));
  }, [sdt, email]);

  return (
    <div className="page">
      <div className="brand">
        <h1 className="brand-name">OTT Education</h1>
      </div>      
      <div className="card">
        <h2 className="card-title">Đăng ký</h2>
        <input
          type="text"
          placeholder="Số điện thoại"
          className="input"
          value={sdt}
          onChange={(e) => setSDT(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" onClick={handleSignUp} disabled={!enabled || loading}>
          {loading ? 'Đang gửi...' : 'Tiếp tục'}
        </button>
        <p className="footer-text">
          Bạn đã có tài khoản?{' '}
          <span className="link" onClick={() => navigate('/login')}>Đăng nhập</span>
        </p>
      </div>
    </div>
  );
};

export default SignUpScreen;