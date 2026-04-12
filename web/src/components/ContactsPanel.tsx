import { useState, useEffect } from 'react';
import { 
  FaUserPlus, 
  FaCheck, 
  FaTimes, 
  FaCommentDots, 
  FaSearch, 
  FaUserFriends, 
  FaEnvelopeOpenText,
  FaUserTag
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:5000');

interface Friend {
  userID: string;
  name: string;
  sdt?: string;
  anhDaiDien?: string;
  trangThai?: string;
  alias?: string;
}

interface FriendRequest {
  contactID: string;
  userID: string;
  name?: string;
  avatar?: string;
  sdt?: string;
  message?: string;
}

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string } | null;
  onStartChat: (chat: any) => void;
}

type Tab = 'friends' | 'requests';

const ContactsPanel = ({ user, onStartChat }: Props) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.post('/contacts/friends', {});
      setFriends(res.data);
    } catch {
      toast.error('Không thể tải danh sách bạn bè');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await axiosInstance.get('/contacts/friend-requests');
      setRequests(res.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchFriends();
    fetchRequests();

    socket.emit('join_user', user.userID);

    // Lời mời kết bạn mới đến
    socket.on('new_friend_request', (data: FriendRequest) => {
      setRequests((prev) => {
        if (prev.find((r) => r.contactID === data.contactID)) return prev;
        return [data, ...prev];
      });
      toast(`${data.name} đã gửi lời mời kết bạn`, { icon: '👋' });
    });

    // Kết bạn thành công
    socket.on('friend_request_accepted', (data: any) => {
      fetchFriends();
      setRequests((prev) => prev.filter((r) => r.contactID !== data.userID));
      toast.success(`${data.name} đã chấp nhận lời mời`);
    });

    return () => {
      socket.off('new_friend_request');
      socket.off('friend_request_accepted');
    };
  }, [user?.userID]);

  const handleAccept = async (req: FriendRequest) => {
    try {
      await axiosInstance.post('/contacts/accept-friend-request', { senderID: req.contactID });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      toast.success(`Đã kết bạn với ${req.name}`);
      fetchFriends();
    } catch {
      toast.error('Lỗi khi chấp nhận kết bạn');
    }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      await axiosInstance.post('/contacts/reject-friend-request', { senderID: req.contactID });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      toast('Đã từ chối lời mời');
    } catch {
      toast.error('Lỗi khi từ chối');
    }
  };

  const handleStartChat = async (friend: Friend) => {
    try {
      const res = await axiosInstance.post('/createChat1-1', { userID2: friend.userID });
      onStartChat(res.data);
    } catch {
      toast.error('Không thể mở cuộc trò chuyện');
    }
  };

  // Zalo Style: Grouping by Alphabet A-Z
  const getGroupedFriends = () => {
    const filtered = friends.filter(
      (f) =>
        (f.alias || f.name).toLowerCase().includes(search.toLowerCase()) ||
        f.sdt?.includes(search)
    );

    const groups: { [key: string]: Friend[] } = {};
    filtered.forEach((f) => {
      const name = f.alias || f.name;
      const firstChar = name.charAt(0).toUpperCase();
      if (!groups[firstChar]) groups[firstChar] = [];
      groups[firstChar].push(f);
    });

    return Object.keys(groups)
      .sort()
      .map((key) => ({
        label: key,
        items: groups[key].sort((a, b) => (a.alias || a.name).localeCompare(b.alias || b.name)),
      }));
  };

  const groupedFriends = getGroupedFriends();
  const pendingCount = requests.length;

  return (
    <div className="w-[310px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen shrink-0 animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Danh bạ</h2>
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-transparent focus-within:border-blue-300">
          <FaSearch className="text-gray-400 text-[13px] mr-2 shrink-0" />
          <input
            type="text"
            className="bg-transparent outline-none w-full text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
            placeholder="Tìm bạn bè..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-50 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${
            tab === 'friends' ? 'text-[#0e9de8]' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Bạn bè
          {tab === 'friends' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#0e9de8] rounded-full" />}
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${
            tab === 'requests' ? 'text-[#0e9de8]' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Lời mời
          {pendingCount > 0 && (
            <span className="absolute top-2 right-6 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
              {pendingCount}
            </span>
          )}
          {tab === 'requests' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#0e9de8] rounded-full" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded">
        {loading && friends.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-3 border-[#0e9de8]/20 border-t-[#0e9de8] rounded-full animate-spin" />
          </div>
        ) : tab === 'friends' ? (
          <div className="pb-10">
            {groupedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-300">
                <FaUserFriends className="text-5xl opacity-20" />
                <span className="text-sm font-medium">Chưa có bạn bè nào</span>
              </div>
            ) : (
              groupedFriends.map((group) => (
                <div key={group.label}>
                  <div className="px-5 py-2 bg-gray-50/50 dark:bg-gray-800/30 sticky top-0 z-10 backdrop-blur-sm">
                    <span className="text-xs font-bold text-[#0e9de8]">{group.label}</span>
                  </div>
                  {group.items.map((friend) => (
                    <div
                      key={friend.userID}
                      className="flex items-center px-5 py-3.5 hover:bg-blue-50/30 dark:hover:bg-gray-800 transition-all cursor-pointer border-b border-gray-50 dark:border-gray-800 group"
                      onClick={() => handleStartChat(friend)}
                    >
                      <div className="relative mr-4 shrink-0">
                        <img
                          src={friend.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + friend.userID}
                          alt="avatar"
                          className="w-12 h-12 rounded-full object-cover bg-gray-100 shadow-sm border border-gray-100"
                        />
                        <span
                          className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                            friend.trangThai === 'online' ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                           <p className="text-[14.5px] font-bold text-gray-800 dark:text-gray-100 truncate">
                            {friend.alias || friend.name}
                          </p>
                          {friend.alias && (
                            <FaUserTag className="text-[10px] text-blue-400" title="Biệt danh" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{friend.sdt}</p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 w-9 h-9 flex items-center justify-center rounded-xl bg-white text-[#0e9de8] shadow-sm border border-blue-100 hover:bg-[#0e9de8] hover:text-white transition-all scale-90 group-hover:scale-100"
                      >
                        <FaCommentDots className="text-lg" />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col pb-10">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-300">
                <FaEnvelopeOpenText className="text-5xl opacity-20" />
                <span className="text-sm font-medium">Không có lời mời nào</span>
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.contactID} className="p-4 border-b border-gray-50 dark:border-gray-800 hover:bg-orange-50/10 transition-colors">
                  <div className="flex items-start gap-4">
                    <img
                      src={req.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + req.contactID}
                      alt="avatar"
                      className="w-12 h-12 rounded-full object-cover bg-gray-100 shadow-sm shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 dark:text-gray-100 truncate text-sm">{req.name}</p>
                      <p className="text-xs text-gray-400 mb-2">{req.sdt}</p>
                      <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg border border-gray-100 dark:border-gray-700 relative mb-3">
                         <div className="absolute -top-1.5 left-3 w-3 h-3 bg-gray-50 dark:bg-gray-800 border-l border-t border-gray-100 rotate-45" />
                         <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2">
                           "{req.message || 'Mình kết bạn nhé!'}"
                         </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(req)}
                          className="flex-1 py-1.5 bg-[#0e9de8] text-white text-xs font-bold rounded-lg hover:bg-[#0077c2] shadow-sm transition-all"
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleReject(req)}
                          className="flex-1 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsPanel;
