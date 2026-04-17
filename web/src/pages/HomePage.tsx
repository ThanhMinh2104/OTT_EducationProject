import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import socket from '../utils/socket';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { GroupChatWindow } from '../components/GroupChatWindow';
import IncomingCallModal from '../components/IncomingCallModal';
import VideoCallModal from '../components/VideoCallModal';
import CallNotification from '../components/CallNotification';
import { showZaloToast } from '../components/ZaloToast';
import { getToken } from '../utils/auth';
import axiosInstance from '../utils/axios';

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

    // Listen for new messages to show Zalo-style toast notifications
    socket.on('new_message', (msg: Message) => {
      // Don't show notification for own messages
      if (msg.senderID === user.userID) {
        return;
      }

      // Get message preview
      const getMessagePreview = (message: Message): string => {
        if (message.type === 'text') return message.content || '';
        if (message.type === 'image') return '📷 Hình ảnh';
        if (message.type === 'video') return '🎥 Video';
        if (message.type === 'audio') return '🎵 Tin nhắn thoại';
        if (message.type === 'file') return '📎 ' + (message.content || 'File');
        if (message.type === 'sticker') return '😊 Sticker';
        if (message.type === 'gif') return '🎬 GIF';
        return 'Tin nhắn mới';
      };

      const messagePreview = getMessagePreview(msg);
      const senderName = msg.senderInfo?.name || 'Người dùng';
      const senderAvatar = msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}`;

      // Show Zalo-style toast notification
      showZaloToast(
        senderAvatar,
        senderName,
        messagePreview,
        msg.chatID,
        (chatID: string) => {
          // On click, navigate to chat
          axiosInstance
            .get(`/chats/${chatID}`)
            .then((res) => {
              setSelectedChat(res.data);
              setActiveTab('chats');
            })
            .catch(() => {});
        }
      );
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
      socket.off('new_message');
      socket.off('call-made');
      socket.off('call-rejected');
      socket.off('call-missed');
      socket.off('call-cancelled');
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userID]);

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

  const getMemberInfo = () => {
    if (!selectedChat || !user) return null;
    const otherId = selectedChat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return null;
    return { userID: otherId, name: selectedChat.name, anhDaiDien: selectedChat.avatar };
  };

  const handleSelectChat = (chat: Chat) => {
    // Show in chat window (both private and group)
    setSelectedChat(chat);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-['Segoe_UI',sans-serif] bg-white">
      {/* React Hot Toast Container */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      />

      <Sidebar user={user} setUser={setUser} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-row overflow-hidden">
        <ChatList
          user={user}
          onSelectChat={handleSelectChat}
          selectedChatId={selectedChat?.chatID ?? null}
          activeTab={activeTab}
        />
        {selectedChat?.type === 'group' ? (
          user && (
            <GroupChatWindow
              groupID={selectedChat.chatID}
              userID={user.userID}
              onShowGroupInfo={() => {}}
            />
          )
        ) : (
          <ChatWindow
            selectedChat={selectedChat}
            user={user}
            onStartVideoCall={(callType: 'voice' | 'video') => {
              setActiveCallInfo({ callType });
              setShowVideoCall(true);
            }}
          />
        )}
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
