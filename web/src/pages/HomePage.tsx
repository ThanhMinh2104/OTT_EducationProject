import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
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

  return (
    <div className="flex h-screen w-screen overflow-hidden font-['Segoe_UI',sans-serif]">
      <Sidebar user={user} setUser={setUser} />

      <div className="flex-1 flex flex-row overflow-hidden">
        <ChatList
          user={user}
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?.id ?? null}
        />
        <ChatWindow selectedChat={selectedChat} user={user} />
      </div>
    </div>
  );
};

export default HomePage;
