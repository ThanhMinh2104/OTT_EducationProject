import { useState, useEffect, useRef } from 'react';
import { FaSearch, FaUserPlus, FaUsers, FaAngleDown, FaEllipsisH, FaTrash } from 'react-icons/fa';
import socket from '../utils/socket';
import AddFriendModal from './AddFriendModal';
import ContactsPanel from './ContactsPanel';
import StrangerFolderItem from './StrangerFolderItem';
import StrangerChatList from './StrangerChatList';
import { getToken } from '../utils/auth';

// Không cần tạo socket mới nữa, đã import từ utils/socket.ts

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
interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: Member[];
  lastMessage: Message[];
  unreadCount?: number;
}
interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
  sdt?: string;
}
interface Props {
  user: User | null;
  onSelectChat: (chat: Chat) => void;
  selectedChatId: string | null;
  activeTab?: 'chats' | 'contacts';
}

const getLastMsgPreview = (chat: Chat, userID: string): string => {
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
    case 'notification':
      return last.content || '';
    case 'call-missed':
      return '📞 Cuộc gọi nhỡ';
    case 'call-rejected':
      return '📞 Cuộc gọi bị từ chối';
    case 'call-cancelled':
      return '📞 Cuộc gọi nhỡ';
    case 'call-ended':
      return `📞 Cuộc gọi • ${last.content || ''}`;
    default:
      return prefix + (last.content || '');
  }
};

