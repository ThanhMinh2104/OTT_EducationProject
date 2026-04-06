import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaComments, FaUser, FaCloud, FaCog, FaSignOutAlt,
} from 'react-icons/fa';
import UserProfileModal from './UserProfileModal';
import '../styles/Sidebar.css';

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
  onChangeView: (view: 'chat' | 'friend') => void;
}

const Sidebar = ({ user, onChangeView }: Props) => {
  const navigate = useNavigate();
  const [activeButton, setActiveButton] = useState<string>('chat');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(user);

  const handleButtonClick = (name: 'chat' | 'friend') => {
    setActiveButton(name);
    onChangeView(name);
  };

  const handleLogout = async () => {
    if (currentUser) {
      await fetch('http://localhost:5000/api/updateStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: currentUser.userID, trangThai: 'offline' }),
      });
    }
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="top-icons">
        {/* Avatar */}
        <div className="avatar" onClick={() => setShowProfileModal(true)}>
          <img src={currentUser?.anhDaiDien || 'https://via.placeholder.com/48'} alt="Avatar" />
        </div>

        {/* Icon group */}
        <div className="icon-group">
          <div
            className={`icon ${activeButton === 'chat' ? 'active' : ''}`}
            onClick={() => handleButtonClick('chat')}
            title="Tin nhắn"
          >
            <FaComments className="iconn" />
          </div>
          <div
            className={`icon ${activeButton === 'friend' ? 'active' : ''}`}
            onClick={() => handleButtonClick('friend')}
            title="Danh bạ"
          >
            <FaUser className="iconn" />
          </div>
        </div>
      </div>

      {/* Bottom icons */}
      <div className="bottom-icons">
        <div className="icon" title="Cloud">
          <FaCloud className="iconn" />
        </div>
        <div className="icon" title="Cài đặt">
          <FaCog className="iconn" />
        </div>
        <div className="icon" onClick={handleLogout} title="Đăng xuất">
          <FaSignOutAlt className="iconn" />
        </div>
      </div>

      {showProfileModal && currentUser && (
        <UserProfileModal
          onClose={() => setShowProfileModal(false)}
          user={currentUser}
          setUser={(u) => {
            setCurrentUser(u);
            sessionStorage.setItem('user', JSON.stringify(u));
          }}
        />
      )}
    </div>
  );
};

export default Sidebar;
