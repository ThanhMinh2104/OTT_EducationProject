import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const validateName = (name: string) => /^([A-ZÀ-Ỵ][a-zà-ỹ]*)(\s[A-ZÀ-Ỵ][a-zà-ỹ]*)+$/.test(name);
const validateDateFormat = (date: string) => /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d\d$/.test(date);
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

  const handleSignUp = async () => {
    if (!name || !birth || !password || !rePassword) { setError('Vui lòng nhập đầy đủ thông tin!'); return; }
    if (!validateName(name)) { setError('Họ tên không hợp lệ! Ít nhất 2 từ, mỗi từ bắt đầu chữ hoa.'); return; }
    if (!validateDateFormat(birth)) { setError('Ngày sinh không đúng định dạng dd/mm/yyyy!'); return; }
    if (!validateAge(birth)) { setError('Bạn phải từ 18 tuổi trở lên để đăng ký.'); return; }
    if (!isValidPassword(password)) { setError('Mật khẩu không hợp lệ! Tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số.'); return; }
    if (password !== rePassword) { setError('Mật khẩu không khớp!'); return; }
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/registerUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdt, name, ngaySinh: birth, matKhau: password, email, gioTinh: gender }),
      });
      if (!response.ok) throw new Error('Đăng ký thất bại');
      navigate('/login');
    } catch {
      setError('Đăng ký thất bại. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    const valid =
      name.length > 0 && birth.length > 0 && password.length >= 8 && rePassword.length > 0 &&
      validateName(name) && validateDateFormat(birth) && validateAge(birth) &&
      isValidPassword(password) && password === rePassword;
    setEnabled(valid);

    if (name && !validateName(name)) setError('Họ tên không hợp lệ!');
    else if (birth && !validateDateFormat(birth)) setError('Ngày sinh không đúng định dạng dd/mm/yyyy!');
    else if (birth && !validateAge(birth)) setError('Bạn phải từ 18 tuổi trở lên.');
    else if (password && !isValidPassword(password)) setError('Mật khẩu không hợp lệ!');
    else if (password && rePassword && password !== rePassword) setError('Mật khẩu không khớp!');
    else setError('');
  }, [name, birth, password, rePassword]);

  return (
    <div className="page">
      <div className="brand">
        <h1 className="brand-name">OTT Education</h1>
      </div>
      <div className="card">
        <h2 className="card-title">Thông tin bổ sung</h2>

        <input type="text" placeholder="Tên hiển thị" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="text" placeholder="Ngày sinh (dd/mm/yyyy)" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} />

        <div className="gender-container">
          <p className="gender-label">Giới tính</p>
          <div className="gender-options">
            <button className={`gender-button ${gender === 'Nam' ? 'selected-gender' : ''}`} onClick={() => setGender('Nam')}>Nam</button>
            <button className={`gender-button ${gender === 'Nữ' ? 'selected-gender' : ''}`} onClick={() => setGender('Nữ')}>Nữ</button>
          </div>
        </div>

        <input type="password" placeholder="Mật khẩu" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="Nhập lại mật khẩu" className="input" value={rePassword} onChange={(e) => setRePassword(e.target.value)} />

        {error && <p className="error">{error}</p>}

        <button className="btn" onClick={handleSignUp} disabled={!enabled}>Tạo tài khoản</button>

        <p className="footer-text">
          <span className="link" onClick={() => navigate('/signup')}>Quay lại</span>
        </p>
      </div>
    </div>
  );
};

export default SignUpInfoScreen;