import { useState, useEffect } from 'react';
import { FaTimes, FaPen } from 'react-icons/fa';
import { io } from 'socket.io-client';
import { authHeaders } from '../utils/auth';

const socket = io('http://localhost:5000');

const isValidPhone = (p: string) => /^(0[35789][0-9]{8}|(\+84)[35789][0-9]{8})$/.test(p);
const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e);
const validateName = (name: string) => /^([A-ZÀ-Ỵ][a-zà-ỹ]*)(\s[A-ZÀ-Ỵ][a-zà-ỹ]*)+$/.test(name.trim().replace(/\s+/g, ' '));
const isValidDOB = (dob: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
};

interface User {
  userID: string;
  name: string;
  email: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
}

interface Props {
  onClose: () => void;
  user: User | null;
  setUser: (u: User) => void;
}

const UserProfileModal = ({ onClose, user, setUser }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [profile, setProfile] = useState({
    userID: '', name: '', email: '', phone: '',
    avatar: '', anhBia: '',
    dobDay: '', dobMonth: '', dobYear: '', gender: 'Nam',
  });

  useEffect(() => {
    if (!user) return;
    const dob = user.ngaysinh ? new Date(user.ngaysinh) : null;
    setProfile({
      userID: user.userID || '',
      name: user.name || '',
      email: user.email || '',
      phone: user.sdt || '',
      avatar: user.anhDaiDien || '',
      anhBia: user.anhBia || '',
      dobDay: dob ? String(dob.getDate()).padStart(2, '0') : '',
      dobMonth: dob ? String(dob.getMonth() + 1).padStart(2, '0') : '',
      dobYear: dob ? String(dob.getFullYear()) : '',
      gender: user.gioTinh || 'Nam',
    });
  }, [user]);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const years = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setProfile((prev) => ({ ...prev, avatar: URL.createObjectURL(f) }));
  };

  const handleSave = async () => {
    setErrorMessage('');
    if (!validateName(profile.name)) { setErrorMessage('Tên không hợp lệ! Ít nhất 2 từ, mỗi từ bắt đầu chữ hoa.'); return; }
    if (!isValidPhone(profile.phone)) { setErrorMessage('Số điện thoại không hợp lệ!'); return; }
    if (!isValidEmail(profile.email)) { setErrorMessage('Email không hợp lệ!'); return; }

    const dob = `${profile.dobYear}-${profile.dobMonth}-${profile.dobDay}`;
    if (!isValidDOB(dob)) { setErrorMessage('Ngày sinh không hợp lệ hoặc chưa đủ 18 tuổi.'); return; }

    let avatarUrl = profile.avatar;
    if (file) {
      const form = new FormData();
      form.append('files', file);
      const res = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      avatarUrl = data.urls[0];
    }

    try {
      const res = await fetch(`http://localhost:5000/api/users/${profile.userID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: profile.name, email: profile.email, sdt: profile.phone,
          ngaysinh: dob, gioTinh: profile.gender, anhDaiDien: avatarUrl, anhBia: profile.anhBia,
        }),
      });
      const data = await res.json();
      if (data.error) { setErrorMessage(data.error); return; }

      sessionStorage.setItem('user', JSON.stringify(data.user));
      socket.emit('updateUser', data.user);
      setUser(data.user);
      setIsEditing(false);
      alert('Cập nhật thông tin thành công!');
      onClose();
    } catch {
      setErrorMessage('Lỗi hệ thống khi cập nhật thông tin.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>Thông tin tài khoản</h2>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="profile-modal-body">
          <img src={profile.avatar || 'https://via.placeholder.com/90'} alt="avatar" className="profile-modal-avatar" />
          {isEditing && (
            <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm mb-2" />
          )}
          <p className="profile-modal-name">{profile.name}</p>

          {isEditing ? (
            <div className="profile-edit-form">
              <div className="field">
                <label>Tên</label>
                <input type="text" name="name" value={profile.name} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="text" name="email" value={profile.email} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Số điện thoại</label>
                <input type="text" name="phone" value={profile.phone} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Ngày sinh</label>
                <div className="date-row">
                  <select name="dobDay" value={profile.dobDay} onChange={handleChange}>
                    <option value="">Ngày</option>
                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select name="dobMonth" value={profile.dobMonth} onChange={handleChange}>
                    <option value="">Tháng</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select name="dobYear" value={profile.dobYear} onChange={handleChange}>
                    <option value="">Năm</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Giới tính</label>
                <div className="gender-row">
                  {['Nam', 'Nữ', 'Khác'].map((g) => (
                    <label key={g}>
                      <input type="radio" name="gender" value={g} checked={profile.gender === g} onChange={handleChange} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              {errorMessage && <p className="error-msg">{errorMessage}</p>}
              <div className="profile-modal-actions">
                <button className="btn-cancel-profile" onClick={() => { setIsEditing(false); setErrorMessage(''); }}>Hủy</button>
                <button className="btn-save-profile" onClick={handleSave}>Lưu</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-modal-info">
                <h4>Thông tin cá nhân</h4>
                <p><span>Tên:</span><span>{profile.name}</span></p>
                <p><span>Email:</span><span>{profile.email}</span></p>
                <p><span>Số điện thoại:</span><span>{profile.phone}</span></p>
                <p><span>Ngày sinh:</span><span>{profile.dobDay}/{profile.dobMonth}/{profile.dobYear}</span></p>
                <p><span>Giới tính:</span><span>{profile.gender}</span></p>
              </div>
              <div className="profile-modal-actions">
                <button className="btn-update" onClick={() => setIsEditing(true)}>
                  <FaPen /> Cập nhật
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
