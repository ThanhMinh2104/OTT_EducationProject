import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';
import { GroupChatWindow } from '../components/GroupChatWindow';

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

export const GroupChatPage: React.FC = () => {
  const { groupID } = useParams<{ groupID: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get user from sessionStorage (đã được đảm bảo bởi ProtectedRoute)
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (err) {
        console.error('Failed to parse user from sessionStorage:', err);
      }
    }
  }, []);

  const handleGroupDissolved = () => {
    // Navigate back to home without hard reload
    navigate('/home');
  };

  if (!user || !groupID) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <button 
          className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-blue-500 text-base transition-all hover:scale-105 active:scale-95"
          onClick={() => navigate('/home')}
          title="Quay lại"
        >
          <FaArrowLeft />
        </button>
        <span className="text-base font-semibold text-black">Nhóm Chat</span>
      </div>
      <div className="flex flex-1 gap-0 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <GroupChatWindow 
            groupID={groupID} 
            userID={user.userID}
            onGroupDissolved={handleGroupDissolved}
          />
        </div>
      </div>
    </div>
  );
};
