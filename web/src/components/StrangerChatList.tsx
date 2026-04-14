import { useState, useEffect } from 'react';
import { FaArrowLeft, FaSearch } from 'react-icons/fa';
import socket from '../utils/socket';
import { getToken } from '../utils/auth';

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
  senderInfo?: { name: string; avatar?: string };
}

interface StrangerChat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: Member[];
  lastMessage: Message[];
  unreadCount?: number;
  isStranger: boolean;
}

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface Props {
  user: User | null;
  onBack: () => void;
  onSelectChat: (chat: StrangerChat) => void;
  selectedChatId: string | null;
}

const getLastMsgPreview = (chat: StrangerChat, userID: string): string => {
  const msgs = [...(chat.lastMessage || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const last = msgs[msgs.length - 1];
  if (!last) return 'Chưa có tin nhắn';
  const isMine = last.senderID === userID;
  const prefix = isMine ? 'Bạn: ' : '';
  switch (last.type) {
    case 'image':
      return prefix + '[Hình ảnh]';
    case 'video':
      return prefix + '[Video]';
    case 'audio':
      return prefix + '[Tin nhắn thoại]';
    case 'file':
      return prefix + '[File]';
    case 'emoji':
      return prefix + (last.content || '');
    case 'unsend':
      return isMine ? 'Bạn đã thu hồi tin nhắn' : 'Tin nhắn đã bị thu hồi';
    default:
      return prefix + (last.content || '');
  }
};

const getTime = (chat: StrangerChat): string => {
  const msgs = [...(chat.lastMessage || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const last = msgs[msgs.length - 1];
  if (!last?.timestamp) return '';
  
  const d = new Date(last.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Vài giây';
  if (diffMins < 60) return diffMins === 1 ? '1 phút' : `${diffMins} phút`;
  if (diffHours < 24) return diffHours === 1 ? '1 giờ' : `${diffHours} giờ`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return d.toLocaleDateString('vi-VN', { weekday: 'short' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const StrangerChatList = ({ user, onBack, onSelectChat, selectedChatId }: Props) => {
  const [strangerChats, setStrangerChats] = useState<StrangerChat[]>([]);
  const [searchText, setSearchText] = useState('');
  const [memberCache, setMemberCache] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);

  const fetchMember = async (memberID: string) => {
    if (memberCache[memberID]) return;
    try {
      const res = await fetch('http://localhost:5000/api/usersID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: memberID }),
      });
      const data = await res.json();
      setMemberCache((prev) => ({ ...prev, [memberID]: data }));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!user?.userID) return;

    const loadStrangerChats = async () => {
      try {
        const token = getToken();
        const res = await fetch('http://localhost:5000/api/chats/strangers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await res.json();
        
        const sorted = [...data].sort((a: StrangerChat, b: StrangerChat) => {
          const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
          const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
          return new Date(bT).getTime() - new Date(aT).getTime();
        });
        
        setStrangerChats(sorted);
        
        // Prefetch member info
        sorted.forEach((c: StrangerChat) => {
          if (c.type === 'private') {
            const otherId = c.members.find((m) => m.userID !== user.userID)?.userID;
            if (otherId) fetchMember(otherId);
          }
        });
      } catch (err) {
        console.error('Failed to load stranger chats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStrangerChats();

    // Listen for new messages from strangers
    socket.on('new_message', (msg: Message) => {
      setStrangerChats((prev) => {
        const updated = prev.map((c) => {
          if (c.chatID !== msg.chatID) return c;
          const msgs = c.lastMessage || [];
          const exists = msgs.find((m) => m.messageID === msg.messageID || m.tempID === msg.tempID);
          const newMsgs = exists
            ? msgs.map((m) =>
                m.messageID === msg.messageID || m.tempID === msg.tempID ? { ...m, ...msg } : m
              )
            : [...msgs, msg];
          const unread = msg.senderID !== user.userID ? (c.unreadCount || 0) + 1 : c.unreadCount;
          return { ...c, lastMessage: newMsgs, unreadCount: unread };
        });
        return updated.sort((a, b) => {
          const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
          const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
          return new Date(bT).getTime() - new Date(aT).getTime();
        });
      });
    });

    return () => {
      socket.off('new_message');
    };
  }, [user?.userID]);

  const handleSelectChat = (chat: StrangerChat) => {
    onSelectChat(chat);
    socket.emit('read_messages', { chatID: chat.chatID, userID: user?.userID });
    setStrangerChats((prev) => prev.map((c) => (c.chatID === chat.chatID ? { ...c, unreadCount: 0 } : c)));
  };

  const getChatAvatar = (chat: StrangerChat): string => {
    const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
    return (
      memberCache[otherId || '']?.anhDaiDien ||
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' + otherId
    );
  };

  const getChatName = (chat: StrangerChat): string => {
    const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
    return memberCache[otherId || '']?.name || chat.name;
  };

  const filtered = strangerChats.filter((c) =>
    getChatName(c).toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="w-[310px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen shrink-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <FaArrowLeft className="text-[16px]" />
        </button>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
          Tin nhắn từ người lạ
        </h2>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-3 py-1.5 flex-1 rounded-full focus-within:bg-blue-50 dark:focus-within:bg-blue-900/30 focus-within:outline-1 focus-within:outline-[#0e9de8] transition-colors">
          <FaSearch className="text-gray-400 dark:text-gray-500 mr-1.5 text-[13px]" />
          <input
            type="text"
            className="border-none bg-transparent outline-none w-full text-[13.5px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
            placeholder="Tìm kiếm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      {/* Stranger chat items */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Đang tải...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <span className="text-3xl">👤</span>
            <span>Chưa có tin nhắn từ người lạ</span>
          </div>
        ) : (
          filtered.map((chat) => (
            <div
              key={chat.chatID}
              className={`flex items-center px-3.5 py-2.5 cursor-pointer border-b border-gray-50 dark:border-gray-800 relative transition-colors group ${
                selectedChatId === chat.chatID
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleSelectChat(chat)}
            >
              <div className="relative mr-3 shrink-0">
                <img
                  src={getChatAvatar(chat)}
                  alt="avatar"
                  className="w-[46px] h-[46px] rounded-full object-cover bg-gray-200 dark:bg-gray-700 shadow-sm"
                />
              </div>
              <div className="flex-1 flex flex-col overflow-hidden gap-0.5 min-w-0">
                <p className="text-[14.5px] font-semibold text-gray-900 dark:text-gray-100 m-0 truncate">
                  {getChatName(chat)}
                </p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 m-0 truncate">
                  {getLastMsgPreview(chat, user?.userID || '')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                <span className="text-[11px] text-gray-300 dark:text-gray-600">
                  {getTime(chat)}
                </span>
                {(chat.unreadCount ?? 0) > 0 && (
                  <span className="bg-[#0e9de8] text-white text-[11px] font-bold rounded-[10px] px-1.5 py-0.5 min-w-[20px] text-center leading-[1.4]">
                    {chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StrangerChatList;
