import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaComments, FaUser, FaCloud, FaCog, FaSignOutAlt,
} from 'react-icons/fa';
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
    <div className="w-[70px] h-screen bg-[#79DFFF] flex flex-col items-center py-4 flex-shrink-0">
      <div className="flex flex-col items-center gap-7">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full bg-gray-300 overflow-hidden cursor-pointer"
          onClick={() => setShowProfileModal(true)}
        >
          <img src={currentUser?.anhDaiDien || 'https://via.placeholder.com/48'} alt="Avatar" className="w-full h-full object-cover rounded-full" />
        </div>

        {/* Icon group */}
        <div className="flex flex-col gap-7">
          <div
            className={`w-[45px] h-[45px] rounded-[10px] flex items-center justify-center cursor-pointer text-white transition-colors ${activeButton === 'chat' ? 'bg-blue-800' : 'hover:bg-blue-800'}`}
            onClick={() => handleButtonClick('chat')}
            title="Tin nhắn"
          >
            <FaComments className="w-[30px] h-[30px]" />
          </div>
          <div
            className={`w-[45px] h-[45px] rounded-[10px] flex items-center justify-center cursor-pointer text-white transition-colors ${activeButton === 'friend' ? 'bg-blue-800' : 'hover:bg-blue-800'}`}
            onClick={() => handleButtonClick('friend')}
            title="Danh bạ"
          >
            <FaUser className="w-[30px] h-[30px]" />
          </div>
        </div>
      </div>

      {/* Bottom icons */}
      <div className="mt-auto flex flex-col gap-7">
        <div className="w-[45px] h-[45px] rounded-[10px] flex items-center justify-center cursor-pointer text-white hover:bg-blue-800 transition-colors" title="Cloud">
          <FaCloud className="w-[30px] h-[30px]" />
        </div>
        <div className="w-[45px] h-[45px] rounded-[10px] flex items-center justify-center cursor-pointer text-white hover:bg-blue-800 transition-colors" title="Cài đặt">
          <FaCog className="w-[30px] h-[30px]" />
        </div>
        <div className="w-[45px] h-[45px] rounded-[10px] flex items-center justify-center cursor-pointer text-white hover:bg-blue-800 transition-colors" onClick={handleLogout} title="Đăng xuất">
          <FaSignOutAlt className="w-[30px] h-[30px]" />
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
