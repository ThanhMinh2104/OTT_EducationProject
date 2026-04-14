import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../utils/socket';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import IncomingCallModal from '../components/IncomingCallModal';
import VideoCallModal from '../components/VideoCallModal';
import CallNotification from '../components/CallNotification';
import ContactsPanel from '../components/ContactsPanel';
import { getToken } from '../utils/auth';
import axiosInstance from '../utils/axios';

// Không cần tạo socket mới nữa, đã import từ utils/socket.ts

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

interface Member {
  userID: string;
  role: string;
}
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

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const [showVideoCall, setShowVideoCall] = useState(false);
  const [activeCallInfo, setActiveCallInfo] = useState<{
    offer?: RTCSessionDescriptionInit;
    remoteUserID?: string;
    callerInfo?: { name: string; avatar?: string };
    callType?: 'voice' | 'video';
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    offer: RTCSessionDescriptionInit;
    from: string;
    callerInfo: { name: string; avatar?: string };
    callType?: 'voice' | 'video';
  } | null>(null);
  const [callNotification, setCallNotification] = useState<{
    type: 'rejected' | 'missed';
    callerName: string;
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

    socket.on(
      'call-made',
      (data: {
        offer: RTCSessionDescriptionInit;
        from: string;
        callerInfo: { name: string; avatar?: string };
        callType?: 'voice' | 'video';
      }) => {
        setIncomingCall(data);
      }
    );

    socket.on('call-rejected', (data: { from: string; callerInfo?: { name: string } }) => {
      const callerName = data.callerInfo?.name || getMemberInfo()?.name || 'Người dùng';
      setCallNotification({ type: 'rejected', callerName });
    });

    socket.on('call-missed', (data: { from: string; callerInfo?: { name: string } }) => {
      const callerName = data.callerInfo?.name || getMemberInfo()?.name || 'Người dùng';
      setCallNotification({ type: 'missed', callerName });
    });

    socket.on('call-cancelled', () => {
      // Người gọi đã hủy cuộc gọi trước khi người nhận trả lời
      setIncomingCall(null);
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
      socket.off('call-made');
      socket.off('call-rejected');
      socket.off('call-missed');
      socket.off('call-cancelled');
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userID]);

  const handleStartChat = (chat: Chat) => {
    setSelectedChat(chat);
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setActiveCallInfo({
      offer: incomingCall.offer,
      remoteUserID: incomingCall.from,
      callerInfo: incomingCall.callerInfo,
      callType: incomingCall.callType || 'video',
    });
    setIncomingCall(null);
    setShowVideoCall(true);
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      socket.emit('call-rejected', {
        to: incomingCall.from,
        from: user?.userID,
        chatID: selectedChat?.chatID,
        callerInfo: { name: user?.name },
      });
    }
    setIncomingCall(null);
  };

  const handleCallTimeout = () => {
    if (incomingCall) {
      socket.emit('call-missed', {
        to: incomingCall.from,
        from: user?.userID,
        chatID: selectedChat?.chatID,
        callerInfo: { name: user?.name },
      });
    }
    setIncomingCall(null);
  };

  // Lấy memberInfo từ selectedChat để truyền vào VideoCallModal khi gọi đi
  const getMemberInfo = () => {
    if (!selectedChat || !user) return null;
    const otherId = selectedChat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return null;
    return { userID: otherId, name: selectedChat.name, anhDaiDien: selectedChat.avatar };
  };

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
          onStartVideoCall={(callType: 'voice' | 'video') => {
            setActiveCallInfo({ callType });
            setShowVideoCall(true);
          }}
        />
      </div>

      {incomingCall && (
        <IncomingCallModal
          callerInfo={incomingCall.callerInfo}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onTimeout={handleCallTimeout}
        />
      )}

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
          chatID={selectedChat?.chatID ?? null}
          callType={activeCallInfo?.callType || 'video'}
          onClose={() => {
            setShowVideoCall(false);
            setActiveCallInfo(null);
          }}
        />
      )}

      {callNotification && (
        <CallNotification
          type={callNotification.type}
          callerName={callNotification.callerName}
          onClose={() => setCallNotification(null)}
        />
      )}
    </div>
  );
};

export default HomePage;
