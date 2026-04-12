import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import IncomingCallModal from '../components/IncomingCallModal';
import VideoCallModal from '../components/VideoCallModal';
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

  // Call State
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [activeCallInfo, setActiveCallInfo] = useState<{
    offer?: RTCSessionDescriptionInit;
    remoteUserID?: string; // userID của đối phương
    callerInfo?: { name: string; avatar?: string };
  } | null>(null);
  // Call state Incomming — đặt ở đây để luôn lắng nghe dù đang ở tab nào
  const [incomingCall, setIncomingCall] = useState<{
    offer: RTCSessionDescriptionInit;
    from: string; // userID của người gọi
    callerInfo: { name: string; avatar?: string };
  } | null>(null);

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

    // Lắng nghe cuộc gọi đến — luôn active ở cấp HomePage
    socket.on(
      'call-made',
      (data: {
        offer: RTCSessionDescriptionInit;
        from: string;
        callerInfo: { name: string; avatar?: string };
      }) => {
        setIncomingCall(data);
      }
    );

    // Check session validity mỗi 60 giây

    const checkSession = async () => {
      try {
        await axiosInstance.get('/sessions');
      } catch {
        console.log('Session check failed');
      }
    };
    checkSession();

    // Check định kỳ mỗi 60 giây

    const intervalId = setInterval(checkSession, 60000);

    return () => {
      socket.off('update_user');
      socket.off('call-made');
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userID]);

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setActiveCallInfo({
      offer: incomingCall.offer,
      remoteUserID: incomingCall.from, // userID của người gọi
      callerInfo: incomingCall.callerInfo,
    });
    setIncomingCall(null);
    setShowVideoCall(true);
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      socket.emit('call-rejected', { to: incomingCall.from, from: user?.userID });
    }
    setIncomingCall(null);
  };

  // Render IncomingCallModal
  {
    incomingCall && (
      <IncomingCallModal
        callerInfo={incomingCall.callerInfo}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />
    );
  }

  // Lấy memberInfo từ selectedChat để truyền vào VideoCallModal khi gọi đi
  const getMemberInfo = () => {
    if (!selectedChat || !user) return null;
    // Giả sử selectedChat có thông tin về người nhận
    // Bạn cần điều chỉnh logic này dựa trên cấu trúc Chat của bạn
    return {
      userID: selectedChat.id,
      name: selectedChat.name,
      anhDaiDien: selectedChat.avatar,
    };
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
        <ChatWindow
          selectedChat={selectedChat}
          user={user}
          onStartVideoCall={() => {
            setActiveCallInfo(null);
            setShowVideoCall(true);
          }}
        />
      </div>

      {/* Cuộc gọi đến — hiện ở mọi nơi */}
      {incomingCall && (
        <IncomingCallModal
          callerInfo={incomingCall.callerInfo}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Video call modal */}
      {showVideoCall && user && (
        <VideoCallModal
          user={user}
          memberInfo={
            activeCallInfo?.callerInfo
              ? {
                  userID: activeCallInfo.remoteUserID || '',
                  name: activeCallInfo.callerInfo.name,
                  anhDaiDien: activeCallInfo.callerInfo.avatar,
                }
              : getMemberInfo()
          }
          incomingOffer={activeCallInfo?.offer}
          remoteUserID={activeCallInfo?.remoteUserID ?? getMemberInfo()?.userID ?? null}
          onClose={() => {
            setShowVideoCall(false);
            setActiveCallInfo(null);
          }}
        />
      )}
    </div>
  );
};

export default HomePage;
