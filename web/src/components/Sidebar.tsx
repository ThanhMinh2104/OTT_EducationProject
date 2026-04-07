import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaComments } from 'react-icons/fa';
import UserProfileModal from './UserProfileModal';

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
  user: User | null;
  setUser: (u: User) => void;
}

const Sidebar = ({ user, setUser }: Props) => {
  const navigate = useNavigate();
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const openProfile = () => {
    setShowQuickMenu(false);
    setShowProfileModal(true);
  };

  const handleLogout = async () => {
    if (user) {
      await fetch('http://localhost:5000/api/updateStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.userID, trangThai: 'offline' }),
      });
    }
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <>
      <div className="w-[68px] h-screen bg-linear-to-b from-[#0e9de8] to-[#0077c2] flex flex-col items-center py-3.5 shrink-0 shadow-[2px_0_8px_rgba(0,0,0,0.12)]">
        <div className="flex flex-col items-center gap-6">
          <div
            className="w-11 h-11 rounded-full overflow-hidden cursor-pointer border-2 border-white/60 hover:border-white hover:scale-105 transition-all"
            onClick={() => setShowQuickMenu((v) => !v)}
          >
            <img src={user?.anhDaiDien || 'https://via.placeholder.com/48'} alt="avatar" className="w-full h-full object-cover" />
          </div>
          <div className="w-11 h-11 rounded-[10px] flex items-center justify-center cursor-pointer text-white/85 text-xl hover:bg-white/20 hover:text-white hover:scale-105 transition-all">
            <FaComments />
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center cursor-pointer text-white/85 text-xl hover:bg-white/20 hover:text-white hover:scale-105 transition-all"
            onClick={openProfile}
            title="Hồ sơ cá nhân"
          >
            <FaUser />
          </div>
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center cursor-pointer text-white/85 text-xl hover:bg-white/20 hover:text-white hover:scale-105 transition-all"
            onClick={() => setShowLogoutModal(true)}
            title="Đăng xuất"
          >
            <FaSignOutAlt />
          </div>
        </div>
      </div>

      {/* Quick menu khi click avatar */}
      {showQuickMenu && (
        <div className="fixed top-3.5 left-[76px] bg-white rounded-[10px] shadow-[0_4px_20px_rgba(0,0,0,0.15)] min-w-[210px] z-999 overflow-hidden animate-fade-slide-in">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gray-50">
            <img src={user?.anhDaiDien || 'https://via.placeholder.com/40'} alt="avatar" className="w-[38px] h-[38px] rounded-full object-cover border-2 border-[#0e9de8]" />
            <span className="font-semibold text-sm text-gray-800">{user?.name}</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-sm text-gray-700 hover:bg-blue-50 transition-colors" onClick={openProfile}>
            <FaUser className="text-[15px] text-gray-500" /><span>Hồ sơ của bạn</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-sm text-red-500 border-t border-gray-100 hover:bg-blue-50 transition-colors" onClick={() => { setShowQuickMenu(false); setShowLogoutModal(true); }}>
            <FaSignOutAlt className="text-[15px] text-red-500" /><span>Đăng xuất</span>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          onClose={() => setShowProfileModal(false)}
          user={user}
          setUser={(u) => {
            setUser(u);
            sessionStorage.setItem('user', JSON.stringify(u));
          }}
        />
      )}

      {/* Logout Confirm Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[340px] p-6 animate-fade-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <FaSignOutAlt className="text-red-500 text-2xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Đăng xuất</h3>
              <p className="text-sm text-gray-500 text-center">Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?</p>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                onClick={() => setShowLogoutModal(false)}
              >
                Hủy
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
