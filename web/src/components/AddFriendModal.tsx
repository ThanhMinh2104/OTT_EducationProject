import { useState, useEffect, useRef } from 'react';
import { FaTimes, FaChevronLeft, FaSearch, FaUndo, FaUserTag, FaCommentDots } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import OtherProfileModal from './OtherProfileModal';

// Kết nối Socket toàn cục để đồng bộ
const socket: Socket = io('http://localhost:5000');

interface FoundUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'blocked';
  alias?: string;
}

const AddFriendModal = ({ onClose, currentUser, onStartChat }: any) => {
  // --- LUỒNG DỮ LIỆU (STATES) ---
  const [step, setStep] = useState<'search' | 'profile' | 'add_friend'>('search');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [recentFound, setRecentFound] = useState<FoundUser[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });

  // --- LOGIC ĐỒNG BỘ (EFFECTS) ---

  // Tự động lưu vào máy khi danh sách thay đổi
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentFound));
  }, [recentFound]);

  // Cập nhật trạng thái mới nhất khi vừa mở Modal
  useEffect(() => {
    if (recentFound.length > 0) {
      const refresh = async () => {
        const updated = await Promise.all(recentFound.map(async (u) => {
          try {
            const res = await axiosInstance.post('/contacts/search-friend-by-phone', { phoneNumber: u.sdt });
            return { ...res.data, alias: u.alias || res.data.name };
          } catch { return u; }
        }));
        setRecentFound(updated);
      };
      refresh();
    }
  }, []);

  // Lắng nghe Socket để đổi nhãn [Bạn bè] ngay lập tức
  useEffect(() => {
    if (!currentUser) return;
    socket.emit('join_user', currentUser.userID);

    const handleStatusChange = (targetID: string, newStatus: any) => {
      setRecentFound(prev => prev.map(u => u.userID === targetID ? { ...u, friendStatus: newStatus } : u));
      if (selectedUser?.userID === targetID) setSelectedUser(prev => prev ? { ...prev, friendStatus: newStatus } : null);
    };

    socket.on('friend_request_accepted', (data) => handleStatusChange(data.userID, 'accepted'));
    socket.on('friend_request_cancelled', (data) => handleStatusChange(data.senderID === currentUser.userID ? data.recipientID : data.senderID, 'none'));
    socket.on('new_friend_request', (data) => handleStatusChange(data.contactID, 'pending_received'));

    return () => { socket.off('friend_request_accepted'); socket.off('friend_request_cancelled'); socket.off('new_friend_request'); };
  }, [currentUser?.userID, selectedUser?.userID]);

  // --- HÀNH ĐỘNG (ACTIONS) ---

  const handleSearch = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post('/contacts/search-friend-by-phone', { phoneNumber: phone });
      const user = { ...res.data, alias: res.data.name };
      setRecentFound(prev => [user, ...prev.filter(u => u.userID !== user.userID)].slice(0, 10));
      setSelectedUser(user);
      setStep('profile');
    } catch {
      toast.error('Không tìm thấy người dùng');
    } finally { setLoading(false); }
  };

  const handleAction = async (api: string, targetID: string, nextStatus: any) => {
    try {
      await axiosInstance.post(api, { senderID: targetID, recipientID: targetID });
      setRecentFound(prev => prev.map(u => u.userID === targetID ? { ...u, friendStatus: nextStatus } : u));
      setSelectedUser(prev => prev ? { ...prev, friendStatus: nextStatus } : null);
      if (api.includes('cancel')) toast.success('Đã thu hồi');
    } catch { toast.error('Thao tác thất bại'); }
  };

  // --- GIAO DIỆN HỖ TRỢ (SUB-COMPONENTS) ---

  const StatusLabel = ({ status }: { status: string }) => {
    const labels: any = {
      'accepted': <span className="text-green-400 font-bold mr-2 text-[11px]">[Bạn bè]</span>,
      'pending_sent': <span className="text-orange-400 font-bold mr-2 text-[11px]">[Đã gửi lời mời]</span>,
      'pending_received': <span className="text-blue-400 font-bold mr-2 text-[11px]">[Lời mời kết bạn]</span>,
      'self': <span className="text-gray-500 font-bold mr-2 text-[11px]">[Tôi]</span>
    };
    return labels[status] || null;
  };

  // --- GIAO DIỆN CHÍNH (RENDERS) ---

  if (step === 'profile' && selectedUser) {
    return (
      <OtherProfileModal
        user={selectedUser as any} currentUser={currentUser} onClose={onClose}
        onBack={() => setStep('search')} onStartChat={onStartChat}
        onAccept={() => handleAction('/contacts/accept-friend-request', selectedUser.userID, 'accepted')}
        onReject={() => handleAction('/contacts/reject-friend-request', selectedUser.userID, 'none')}
        onRecall={() => handleAction('/contacts/cancel-friend-request', selectedUser.userID, 'none')}
        onAddFriend={() => setStep('add_friend')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div className="bg-white w-full sm:w-[400px] h-full sm:h-[600px] sm:rounded-md shadow-2xl flex flex-col relative animate-modal-pop">
        {/* Tiêu đề */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold">Thêm bạn</h2>
          <button onClick={onClose}><FaTimes className="text-xl text-gray-400" /></button>
        </div>

        {/* Ô tìm kiếm */}
        <div className="p-5">
          <div className="relative">
            <input
              type="text" value={phone} onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Nhập số điện thoại..."
              className="w-full px-4 py-3 border rounded-xl outline-none focus:border-blue-500"
              autoFocus
            />
            <button onClick={handleSearch} className="absolute right-3 top-3.5 text-blue-500"><FaSearch /></button>
          </div>
        </div>

        {/* Danh sách kết quả gần đây */}
        <div className="flex-1 overflow-y-auto px-5">
          {recentFound.length > 0 && (
            <>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Kết quả gần nhất</p>
              {recentFound.map(user => (
                <div key={user.userID} onClick={() => { setSelectedUser(user); setStep('profile'); }} className="flex items-center py-3 hover:bg-gray-50 cursor-pointer group rounded-lg">
                  <img src={user.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userID}`} className="w-11 h-11 rounded-full border" />
                  <div className="flex-1 ml-3 overflow-hidden">
                    <p className="font-bold truncate text-[14.5px]">{user.name}</p>
                    <p className="text-[12px] text-gray-400 flex items-center">
                      <StatusLabel status={user.friendStatus} /> {user.sdt}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setRecentFound(prev => prev.filter(u => u.userID !== user.userID)); }} className="opacity-0 group-hover:opacity-100 p-2"><FaTimes className="text-gray-300" /></button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-md">
          <button onClick={onClose} className="px-6 py-2 bg-gray-200 rounded-lg text-sm font-bold">Hủy</button>
          <button onClick={handleSearch} className="px-8 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Tìm kiếm</button>
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
