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
    <div className="fixed inset-0 w-screen h-screen bg-black/45 flex justify-center items-center z-[1000] backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-[14px] w-[460px] max-h-[88vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.18)] animate-modal-pop [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-[1]">
          <h2 className="text-base font-bold m-0 text-gray-900">Thông tin tài khoản</h2>
          <button
            className="bg-none border-none text-lg cursor-pointer text-gray-400 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 hover:text-gray-700 transition-colors"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-6 pb-5 flex flex-col items-center">
          <label className={`relative mb-2.5 ${isEditing ? 'cursor-pointer' : ''}`}>
            <img
              src={profile.avatar || 'https://via.placeholder.com/90'}
              alt="avatar"
              className="w-[88px] h-[88px] rounded-full object-cover border-[3px] border-[#0e9de8] shadow-[0_2px_10px_rgba(14,157,232,0.25)]"
            />
            {isEditing && (
              <>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <FaPen className="text-white text-lg" />
                </div>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </>
            )}
          </label>
          <p className="text-lg font-bold mb-5 text-gray-900">{profile.name}</p>

          {isEditing ? (
            <div className="w-full text-left">
              {/* Name */}
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Tên</label>
                <input type="text" name="name" value={profile.name} onChange={handleChange}
                  className="w-full px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-[#0e9de8] focus:bg-white outline-none transition-colors box-border" />
              </div>
              {/* Email */}
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Email</label>
                <input type="text" name="email" value={profile.email} onChange={handleChange}
                  className="w-full px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-[#0e9de8] focus:bg-white outline-none transition-colors box-border" />
              </div>
              {/* Phone */}
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Số điện thoại</label>
                <input type="text" name="phone" value={profile.phone} onChange={handleChange}
                  className="w-full px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-[#0e9de8] focus:bg-white outline-none transition-colors box-border" />
              </div>
              {/* DOB */}
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Ngày sinh</label>
                <div className="flex gap-2">
                  <select name="dobDay" value={profile.dobDay} onChange={handleChange}
                    className="flex-1 px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-[#0e9de8] focus:bg-white outline-none transition-colors">
                    <option value="">Ngày</option>
                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select name="dobMonth" value={profile.dobMonth} onChange={handleChange}
                    className="flex-1 px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-[#0e9de8] focus:bg-white outline-none transition-colors">
                    <option value="">Tháng</option>
                    {months.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select name="dobYear" value={profile.dobYear} onChange={handleChange}
                    className="flex-1 px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50 focus:border-[#0e9de8] focus:bg-white outline-none transition-colors">
                    <option value="">Năm</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {/* Gender */}
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Giới tính</label>
                <div className="flex gap-3 mt-1">
                  {['Nam', 'Nữ', 'Khác'].map((g) => (
                    <label key={g} className="flex items-center gap-1.5 font-medium text-sm cursor-pointer text-gray-600">
                      <input type="radio" name="gender" value={g} checked={profile.gender === g} onChange={handleChange} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              {errorMessage && (
                <p className="text-red-500 text-[13px] mt-2 text-center bg-red-50 px-3 py-2 rounded-md border border-red-200 w-full">
                  {errorMessage}
                </p>
              )}
              <div className="flex gap-2.5 mt-5 w-full justify-end">
                <button
                  className="bg-gray-100 text-gray-600 border-none px-5 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-gray-200 transition-colors"
                  onClick={() => { setIsEditing(false); setErrorMessage(''); }}
                >
                  Hủy
                </button>
                <button
                  className="bg-gradient-to-br from-green-500 to-green-700 text-white border-none px-5 py-2 rounded-lg cursor-pointer text-sm font-semibold hover:opacity-90 transition-opacity"
                  onClick={handleSave}
                >
                  Lưu
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-full text-left bg-gray-50 rounded-[10px] px-4 py-3.5">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Thông tin cá nhân</h4>
                <p className="text-sm text-gray-600 mb-2.5 flex gap-2 items-baseline"><span className="font-semibold text-gray-500 min-w-[110px] text-[13px]">Tên:</span><span>{profile.name}</span></p>
                <p className="text-sm text-gray-600 mb-2.5 flex gap-2 items-baseline"><span className="font-semibold text-gray-500 min-w-[110px] text-[13px]">Email:</span><span>{profile.email}</span></p>
                <p className="text-sm text-gray-600 mb-2.5 flex gap-2 items-baseline"><span className="font-semibold text-gray-500 min-w-[110px] text-[13px]">Số điện thoại:</span><span>{profile.phone}</span></p>
                <p className="text-sm text-gray-600 mb-2.5 flex gap-2 items-baseline"><span className="font-semibold text-gray-500 min-w-[110px] text-[13px]">Ngày sinh:</span><span>{profile.dobDay}/{profile.dobMonth}/{profile.dobYear}</span></p>
                <p className="text-sm text-gray-600 flex gap-2 items-baseline"><span className="font-semibold text-gray-500 min-w-[110px] text-[13px]">Giới tính:</span><span>{profile.gender}</span></p>
              </div>
              <div className="flex gap-2.5 mt-5 w-full justify-end">
                <button
                  className="bg-gradient-to-br from-[#0e9de8] to-[#0077c2] text-white border-none px-5 py-2 rounded-lg cursor-pointer text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 hover:-translate-y-px transition-all"
                  onClick={() => setIsEditing(true)}
                >
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
