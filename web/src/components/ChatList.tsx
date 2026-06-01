import { useState, useEffect, useRef } from 'react';
import { FaSearch, FaUserPlus, FaUsers, FaAngleDown, FaEllipsisH, FaTrash } from 'react-icons/fa';
import socket from '../utils/socket';
import AddFriendModal from './AddFriendModal';
import { CreateGroupModal } from './CreateGroupModal';
import ContactsPanel from './ContactsPanel';
import StrangerFolderItem from './StrangerFolderItem';
import StrangerChatList from './StrangerChatList';
import { DeleteChatDialog } from './DeleteChatDialog';
import { getToken } from '../utils/auth';
import toast from 'react-hot-toast';

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

const getLastMsgPreview = (chat: Chat, userID: string, userName?: string): string => {
  const msgs = [...(chat.lastMessage || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const last = msgs[msgs.length - 1];
  if (!last) return 'Chưa có tin nhắn';
  const isMine = last.senderID === userID;
  const senderName = last.senderInfo?.name || 'Người dùng';
  const prefix = isMine ? 'Bạn: ' : (chat.type === 'group' ? `${senderName}: ` : '');

  // Xử lý Mention (Yêu cầu 2)
  if (!isMine && last.type === 'text' && last.content) {
    if (last.content.includes('@All')) {
      const cleanContent = last.content.replace(/@All/gi, '').trim();
      return `${senderName} đã nhắc cả nhóm: "${cleanContent || '...'}"`;
    }
    // Tìm mention cụ thể tới mình (@Name)
    if (userName && last.content.includes(`@${userName}`)) {
      const cleanContent = last.content.replace(new RegExp(`@${userName}`, 'gi'), '').trim();
      return `${senderName} đã nhắc bạn: "${cleanContent || '...'}"`;
    }
  }

  // Xử lý thông báo Bình chọn (Poll) - Chuyển ra ngoài switch để bắt được cả khi type là 'text'
  if (last.content?.startsWith('##POLL_')) {
    const parts = last.content.split('|');
    const type = parts[0];
    const question = parts[2];
    const personName = parts[3];
    const isMe = last.senderID === userID;
    const displayName = isMe ? 'Bạn' : personName;

    if (type === '##POLL_CREATED##') return `${displayName} đã tạo bình chọn: ${question}`;
    if (type === '##POLL_VOTED##') return `${displayName} đã tham gia bình chọn: ${question}`;
    if (type === '##POLL_CLOSED##') return `${displayName} đã khóa bình chọn: ${question}`;
    if (type === '##POLL_DELETED##') return `Bình chọn đã bị xóa: ${question}`;
    if (type === '##POLL_OPTION_ADDED##') {
      const optionText = parts[4];
      return `${displayName} đã thêm lựa chọn "${optionText}" vào bình chọn: ${question}`;
    }
  }

  if (last.content?.startsWith('POLL_NOTIF|')) {
    const parts = last.content.split('|');
    const [_, action, pollID, pollName, userName] = parts;
    const isMe = last.senderID === userID;
    const displayName = isMe ? 'Bạn' : userName;

    let actionText = 'đã tham gia bình chọn:';
    if (action === 'CREATE') actionText = 'đã tạo bình chọn:';
    if (action === 'LEAVE') actionText = 'đã bỏ bình chọn:';
    if (action === 'CHANGE') actionText = 'đã đổi lựa chọn:';
    if (action === 'LOCK') actionText = 'đã khóa bình chọn:';
    if (action === 'SHARE') actionText = 'đã chia sẻ bình chọn:';

    return `${displayName} ${actionText} ${pollName}`;
  }

  switch (last.type) {
    case 'image':
      return prefix + '[Hình ảnh]';
    case 'video':
      return prefix + '[Video]';
    case 'audio':
      return prefix + '[Tin nhắn thoại]';
    case 'file':
      return prefix + '[File]';
    case 'sticker':
      return prefix + '[Sticker]';
    case 'gif':
      return prefix + '[GIF]';
    case 'emoji':
      return prefix + (last.content || '');
    case 'unsend':
      return isMine ? 'Bạn đã thu hồi tin nhắn' : 'Tin nhắn đã bị thu hồi';
    case 'notification':
      if (last.content?.startsWith('##FRIENDSHIP##')) {
        const parts = last.content.split('|');
        const senderID = parts[1];
        const senderName = parts[3];
        const receiverName = parts[4];
        const otherName = userID === senderID ? receiverName : senderName;
        return `Bạn và ${otherName} đã trở thành bạn bè`;
      }
      if (last.content?.startsWith('##GROUP_REMINDER##')) {
        // Format: ##GROUP_REMINDER##|reminderID|title|datetime|creatorName
        const parts = last.content.split('|');
        const title = parts[2];
        const creatorName = parts[4];
        const isMe = last.senderID === userID;
        return `🔔 ${isMe ? 'Bạn' : creatorName} tạo nhắc hẹn: ${title}`;
      }
      if (last.content?.startsWith('POLL_NOTIF|') || last.content?.startsWith('##POLL_')) {
        return '📊 Bình chọn';
      }
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
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [memberCache, setMemberCache] = useState<Record<string, User>>({});
  const [typingMap, setTypingMap] = useState<
    Record<string, { userID: string; userName: string }[]>
  >({});
  const [menuChatId, setMenuChatId] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState<Chat | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
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

  // Fetch groups for user
  const fetchGroups = async () => {
    if (!user?.userID) return;
    try {
      const token = getToken();
      const res = await fetch('http://localhost:5000/api/groups', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const groups = await res.json();
        // Convert groups to chat format
        const groupChats: Chat[] = groups.map((g: any) => ({
          chatID: g.groupID,
          name: g.name,
          type: 'group',
          avatar: g.avatar,
          members: [],
          lastMessage: [],
          unreadCount: 0,
        }));
        setChats((prev) => {
          // Merge groups with existing chats, avoiding duplicates
          const existingIds = new Set(prev.map((c) => c.chatID));
          const newGroups = groupChats.filter((g) => !existingIds.has(g.chatID));
          return [...prev, ...newGroups].sort((a, b) => {
            const aT = a.lastMessage?.slice(-1)[0]?.timestamp || new Date().toISOString();
            const bT = b.lastMessage?.slice(-1)[0]?.timestamp || new Date().toISOString();
            return new Date(bT).getTime() - new Date(aT).getTime();
          });
        });
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  useEffect(() => {
    if (!user?.userID) return;

    const handleConnect = () => {
      socket.emit('join_user', user.userID);
      socket.emit('getChat', user.userID);
    };

    // Nếu socket đã connected, emit ngay
    if (socket.connected) {
      handleConnect();
    } else {
      // Nếu chưa connected, đợi connect event
      socket.on('connect', handleConnect);
    }

    socket.on('ChatByUserID', (data: Chat[]) => {
      console.log('📥 Received ChatByUserID:', data.length, 'chats');
      
      // Phân loại chat thành bạn bè và người lạ
      const friendChats = data.filter((c: any) => !c.isStranger);
      const strangers = data.filter((c: any) => c.isStranger);
      
      console.log(`✅ Loaded ${friendChats.length} friend chats + ${strangers.length} stranger chats`);
      
      const sorted = [...friendChats].sort((a, b) => {
        const aT = a.lastMessage?.slice(-1)[0]?.timestamp || new Date().toISOString();
        const bT = b.lastMessage?.slice(-1)[0]?.timestamp || new Date().toISOString();
        return new Date(bT).getTime() - new Date(aT).getTime();
      });
      
      // Filter out chats that were just deleted by user
      const filtered = sorted.filter((c) => !deletedChatIds.has(c.chatID));
      
      setChats(filtered);
      
      // Cập nhật stranger summary từ dữ liệu nhận được
      if (strangers.length > 0) {
        const unreadCount = strangers.reduce((sum, c: any) => sum + (c.unreadCount || 0), 0);
        const lastTimes = strangers
          .map((c: any) => c.lastMessage?.slice(-1)[0]?.timestamp)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        setStrangerSummary({
          count: strangers.length,
          unreadCount,
          lastMessageTime: lastTimes[0] || null,
        });
      } else {
        setStrangerSummary({ count: 0, unreadCount: 0, lastMessageTime: null });
      }
      
      // Prefetch member info cho private chats
      filtered.forEach((c) => {
        if (c.type === 'private') {
          const otherId = c.members.find((m) => m.userID !== user.userID)?.userID;
          if (otherId) fetchMember(otherId);
        }
      });
    });

    const handleNewRawMessage = (msg: any) => {
      console.log('📥 ChatList received new_message/new_group_message:', msg);
      // Chuyển đổi ID nhất quán: gmsg dùng groupID, msg dùng chatID
      const targetChatID = msg.groupID || msg.chatID;
      if (!targetChatID) return;

      setChats((prev) => {
        const chatExists = prev.some(c => c.chatID === targetChatID);
        
        if (!chatExists) {
          console.log('📥 New message from unknown chat, refetching...');
          socket.emit('getChat', user.userID);
          fetchStrangerSummary();
          return prev;
        }
        
        const updated = prev.map((c) => {
          if (c.chatID !== targetChatID) return c;
          const msgs = c.lastMessage || [];
          const exists = msgs.find((m) => m.messageID === msg.messageID || m.tempID === msg.tempID);
          const newMsgs = exists
            ? msgs.map((m) =>
                m.messageID === msg.messageID || m.tempID === msg.tempID ? { ...m, ...msg, chatID: targetChatID } : m
              )
            : [...msgs, { ...msg, chatID: targetChatID }];
            
          const unread = msg.senderID !== user.userID ? (c.unreadCount || 0) + 1 : c.unreadCount;
          
          if (msg.senderID !== user.userID && selectedChatId !== targetChatID) {
            notifAudioRef.current?.play().catch(() => {});
          }
          return { ...c, lastMessage: newMsgs, unreadCount: unread };
        });
        
        return [...updated].sort((a, b) => {
          const aT = a.lastMessage?.slice(-1)[0]?.timestamp || new Date().toISOString();
          const bT = b.lastMessage?.slice(-1)[0]?.timestamp || new Date().toISOString();
          return new Date(bT).getTime() - new Date(aT).getTime();
        });
      });
    };

    socket.on('new_message', handleNewRawMessage);
    socket.on('new_group_message', handleNewRawMessage);

    // Xử lý các sự kiện Poll để cập nhật Last Message
    socket.on('poll_created', (data) => {
       // Poll created cũng gửi notification message nên handleNewRawMessage sẽ lo phần badge
       // Ở đây ta chỉ đảm bảo UI sync
    });
    socket.on('poll_updated', (data) => {
       // Tương tự cho updated
    });

    socket.on(
      'status_update_all',
      ({ chatID, userID: uid, status }: { chatID: string; userID: string; status: string }) => {
        if (status === 'read' && uid === user.userID) {
          setChats((prev) => prev.map((c) => (c.chatID === chatID ? { ...c, unreadCount: 0 } : c)));
        }
      }
    );

    socket.on('friend_request_accepted', () => {
      // Khi kết bạn thành công, tải lại toàn bộ danh sách để đưa chat người lạ ra ngoài chính
      socket.emit('getChat', user.userID);
      fetchStrangerSummary();
    });

    socket.on('friend_status_update', (data: { userID: string; friendStatus: string; ownerID: string }) => {
      console.log('📥 Web received friend_status_update:', data);
      // Khi bị chặn / bỏ chặn → refetch để phân loại lại chat
      socket.emit('getChat', user.userID);
      fetchStrangerSummary();
    });

    socket.on('newChat1-1', (newChat: Chat & { isStranger?: boolean }) => {
      setChats((prev) => {
        const index = prev.findIndex((c) => c.chatID === newChat.chatID);
        if (index !== -1) {
          // Nếu đã tồn tại, cập nhật (đặc biệt là trạng thái isStranger)
          const updated = [...prev];
          updated[index] = { ...updated[index], ...newChat };
          return updated;
        }
        // Nếu chưa tồn tại, thêm mới (trừ khi là người lạ thì chỉ fetch summary)
        if (newChat.isStranger) {
          fetchStrangerSummary();
          return prev;
        }
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

    socket.on('friend_unfriended', (data: { userID: string; friendID: string }) => {
      console.log('📥 Web received friend_unfriended:', data);
      // Khi hủy kết bạn → refetch để phân loại lại chat (có thể thành người lạ)
      socket.emit('getChat', user.userID);
      fetchStrangerSummary();
    });

    // Listen for new group created
    socket.on('new_group_created', (data: any) => {
      console.log('📥 Web received new_group_created:', data);
      // Reload chat list để hiển thị nhóm mới
      socket.emit('getChat', user.userID);
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

    // Lắng nghe giải tán nhóm (real-time từ mobile/web khác)
    socket.on('group_dissolved', (data: { groupID: string; message: string }) => {
      console.log('💥 [WEB] group_dissolved event received:', data);
      // Xóa nhóm khỏi danh sách chat
      setChats((prev) => prev.filter((c) => c.chatID !== data.groupID));
      // Nếu đang mở nhóm đó → đóng lại
      if (selectedChatId === data.groupID) {
        onSelectChat(null as any);
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('ChatByUserID');
      socket.off('new_message', handleNewRawMessage);
      socket.off('new_group_message', handleNewRawMessage);
      socket.off('poll_created');
      socket.off('poll_updated');
      socket.off('status_update_all');
      socket.off('newChat1-1');
      socket.off('friend_request_accepted');
      socket.off('friend_status_update');
      socket.off('unsend_notification');
      socket.off('updatee_user');
      socket.off('friend_unfriended');
      socket.off('new_group_created');
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('group_dissolved');
    };
  }, [user?.userID, selectedChatId, deletedChatIds]);

  const handleSelectChat = (chat: Chat) => {
    onSelectChat(chat);
    socket.emit('read_messages', { chatID: chat.chatID, userID: user?.userID });
    setChats((prev) => prev.map((c) => (c.chatID === chat.chatID ? { ...c, unreadCount: 0 } : c)));
  };

  const confirmDeleteChat = (chat: Chat) => {
    console.log('🗑️ confirmDeleteChat called for:', chat.chatID, chat.name);
    setDeletingChat(chat);
    setMenuChatId(null);
  };

  const handleDeleteChat = async () => {
    if (!deletingChat || isDeletingChat) return;

    setIsDeletingChat(true);
    
    // Đánh dấu chat này đã bị xóa để ignore socket updates
    setDeletedChatIds((prev) => new Set(prev).add(deletingChat.chatID));
    
    try {
      const token = getToken();

      if (deletingChat.type === 'group') {
        // Group: xóa lịch sử
        const res = await fetch(`http://localhost:5000/api/groups/${deletingChat.chatID}/history`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }
      } else {
        // Chat 1-1: xóa lịch sử
        const res = await fetch(`http://localhost:5000/api/chats/${deletingChat.chatID}/history`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }
      }

      // Sau khi xóa lịch sử, ẩn chat khỏi danh sách local
      setChats((prev) => prev.filter((c) => c.chatID !== deletingChat.chatID));

      // Nếu đang mở chat đó thì đóng lại
      if (selectedChatId === deletingChat.chatID) {
        onSelectChat(null as any);
      }

      setDeletingChat(null);
      toast.success('Đã xóa cuộc trò chuyện khỏi danh sách của bạn');
    } catch (err: any) {
      console.error('❌ Delete chat error:', err?.message || err);
      
      // Nếu lỗi thì remove khỏi deletedChatIds và reload
      setDeletedChatIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingChat.chatID);
        return next;
      });
      socket.emit('getChat', user?.userID);
      
      toast.error(err?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsDeletingChat(false);
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
            onClick={() => setShowCreateGroupModal(true)}
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
        {/* Tin nhắn từ người lạ folder - Chỉ hiện khi có tin nhắn mới chưa đọc */}
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
                  {getLastMsgPreview(chat, user?.userID || '', user?.name)}
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
                    onClick={() => confirmDeleteChat(chat)}
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

      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={(groupID: string) => {
            // Reload chats from server
            socket.emit('getChat', user?.userID);
          }}
          currentUser={user}
        />
      )}

      {/* Delete Chat Dialog */}
      <DeleteChatDialog
        visible={!!deletingChat}
        chatName={deletingChat ? getChatName(deletingChat) : ''}
        isDeleting={isDeletingChat}
        onConfirm={handleDeleteChat}
        onCancel={() => setDeletingChat(null)}
      />
    </div>
  );
};

export default ChatList;
