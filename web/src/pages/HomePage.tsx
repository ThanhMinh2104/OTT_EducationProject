import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaComments } from 'react-icons/fa';
import { io } from 'socket.io-client';
import UserProfileModal from '../components/UserProfileModal';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { getToken } from '../utils/auth';

const socket = io('http://localhost:5000');

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

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  time?: string;
  unread?: number;
}

const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => {
    if (!user || !getToken()) { navigate('/login'); return; }
    socket.emit('join_user', user.userID);
    socket.on('update_user', (data: User) => {
      setUser(data);
      sessionStorage.setItem('user', JSON.stringify(data));
    });
    return () => { socket.off('update_user'); };
  }, [user, navigate]);

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

  const openProfile = () => {
    setShowQuickMenu(false);
    setShowProfileModal(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-['Segoe_UI',sans-serif]">
      {/* Sidebar */}
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
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <FaSignOutAlt />
          </div>
        </div>
      </div>

      {/* Quick menu khi click avatar */}
      {showQuickMenu && (
        <div className="fixed top-3.5 left-[76px] bg-white rounded-[10px] shadow-[0_4px_20px_rgba(0,0,0,0.15)] min-w-[210px] z-[999] overflow-hidden animate-fade-slide-in">
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gray-50">
            <img src={user?.anhDaiDien || 'https://via.placeholder.com/40'} alt="avatar" className="w-[38px] h-[38px] rounded-full object-cover border-2 border-[#0e9de8]" />
            <span className="font-semibold text-sm text-gray-800">{user?.name}</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-sm text-gray-700 hover:bg-blue-50 transition-colors" onClick={openProfile}>
            <FaUser className="text-[15px] text-gray-500" /><span>Hồ sơ của bạn</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-sm text-red-500 border-t border-gray-100 hover:bg-blue-50 transition-colors" onClick={handleLogout}>
            <FaSignOutAlt className="text-[15px] text-red-500" /><span>Đăng xuất</span>
          </div>
        </div>
      )}

      {/* Main content: ChatList + ChatWindow */}
      <div className="flex-1 flex flex-row overflow-hidden" onClick={() => setShowQuickMenu(false)}>
        <ChatList
          user={user}
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?.id ?? null}
        />
        <ChatWindow selectedChat={selectedChat} user={user} />
      </div>

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
    </div>
  );
};

export default HomePage;
