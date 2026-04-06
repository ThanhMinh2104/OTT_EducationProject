import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaComments } from 'react-icons/fa';
import { io } from 'socket.io-client';
import UserProfileModal from '../components/UserProfileModal';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { getToken } from '../utils/auth';
import '../styles/home.css';

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
    <div className="main">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="top-icons">
          <div className="sidebar-avatar" onClick={() => setShowQuickMenu((v) => !v)}>
            <img src={user?.anhDaiDien || 'https://via.placeholder.com/48'} alt="avatar" />
          </div>
          <div className="sidebar-icon">
            <FaComments />
          </div>
        </div>
        <div className="bottom-icons">
          <div className="sidebar-icon" onClick={openProfile} title="Hồ sơ cá nhân">
            <FaUser />
          </div>
          <div className="sidebar-icon" onClick={handleLogout} title="Đăng xuất">
            <FaSignOutAlt />
          </div>
        </div>
      </div>

      {/* Quick menu khi click avatar */}
      {showQuickMenu && (
        <div className="profile-quick-menu">
          <div className="profile-quick-header">
            <img src={user?.anhDaiDien || 'https://via.placeholder.com/40'} alt="avatar" />
            <span>{user?.name}</span>
          </div>
          <div className="profile-quick-item" onClick={openProfile}>
            <FaUser /><span>Hồ sơ của bạn</span>
          </div>
          <div className="profile-quick-item logout" onClick={handleLogout}>
            <FaSignOutAlt /><span>Đăng xuất</span>
          </div>
        </div>
      )}

      {/* Main content: ChatList + ChatWindow */}
      <div className="chat-container" onClick={() => setShowQuickMenu(false)}>
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