const getTime = (chat: Chat): string => {
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
  
  // Vài giây trước
  if (diffSecs < 60) return 'Vài giây';
  
  // Vài phút trước
  if (diffMins < 60) {
    if (diffMins === 1) return '1 phút';
    return `${diffMins} phút`;
  }
  
  // Vài giờ trước
  if (diffHours < 24) {
    if (diffHours === 1) return '1 giờ';
    return `${diffHours} giờ`;
  }
  
  // Hôm qua
  if (diffDays === 1) return 'Hôm qua';
  
  // Trong tuần (hiển thị thứ)
  if (diffDays < 7) {
    return d.toLocaleDateString('vi-VN', { weekday: 'short' });
  }
  
  // Lâu hơn (hiển thị ngày/tháng)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const ChatList = ({ user, onSelectChat, selectedChatId, activeTab = 'chats' }: Props) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [memberCache, setMemberCache] = useState<Record<string, User>>({});
  const [typingMap, setTypingMap] = useState<
    Record<string, { userID: string; userName: string }[]>
  >({});
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [deleteConfirmChatId, setDeleteConfirmChatId] = useState<string | null>(null);
  const [deletedChatIds, setDeletedChatIds] = useState<Set<string>>(new Set());
  const [showStrangerList, setShowStrangerList] = useState(false);
  const [strangerSummary, setStrangerSummary] = useState<{
    count: number;
    unreadCount: number;
    lastMessageTime: string | null;
  }>({ count: 0, unreadCount: 0, lastMessageTime: null });
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);

  // Khởi tạo audio notification
  useEffect(() => {
    notifAudioRef.current = new Audio(
      'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'
    );
    notifAudioRef.current.volume = 0.5;
  }, []);

  // Lấy thông tin tổng hợp tin nhắn từ người lạ
  const fetchStrangerSummary = async () => {
    if (!user?.userID) return;
    try {
      const token = getToken();
      const res = await fetch('http://localhost:5000/api/chats/strangers/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      setStrangerSummary(data);
    } catch (err) {
      console.error('Failed to fetch stranger summary:', err);
    }
  };

  useEffect(() => {
    fetchStrangerSummary();
    // Refresh summary every 30 seconds
    const interval = setInterval(fetchStrangerSummary, 30000);
    return () => clearInterval(interval);
  }, [user?.userID]);

  // Lấy thông tin member cho chat private
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

    const handleConnect = () => {
      socket.emit('join_user', user.userID);
      socket.emit('getChat', user.userID);
    };

    if (socket.connected) handleConnect();
    else socket.on('connect', handleConnect);

    socket.on('ChatByUserID', (data: Chat[]) => {
      const sorted = [...data].sort((a, b) => {
        const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
        const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
        return new Date(bT).getTime() - new Date(aT).getTime();
      });
      
      // Filter out chats that were just deleted by user
      const filtered = sorted.filter((c) => !deletedChatIds.has(c.chatID));
      
      setChats(filtered);
      // Prefetch member info cho private chats
      filtered.forEach((c) => {
        if (c.type === 'private') {
          const otherId = c.members.find((m) => m.userID !== user.userID)?.userID;
          if (otherId) fetchMember(otherId);
        }
      });
    });

    socket.on('new_message', (msg: Message) => {
      setChats((prev) => {
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
          // Phát âm thanh khi có tin nhắn mới từ người khác và không phải chat đang chọn
          if (msg.senderID !== user.userID && selectedChatId !== msg.chatID) {
            notifAudioRef.current?.play().catch(() => {});
          }
          return { ...c, lastMessage: newMsgs, unreadCount: unread };
        });
        return updated.sort((a, b) => {
          const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
          const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
          return new Date(bT).getTime() - new Date(aT).getTime();
        });
      });
    });

    socket.on(
      'status_update_all',
      ({ chatID, userID: uid, status }: { chatID: string; userID: string; status: string }) => {
        if (status === 'read' && uid === user.userID) {
          setChats((prev) => prev.map((c) => (c.chatID === chatID ? { ...c, unreadCount: 0 } : c)));
        }
      }
    );

    socket.on('newChat1-1', (newChat: Chat) => {
      setChats((prev) => {
        if (prev.find((c) => c.chatID === newChat.chatID)) return prev;
        const otherId = newChat.members.find((m) => m.userID !== user.userID)?.userID;
        if (otherId) fetchMember(otherId);
        return [newChat, ...prev];
      });
    });

    socket.on('unsend_notification', (msg: Message) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.chatID !== msg.chatID) return c;
          return {
            ...c,
            lastMessage: c.lastMessage.map((m) =>
              m.messageID === msg.messageID ? { ...m, ...msg } : m
            ),
          };
        })
      );
    });

    socket.on('updatee_user', (updatedUser: User) => {
      setMemberCache((prev) => ({ ...prev, [updatedUser.userID]: updatedUser }));
    });

    // Typing events cho chat list
    const onTypingStart = ({
      chatID,
      userID: uid,
      userName,
    }: {
      chatID: string;
      userID: string;
      userName: string;
    }) => {
      if (uid === user.userID) return;
      setTypingMap((prev) => {
        const existing = prev[chatID] || [];
        if (existing.find((u) => u.userID === uid)) return prev;
        return { ...prev, [chatID]: [...existing, { userID: uid, userName }] };
      });
    };
    const onTypingStop = ({ chatID, userID: uid }: { chatID: string; userID: string }) => {
      setTypingMap((prev) => {
        const existing = prev[chatID] || [];
        return { ...prev, [chatID]: existing.filter((u) => u.userID !== uid) };
      });
    };
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('ChatByUserID');
      socket.off('new_message');
      socket.off('status_update_all');
      socket.off('newChat1-1');
      socket.off('unsend_notification');
      socket.off('updatee_user');
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
    };
  }, [fetchMember, selectedChatId, user?.userID]);

  const handleSelectChat = (chat: Chat) => {
    onSelectChat(chat);
    socket.emit('read_messages', { chatID: chat.chatID, userID: user?.userID });
    setChats((prev) => prev.map((c) => (c.chatID === chat.chatID ? { ...c, unreadCount: 0 } : c)));
  };

  const handleDeleteChat = async (chatID: string) => {
    setDeletingChatId(chatID);
    
    // Đánh dấu chat này đã bị xóa để ignore socket updates
    setDeletedChatIds((prev) => new Set(prev).add(chatID));
    
    // Xóa khỏi danh sách local ngay lập tức
    setChats((prev) => prev.filter((c) => c.chatID !== chatID));
    
    // Nếu đang xem chat này thì đóng nó
    if (selectedChatId === chatID) {
      onSelectChat(null as any);
    }
    
    try {
      const token = getToken();
      // Gọi endpoint xóa trò chuyện (ẩn khỏi danh sách)
      const res = await fetch(`http://localhost:5000/api/chats/${chatID}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) {
        console.error('Delete chat failed');
        // Nếu lỗi thì remove khỏi deletedChatIds và reload
        setDeletedChatIds((prev) => {
          const next = new Set(prev);
          next.delete(chatID);
          return next;
        });
        socket.emit('getChat', user?.userID);
      }
    } catch (err) {
      console.error('Delete chat error:', err);
      // Nếu lỗi thì remove khỏi deletedChatIds và reload
      setDeletedChatIds((prev) => {
        const next = new Set(prev);
        next.delete(chatID);
        return next;
      });
      socket.emit('getChat', user?.userID);
    } finally {
      setDeletingChatId(null);
      setMenuChatId(null);
      setDeleteConfirmChatId(null);
    }
  };

  const getChatAvatar = (chat: Chat): string => {
    if (chat.type === 'group')
      return chat.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + chat.chatID;
    const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
    return (
      memberCache[otherId || '']?.anhDaiDien ||
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' + otherId
    );
  };

  const getChatName = (chat: Chat): string => {
    if (chat.type === 'group') return chat.name;
    const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
    return memberCache[otherId || '']?.name || chat.name;
  };

  const filtered = chats.filter((c) =>
    getChatName(c).toLowerCase().includes(searchText.toLowerCase())
  );

  if (activeTab === 'contacts') {
    return <ContactsPanel user={user} onStartChat={onSelectChat} />;
  }

  if (showStrangerList) {
    return (
      <StrangerChatList
        user={user}
        onBack={() => setShowStrangerList(false)}
        onSelectChat={onSelectChat}
        selectedChatId={selectedChatId}
      />
    );
  }

  return (
    <div
      className="w-[310px] bg-white border-r border-gray-200 flex flex-col h-screen shrink-0"
      onClick={() => setMenuChatId(null)}
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center bg-gray-100 px-3 py-1.5 flex-1 rounded-full focus-within:bg-blue-50 focus-within:outline-1 focus-within:outline-[#0e9de8] transition-colors">
          <FaSearch className="text-gray-400 mr-1.5 text-[13px]" />
          <input
            type="text"
            className="border-none bg-transparent outline-none w-full text-[13.5px] text-gray-700 placeholder:text-gray-400"
            placeholder="Tìm kiếm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <button
            title="Thêm bạn"
            onClick={() => setShowAddFriendModal(true)}
            className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[17px] text-gray-600 hover:bg-gray-100 hover:text-[#0e9de8] transition-colors"
          >
            <FaUserPlus />
          </button>
          <button
            title="Tạo nhóm"
            className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[17px] text-gray-600 hover:bg-gray-100 hover:text-[#0e9de8] transition-colors"
          >
            <FaUsers />
          </button>
        </div>
      </div>

      {/* Tab menu */}
      <div className="flex items-center px-3 border-b border-gray-100 gap-0.5 h-10">
        <span className="cursor-pointer px-2.5 py-2 text-[13px] font-semibold text-[#0e9de8] border-b-2 border-[#0e9de8] whitespace-nowrap">
          Tất cả
        </span>
        <span className="cursor-pointer px-2.5 py-2 text-[13px] font-medium text-gray-500 border-b-2 border-transparent hover:text-[#0e9de8] whitespace-nowrap transition-colors">
          Chưa đọc
        </span>
        <button className="ml-auto text-gray-500 text-[13px] px-1.5 py-1 rounded hover:bg-gray-100 transition-colors">
          <FaAngleDown />
        </button>
        <button className="text-gray-500 text-[13px] px-1.5 py-1 rounded hover:bg-gray-100 transition-colors">
          <FaEllipsisH />
        </button>
      </div>

      {/* Chat items */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded">
        {/* Tin nhắn từ người lạ folder */}
        {strangerSummary.count > 0 && (
          <StrangerFolderItem
            unreadCount={strangerSummary.unreadCount}
            lastMessageTime={strangerSummary.lastMessageTime || ''}
            onClick={() => setShowStrangerList(true)}
            isSelected={false}
          />
        )}

        {filtered.length === 0 && strangerSummary.count === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <span className="text-3xl">💬</span>
            <span>Chưa có cuộc trò chuyện nào</span>
          </div>
        )}
        {filtered.map((chat) => (
          <div
            key={chat.chatID}
            className={`flex items-center px-3.5 py-2.5 cursor-pointer border-b border-gray-50 relative transition-colors group ${selectedChatId === chat.chatID ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={() => {
              handleSelectChat(chat);
              setMenuChatId(null);
            }}
          >
            <div className="relative mr-3 shrink-0">
              <img
                src={getChatAvatar(chat)}
                alt="avatar"
                className="w-[46px] h-[46px] rounded-full object-cover bg-gray-200 shadow-sm"
              />
            </div>
            <div className="flex-1 flex flex-col overflow-hidden gap-0.5 min-w-0">
              <p className="text-[14.5px] font-semibold text-gray-900 m-0 truncate">
                {getChatName(chat)}
              </p>
              {typingMap[chat.chatID]?.length > 0 ? (
                <p className="text-[13px] text-[#0e9de8] m-0 truncate italic flex items-center gap-1">
                  <span className="inline-flex gap-0.5 items-end">
                    <span className="w-1 h-1 bg-[#0e9de8] rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 bg-[#0e9de8] rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 bg-[#0e9de8] rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                  {typingMap[chat.chatID].map((u) => u.userName).join(', ')} đang nhập...
                </p>
              ) : (
                <p className="text-[13px] text-gray-400 m-0 truncate">
                  {getLastMsgPreview(chat, user?.userID || '')}
                </p>
              )}
            </div>

            {/* Meta: time + badge + 3 chấm */}
            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2 relative">
              {/* Time — ẩn khi menu mở */}
              <span
                className={`text-[11px] text-gray-400 transition-opacity ${menuChatId === chat.chatID ? 'opacity-0' : 'group-hover:opacity-0'}`}
              >
                {getTime(chat)}
              </span>

              {/* Badge unread */}
              {(chat.unreadCount ?? 0) > 0 && menuChatId !== chat.chatID && (
                <span className="bg-[#0e9de8] text-white text-[11px] font-bold rounded-[10px] px-1.5 py-0.5 min-w-[20px] text-center leading-[1.4]">
                  {chat.unreadCount}
                </span>
              )}

              {/* Nút 3 chấm — hiện khi hover hoặc menu đang mở */}
              <button
                className={`absolute top-0 right-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all ${menuChatId === chat.chatID ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuChatId((prev) => (prev === chat.chatID ? null : chat.chatID));
                }}
                title="Tùy chọn"
              >
                <FaEllipsisH className="text-[11px]" />
              </button>

              {/* Dropdown menu */}
              {menuChatId === chat.chatID && (
                <div
                  className="absolute right-0 top-7 z-30 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[170px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors rounded-lg mx-0.5"
                    onClick={() => {
                      setDeleteConfirmChatId(chat.chatID);
                      setMenuChatId(null);
                    }}
                  >
                    <FaTrash className="text-xs shrink-0" />
                    Xóa trò chuyện
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddFriendModal && (
        <AddFriendModal
          onClose={() => setShowAddFriendModal(false)}
          currentUser={user}
          onStartChat={(chat: Chat) => onSelectChat(chat)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmChatId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" 
          onClick={() => setDeleteConfirmChatId(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[340px] mx-4 p-6 flex flex-col gap-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <FaTrash className="text-red-500 text-lg" />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900">Xóa trò chuyện</h3>
              <p className="text-[13px] text-gray-500">
                Cuộc trò chuyện sẽ bị xóa khỏi danh sách của bạn. Bạn có thể nhắn tin lại để khôi phục.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmChatId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  const chatId = deleteConfirmChatId;
                  setDeleteConfirmChatId(null); // Đóng modal TRƯỚC
                  if (chatId) {
                    handleDeleteChat(chatId); // Sau đó mới xóa
                  }
                }}
                disabled={deletingChatId === deleteConfirmChatId}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletingChatId === deleteConfirmChatId ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatList;
