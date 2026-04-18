import { useState, useEffect, useMemo } from 'react';
import {
  FaUserPlus,
  FaCheck,
  FaTimes,
  FaCommentDots,
  FaSearch,
  FaUserFriends,
  FaEnvelopeOpenText,
  FaUserTag,
  FaUndo,
  FaChevronDown,
  FaChevronRight,
  FaExclamationCircle,
  FaTrash,
  FaBan,
  FaEllipsisH
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import OtherProfileModal from './OtherProfileModal';
import BlockedUsersPanel from './BlockedUsersPanel';

const socket: Socket = io('http://localhost:5000');

interface Friend {
  userID: string;
  name: string;
  sdt?: string;
  anhDaiDien?: string;
  trangThai?: string;
  alias?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
}

interface FriendRequest {
  contactID: string;
  userID: string;
  name?: string;
  avatar?: string;
  sdt?: string;
  message?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
}

interface SentRequest {
  recipientID: string;
  senderID: string;
  name?: string;
  avatar?: string;
  sdt?: string;
  message?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
}

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string } | null;
  onStartChat: (chat: any) => void;
}

type Tab = 'friends' | 'requests' | 'blocked';

const ContactsPanel = ({ user, onStartChat }: Props) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  // UI States
  const [isReceivedExpanded, setIsReceivedExpanded] = useState(true);
  const [isSentExpanded, setIsSentExpanded] = useState(true);
  const [requestToRecall, setRequestToRecall] = useState<SentRequest | null>(null);
  const [userToBlock, setUserToBlock] = useState<Friend | null>(null);
  const [userToUnfriend, setUserToUnfriend] = useState<Friend | null>(null);
  const [activeFriendMenu, setActiveFriendMenu] = useState<string | null>(null);

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
      toast.error('Không thể tải danh sách lời mời kết bạn');
    }
  };

  const fetchSentRequests = async () => {
    try {
      const res = await axiosInstance.get('/contacts/sent-friend-requests');
      setSentRequests(res.data);
    } catch {
      toast.error('Không thể tải danh sách lời mời kết bạn đã gửi');
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchFriends();
    fetchRequests();
    fetchSentRequests();

    socket.emit('join_user', user.userID);

    socket.on('new_friend_request', (data: FriendRequest) => {
      setRequests((prev) => {
        if (prev.find((r) => r.contactID === data.contactID)) return prev;
        return [data, ...prev];
      });
      toast(`${data.name} đã gửi lời mời kết bạn`, { icon: '👋' });
      updateLocalStorageStatus(data.contactID, 'pending_received');
    });

    socket.on('friend_request_accepted', (data: any) => {
      fetchFriends();
      setRequests((prev) => prev.filter((r) => r.contactID !== data.userID));
      setSentRequests((prev) => prev.filter((r) => r.recipientID !== data.userID));
      if (data.actorID !== user.userID) {
        toast.success(`${data.name} đã chấp nhận lời mời kết bạn của bạn`, { icon: <FaCheck /> });
      }
      updateLocalStorageStatus(data.userID, 'accepted');
    });

    socket.on('friend_request_cancelled', (data: { senderID: string, recipientID: string }) => {
      if (data.recipientID === user.userID) {
        setRequests((prev) => prev.filter((r) => r.contactID !== data.senderID));
      }
      if (data.senderID === user.userID) {
        setSentRequests((prev) => prev.filter((r) => r.recipientID !== data.recipientID));
      }
      updateLocalStorageStatus(data.senderID === user.userID ? data.recipientID : data.senderID, 'none');
    });

    socket.on('friend_request_rejected', (data: { senderID: string, recipientID: string }) => {
      if (data.senderID === user.userID) {
        setSentRequests((prev) => prev.filter((r) => r.recipientID !== data.recipientID));
      }
      updateLocalStorageStatus(data.senderID === user.userID ? data.recipientID : data.senderID, 'none');
    });

    socket.on('friend_unfriended', (data: { userID: string, friendID: string }) => {
      const targetID = data.userID === user.userID ? data.friendID : data.userID;
      setFriends((prev) => prev.filter((f) => f.userID !== targetID));
      updateLocalStorageStatus(targetID, 'none');
    });

    return () => {
      socket.off('new_friend_request');
      socket.off('friend_request_accepted');
      socket.off('friend_request_cancelled');
      socket.off('friend_request_rejected');
      socket.off('friend_unfriended');
    };
  }, [user?.userID]);

  const updateLocalStorageStatus = (targetUserID: string, newStatus: string) => {
    try {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        const recent = JSON.parse(stored);
        const updated = recent.map((u: any) =>
          u.userID === targetUserID ? { ...u, friendStatus: newStatus } : u
        );
        localStorage.setItem('recentSearches', JSON.stringify(updated));
      }
    } catch (e) {
      console.error('Error updating localStorage:', e);
    }
  };

  const handleAccept = async (req: FriendRequest) => {
    try {
      await axiosInstance.post('/contacts/accept-friend-request', { senderID: req.contactID });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      toast.success(`Đã kết bạn với ${req.name}`);
      fetchFriends();
      updateLocalStorageStatus(req.contactID, 'accepted');
    } catch {
      toast.error('Lỗi khi chấp nhận kết bạn');
    }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      await axiosInstance.post('/contacts/reject-friend-request', { senderID: req.contactID });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      toast('Đã từ chối lời mời');
      updateLocalStorageStatus(req.contactID, 'none');
    } catch {
      toast.error('Lỗi khi từ chối');
    }
  };

  const handleCancelSent = async (reqArg?: SentRequest) => {
    const target = reqArg || requestToRecall;
    if (!target) return;
    try {
      await axiosInstance.post('/contacts/cancel-friend-request', { recipientID: target.recipientID });
      setSentRequests((prev) => prev.filter((r) => r.recipientID !== target.recipientID));
      toast.success('Đã thu hồi lời mời');
      updateLocalStorageStatus(target.recipientID, 'none');
      if (!reqArg) setRequestToRecall(null);
    } catch {
      toast.error('Lỗi khi thu hồi lời mời');
    }
  };

  const handleBlock = async () => {
    if (!userToBlock) return;
    try {
      await axiosInstance.post('/contacts/block', { targetUserID: userToBlock.userID });
      toast.success(`Đã chặn ${userToBlock.name}`);
      setFriends(prev => prev.filter(f => f.userID !== userToBlock.userID));
      // Backend sẽ emit friend_status_update, không cần emit từ client
      setUserToBlock(null);
    } catch {
      toast.error('Có lỗi xảy ra khi chặn');
    }
  };

  const handleUnfriend = async () => {
    if (!userToUnfriend) return;
    try {
      await axiosInstance.post('/contacts/unfriend', { friendID: userToUnfriend.userID });
      toast.success(`Đã hủy kết bạn với ${userToUnfriend.name}`);
      setFriends(prev => prev.filter(f => f.userID !== userToUnfriend.userID));
      socket.emit('friend_unfriended', {
        userID: String(user?.userID),
        friendID: String(userToUnfriend.userID)
      });
      setUserToUnfriend(null);
    } catch {
      toast.error('Có lỗi xảy ra khi hủy kết bạn');
    }
  };

  const handleViewProfile = (item: any, status: 'pending_sent' | 'pending_received' | 'accepted' | 'none') => {
    setSelectedProfile({
      userID: item.contactID || item.recipientID || item.userID,
      name: item.name,
      sdt: item.sdt,
      anhDaiDien: item.avatar || item.anhDaiDien,
      anhBia: item.anhBia,
      ngaysinh: item.ngaysinh,
      gioTinh: item.gioTinh,
      friendStatus: status
    });
  };

  const handleStartChat = async (friend: Friend) => {
    try {
      const res = await axiosInstance.post('/createChat1-1', { userID2: friend.userID });
      onStartChat(res.data);
    } catch {
      toast.error('Không thể mở cuộc trò chuyện');
    }
  };

  const groupedFriends = useMemo(() => {
    const uniqueFriends = Array.from(new Map(friends.map(f => [f.userID, f])).values());
    const filtered = uniqueFriends.filter(
      (f) => (f.alias?.trim() || f.name).toLowerCase().includes(search.toLowerCase()) || f.sdt?.includes(search)
    );
    const groups: { [key: string]: Friend[] } = {};
    filtered.forEach((f) => {
      const name = f.alias?.trim() || f.name;
      const firstChar = name.charAt(0).toUpperCase();
      if (!groups[firstChar]) groups[firstChar] = [];
      groups[firstChar].push(f);
    });
    return Object.keys(groups).sort().map((key) => ({
      label: key,
      items: groups[key].sort((a, b) => (a.alias?.trim() || a.name).localeCompare(b.alias?.trim() || b.name)),
    }));
  }, [friends, search]);

  const pendingCount = requests.length;
  const sentCount = sentRequests.length;

  return (
    <div className="w-[310px] bg-white border-r border-gray-200 flex flex-col h-screen shrink-0 animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Danh bạ</h2>
        <div className="flex items-center bg-gray-100 px-3 py-2 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-transparent focus-within:border-blue-300">
          <FaSearch className="text-gray-400 text-[13px] mr-2 shrink-0" />
          <input
            type="text"
            className="bg-transparent outline-none w-full text-sm text-gray-700 placeholder:text-gray-400"
            placeholder="Tìm bạn bè..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-50 shrink-0">
        <button
          onClick={() => setTab('friends')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${tab === 'friends' ? 'text-[#0e9de8]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Bạn bè
          {tab === 'friends' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#0e9de8] rounded-full" />}
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${tab === 'requests' ? 'text-[#0e9de8]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Lời mời
          {pendingCount > 0 && (
            <span className="absolute top-2 right-6 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
              {pendingCount}
            </span>
          )}
          {tab === 'requests' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#0e9de8] rounded-full" />}
        </button>
        <button
          onClick={() => setTab('blocked')}
          className={`flex-1 py-3 text-sm font-bold transition-all relative ${tab === 'blocked' ? 'text-[#0e9de8]' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Đã chặn
          {tab === 'blocked' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#0e9de8] rounded-full" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto messenger-scrollbar">
        {loading && friends.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-3 border-[#0e9de8]/20 border-t-[#0e9de8] rounded-full animate-spin" />
          </div>
        ) : tab === 'blocked' ? (
          <BlockedUsersPanel onUnblockSuccess={fetchFriends} />
        ) : tab === 'friends' ? (
          <div className="pb-10" onClick={() => setActiveFriendMenu(null)}>
            {groupedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-300">
                <FaUserFriends className="text-5xl opacity-20" />
                <span className="text-sm font-medium">Chưa có bạn bè nào</span>
              </div>
            ) : (
              groupedFriends.map((group) => (
                <div key={group.label}>
                  <div className="px-5 py-2 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
                    <span className="text-xs font-bold text-[#0e9de8]">{group.label}</span>
                  </div>
                  {group.items.map((friend) => (
                    <div
                      key={friend.userID}
                      className="flex items-center px-5 py-3.5 hover:bg-blue-50/30 transition-all cursor-pointer border-b border-gray-50 group"
                      onClick={() => handleStartChat(friend)}
                    >
                      <div className="relative mr-4 shrink-0">
                        <img
                          src={friend.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + friend.userID}
                          alt="avatar"
                          className="w-12 h-12 rounded-full object-cover bg-gray-100 shadow-sm border border-gray-100"
                        />
                        <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${friend.trangThai === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14.5px] font-bold text-gray-800 truncate">
                            {friend.alias?.trim() ? friend.alias : friend.name}
                          </p>
                          {friend.alias?.trim() && <FaUserTag className="text-[10px] text-blue-400" title="Biệt danh" />}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{friend.sdt}</p>
                      </div>
                      <div className="relative">
                        <button
                          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFriendMenu(activeFriendMenu === friend.userID ? null : friend.userID);
                          }}
                        >
                          <FaEllipsisH className="text-[14px]" />
                        </button>

                        {activeFriendMenu === friend.userID && (
                          <div 
                            className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-100 z-[100] py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 text-blue-600 transition-colors"
                              onClick={() => {
                                handleStartChat(friend);
                                setActiveFriendMenu(null);
                              }}
                            >
                              <FaCommentDots className="text-sm" />
                              <span className="text-[13.5px] font-medium">Nhắn tin</span>
                            </button>
                            <button
                              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-gray-600 transition-colors"
                              onClick={() => {
                                setUserToBlock(friend);
                                setActiveFriendMenu(null);
                              }}
                            >
                              <FaBan className="text-sm text-gray-400" />
                              <span className="text-[13.5px] font-medium">Chặn</span>
                            </button>
                            <div className="h-[1px] bg-gray-50 my-1" />
                            <button
                              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50 text-red-500 transition-colors"
                              onClick={() => {
                                setUserToUnfriend(friend);
                                setActiveFriendMenu(null);
                              }}
                            >
                              <FaTrash className="text-sm opacity-70" />
                              <span className="text-[13.5px] font-medium">Xóa bạn bè</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col pb-10">
            {/* Lời mời nhận được */}
            <div
              className="px-5 py-2.5 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm flex justify-between items-center cursor-pointer hover:bg-gray-100/50 transition-colors"
              onClick={() => setIsReceivedExpanded(!isReceivedExpanded)}
            >
              <div className="flex items-center gap-2">
                {isReceivedExpanded ? <FaChevronDown className="text-[10px] text-gray-400" /> : <FaChevronRight className="text-[10px] text-gray-400" />}
                <span className="text-xs font-bold text-[#0e9de8]">Lời mời kết bạn ({pendingCount})</span>
              </div>
            </div>
            {isReceivedExpanded && (
              requests.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-300">
                  <FaEnvelopeOpenText className="text-3xl opacity-20" />
                  <span className="text-xs">Không có lời mời nào</span>
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req.contactID} className="p-4 border-b border-gray-50 hover:bg-orange-50/10 transition-colors">
                    <div className="flex items-start gap-4">
                      <img
                        src={req.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + req.contactID}
                        alt="avatar"
                        className="w-12 h-12 rounded-full object-cover bg-gray-100 shadow-sm shrink-0 cursor-pointer"
                        onClick={() => handleViewProfile(req, 'pending_received')}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate text-sm hover:text-[#0e9de8] cursor-pointer inline-block" onClick={() => handleViewProfile(req, 'pending_received')}>
                          {req.name}
                        </p>
                        <p className="text-xs text-gray-400 mb-2">{req.sdt}</p>
                        <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 relative mb-3">
                          <div className="absolute -top-1.5 left-3 w-3 h-3 bg-gray-50 border-l border-t border-gray-100 rotate-45" />
                          <p className="text-xs text-gray-600 italic line-clamp-2">"{req.message || 'Mình kết bạn nhé!'}"</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAccept(req)} className="flex-1 py-1.5 bg-[#0e9de8] text-white text-xs font-bold rounded-lg hover:bg-[#0077c2] shadow-sm transition-all">Chấp nhận</button>
                          <button onClick={() => handleReject(req)} className="flex-1 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-500 transition-all">Từ chối</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
            {/* Lời mời đã gửi */}
            <div
              className="px-5 py-2.5 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm mt-4 border-t border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100/50 transition-colors"
              onClick={() => setIsSentExpanded(!isSentExpanded)}
            >
              <div className="flex items-center gap-2">
                {isSentExpanded ? <FaChevronDown className="text-[10px] text-gray-400" /> : <FaChevronRight className="text-[10px] text-gray-400" />}
                <span className="text-xs font-bold text-[#0e9de8]">Lời mời đã gửi ({sentCount})</span>
              </div>
            </div>
            {isSentExpanded && (
              sentRequests.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-300">
                  <FaUndo className="text-3xl opacity-20" />
                  <span className="text-xs">Chưa gửi lời mời nào</span>
                </div>
              ) : (
                sentRequests.map((req) => (
                  <div key={req.recipientID} className="p-4 border-b border-gray-50 hover:bg-blue-50/10 transition-colors">
                    <div className="flex items-start gap-4">
                      <img
                        src={req.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + req.recipientID}
                        alt="avatar"
                        className="w-12 h-12 rounded-full object-cover bg-gray-100 shadow-sm shrink-0 cursor-pointer"
                        onClick={() => handleViewProfile(req, 'pending_sent')}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-gray-800 truncate text-sm hover:text-[#0e9de8] cursor-pointer" onClick={() => handleViewProfile(req, 'pending_sent')}>{req.name}</p>
                          <FaUndo className="text-gray-300 text-[10px]" title="Đang chờ phản hồi" />
                        </div>
                        <p className="text-[11px] text-gray-400 mb-2">Bạn đã gửi lời mời</p>
                        <button onClick={() => setRequestToRecall(req)} className="w-full py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center gap-2">
                          Thu hồi lời mời
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {selectedProfile && (
        <OtherProfileModal
          user={selectedProfile}
          currentUser={user}
          onClose={() => setSelectedProfile(null)}
          onStartChat={onStartChat}
          onAccept={() => {
            handleAccept({ contactID: selectedProfile.userID, name: selectedProfile.name } as any);
            setSelectedProfile(null);
          }}
          onReject={() => {
            handleReject({ contactID: selectedProfile.userID } as any);
            setSelectedProfile(null);
          }}
          onRecall={() => {
            handleCancelSent({ recipientID: selectedProfile.userID } as any);
            setSelectedProfile(null);
          }}
        />
      )}

      {/* Confirmation Modals */}
      {requestToRecall && (
        <ConfirmActionModal title="Xác nhận thu hồi" message={`Bạn có chắc muốn thu hồi lời mời kết bạn gửi đến ${requestToRecall.name}?`} danger onCancel={() => setRequestToRecall(null)} onConfirm={handleCancelSent} />
      )}
      {userToBlock && (
        <ConfirmActionModal title="Chặn liên hệ" message={`Bạn có chắc muốn chặn ${userToBlock.name}? Cả hai sẽ không thể gửi tin nhắn cho nhau.`} danger onCancel={() => setUserToBlock(null)} onConfirm={handleBlock} />
      )}
      {userToUnfriend && (
        <ConfirmActionModal title="Hủy kết bạn" message={`Bạn có chắc muốn hủy kết bạn với ${userToUnfriend.name}?`} danger onCancel={() => setUserToUnfriend(null)} onConfirm={handleUnfriend} />
      )}
    </div>
  );
};

const ConfirmActionModal = ({ title, message, onConfirm, onCancel, danger }: any) => (
  <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
    <div className="bg-white w-[320px] rounded-2xl shadow-2xl overflow-hidden animate-modal-pop">
      <div className="p-6 text-center">
        <div className={`w-14 h-14 ${danger ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <FaExclamationCircle className="text-2xl" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
      </div>
      <div className="flex border-t border-gray-100">
        <button onClick={onCancel} className="flex-1 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors border-r border-gray-100">Hủy</button>
        <button onClick={onConfirm} className={`flex-1 py-4 text-sm font-bold ${danger ? 'text-red-500 hover:bg-red-50' : 'text-blue-500 hover:bg-blue-50'} transition-colors`}>Xác nhận</button>
      </div>
    </div>
  </div>
);

export default ContactsPanel;
