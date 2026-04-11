import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ToastNotification, { ToastData } from '../components/ToastNotification';
import { useReminderChecker } from '../hooks/useReminderChecker';
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
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const selectedChatRef = useRef<Chat | null>(null);

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Kiểm tra nhắc hẹn đến hạn
  useReminderChecker(useCallback((reminder) => {
    const toast: ToastData = {
      id: `reminder_${reminder.id}`,
      chatID: reminder.chatID,
      senderName: '🔔 Nhắc hẹn',
      senderAvatar: null,
      message: reminder.title,
    };
    setToasts((prev) => [...prev.slice(-2), toast]);
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch { /* ignore */ }
  }, []));

  const handleToastClick = useCallback((chatID: string) => {
    socket.emit('getChat', user?.userID);
    setSelectedChat((prev) => prev?.chatID === chatID ? prev : { chatID, name: '', type: 'private', members: [], lastMessage: [] });
  }, [user?.userID]);

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

    // Toast khi có tin nhắn mới
    socket.on('new_message', (msg: Message) => {
      if (!msg || msg.senderID === user.userID) return;
      if (selectedChatRef.current?.chatID === msg.chatID) return;

      const preview = msg.type === 'text' ? (msg.content || '') :
        msg.type === 'image' ? '📷 Hình ảnh' :
        msg.type === 'video' ? '🎥 Video' :
        msg.type === 'audio' ? '🎵 Tin nhắn thoại' :
        msg.type === 'file' ? `📎 ${msg.content || 'File'}` : 'Tin nhắn mới';

      const toast: ToastData = {
        id: `${msg.chatID}_${Date.now()}`,
        chatID: msg.chatID,
        senderName: msg.senderInfo?.name || 'Ai đó',
        senderAvatar: msg.senderInfo?.avatar,
        message: preview,
      };
      setToasts((prev) => [...prev.filter((t) => t.chatID !== msg.chatID).slice(-2), toast]);
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
      socket.off('new_message');
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userID]);

  return (
    <div className="flex h-screen w-screen overflow-hidden font-['Segoe_UI',sans-serif] bg-white dark:bg-gray-900">
      <Sidebar user={user} setUser={setUser} />

      <div className="flex-1 flex flex-row overflow-hidden">
        <ChatList
          user={user}
          onSelectChat={setSelectedChat}
          selectedChatId={selectedChat?.chatID ?? null}
        />
        <ChatWindow
          selectedChat={selectedChat}
          user={user}
        />
      </div>

      {/* Toast notifications */}
      <ToastNotification
        toasts={toasts}
        onDismiss={dismissToast}
        onClickChat={handleToastClick}
      />
    </div>
  );
};

export default HomePage;
