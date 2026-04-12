import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FaUserPlus } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ContactsPanel from '../components/ContactsPanel';
import { getToken } from '../utils/auth';
import axiosInstance from '../utils/axios';

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
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  useEffect(() => {
    if (!user || !getToken()) {
      navigate('/login');
      return;
    }
    socket.emit('join_user', user.userID);
    socket.on('update_user', (data: User) => {
      setUser(data);
      sessionStorage.setItem('user', JSON.stringify(data));
    });

    // Check session validity mỗi 10 giây
    const checkSession = async () => {
      try {
        await axiosInstance.get('/sessions');
      } catch (error) {
        // Axios interceptor sẽ tự động xử lý 401
        console.log('Session check failed');
      }
    };

    // Check ngay lập tức
    checkSession();

    // Check định kỳ mỗi 10 giây
    const intervalId = setInterval(checkSession, 10000);

    return () => {
      socket.off('update_user');
      clearInterval(intervalId);
    };
  }, [user, navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden font-['Segoe_UI',sans-serif] bg-white dark:bg-gray-900">
      <Sidebar user={user} setUser={setUser} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-row overflow-hidden">
        {activeTab === 'chats' ? (
          <>
            <ChatList
              user={user}
              onSelectChat={setSelectedChat}
              selectedChatId={selectedChat?.id ?? null}
            />
            <ChatWindow selectedChat={selectedChat} user={user} />
          </>
        ) : (
          <>
            <ContactsPanel 
              user={user} 
              onStartChat={(chat) => {
                setSelectedChat(chat);
                setActiveTab('chats');
              }} 
            />
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/20 text-center p-10">
               <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <FaUserPlus className="text-4xl text-blue-500" />
               </div>
               <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Danh bạ của bạn</h3>
               <p className="text-gray-500 max-w-sm">
                 Chọn một người bạn từ danh sách bên trái để bắt đầu cuộc trò chuyện hoặc quản lý lời mời kết bạn.
               </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;
