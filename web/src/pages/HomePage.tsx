import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
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

interface Member { userID: string; role: string }
interface Message {
  messageID?: string;
  tempID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
  status?: string;
  senderInfo?: { name: string; avatar?: string | null };
}
interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: Member[];
  lastMessage: Message[];
  unreadCount?: number;
}

const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const selectedChatRef = useRef<Chat | null>(null);

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

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

    const checkSession = async () => {
      try {
        await axiosInstance.get('/sessions');
      } catch {
        console.log('Session check failed');
      }
    };
    checkSession();
    const intervalId = setInterval(checkSession, 60000);

    return () => {
      socket.off('update_user');
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userID]);

  return (
    <div className="flex h-screen w-screen overflow-hidden font-['Segoe_UI',sans-serif] bg-white dark:bg-gray-900">
      <Sidebar user={user} setUser={setUser} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-row overflow-hidden">
        <ChatList
          user={user}
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?.chatID ?? null}
          activeTab={activeTab}
        />
        <ChatWindow selectedChat={selectedChat} user={user} />
      </div>
    </div>
  );
};

export default HomePage;
