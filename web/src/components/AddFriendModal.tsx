import { useState, useEffect, useRef } from 'react';
import {
  FaTimes,
  FaChevronLeft,
  FaPen,
  FaCommentDots
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import socket from '../utils/socket';
import OtherProfileModal from './OtherProfileModal';

interface Props {
  onClose: () => void;
  currentUser: { userID: string; name: string; anhDaiDien?: string } | null;
  onStartChat: (chat: any) => void;
}

// Thông tin người dùng tìm được
interface FoundUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
  alias?: string;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'blocked';
}

// Các bước trong luồng thêm bạn
type Step = 'search' | 'profile' | 'add_friend';

const AddFriendModal = ({ onClose, currentUser, onStartChat }: Props) => {
  const [step, setStep] = useState<Step>('search');
  const [phone, setPhone] = useState('');

  // Khởi tạo danh sách tìm kiếm gần đây từ localStorage
  const [recentFound, setRecentFound] = useState<FoundUser[]>(() => {
    try {
      const stored = localStorage.getItem('recentSearches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Trạng thái chỉnh sửa tên gợi nhớ
  const [alias, setAlias] = useState('');
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const aliasInputRef = useRef<HTMLInputElement>(null);

  // Tin nhắn kèm lời mời kết bạn
  const [message, setMessage] = useState('');

  // Lưu danh sách tìm kiếm gần đây vào localStorage khi thay đổi
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentFound));
  }, [recentFound]);

  // Focus input khi đang chỉnh sửa alias
  useEffect(() => {
    if (isEditingAlias && aliasInputRef.current) {
      aliasInputRef.current.focus();
    }
  }, [isEditingAlias]);

  // Lắng nghe Socket để đồng bộ trạng thái khi thu hồi / chấp nhận lời mời
  useEffect(() => {
    if (!currentUser) return;
    socket.emit('join_user', currentUser.userID);

    // Xử lý khi lời mời bị thu hồi
    const handleCancelled = (data: { senderID: string, recipientID: string }) => {
      // Xác định người cần cập nhật trạng thái về 'none'
      const targetID = data.senderID === currentUser.userID ? data.recipientID : data.senderID;

      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === targetID ? { ...u, friendStatus: 'none' as const } : u);
        // Đồng bộ localStorage ngay để tránh dữ liệu cũ khi reload
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        return updated;
      });

      if (selectedUser?.userID === targetID) {
        setSelectedUser(prev => prev ? { ...prev, friendStatus: 'none' } : null);
      }
    };

    // Xử lý khi lời mời được chấp nhận
    const handleAccepted = (data: { userID: string, name: string }) => {
      const targetID = data.userID;
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === targetID ? { ...u, friendStatus: 'accepted' as const } : u);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        return updated;
      });
      if (selectedUser?.userID === targetID) {
        setSelectedUser(prev => prev ? { ...prev, friendStatus: 'accepted' } : null);
      }
    };

    const handleRejected = (data: { senderID: string, recipientID: string }) => {
      const targetID = data.senderID === currentUser.userID ? data.recipientID : data.senderID;
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === targetID ? { ...u, friendStatus: 'none' as const } : u);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        return updated;
      });
      if (selectedUser?.userID === targetID) {
        setSelectedUser(prev => prev ? { ...prev, friendStatus: 'none' } : null);
      }
    };

    const handleUnfriended = (data: { userID: string, friendID: string }) => {
      const targetID = data.userID === currentUser.userID ? data.friendID : data.userID;
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === targetID ? { ...u, friendStatus: 'none' as const } : u);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
        return updated;
      });
      if (selectedUser?.userID === targetID) {
        setSelectedUser(prev => prev ? { ...prev, friendStatus: 'none' } : null);
      }
    };

    socket.on('friend_request_cancelled', handleCancelled);
    socket.on('friend_request_accepted', handleAccepted);
    socket.on('friend_request_rejected', handleRejected);
    socket.on('friend_unfriended', handleUnfriended);

    return () => {
      socket.off('friend_request_cancelled', handleCancelled);
      socket.off('friend_request_accepted', handleAccepted);
      socket.off('friend_request_rejected', handleRejected);
      socket.off('friend_unfriended', handleUnfriended);
    };
  }, [currentUser, selectedUser?.userID]);

  // Tìm kiếm người dùng bằng số điện thoại
  const handleSearch = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post('/contacts/search-friend-by-phone', { phoneNumber: phone });
      const user = res.data;

      // Thêm vào danh sách tìm kiếm gần đây (tối đa 10)
      setRecentFound(prev => {
        const filtered = prev.filter(u => u.userID !== user.userID);
        return [{ ...user, alias: user.name }, ...filtered].slice(0, 10);
      });

      // Tự động mở profile nếu tìm thấy
      handleUserClick({ ...user, alias: user.name });
    } catch {
      toast.error('Không tìm thấy người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý khi click vào một người dùng trong danh sách
  // Luôn gọi API để lấy trạng thái mới nhất (tránh dữ liệu cũ trong localStorage)
  const handleUserClick = async (user: FoundUser) => {
    try {
      // Re-fetch để lấy friendStatus chính xác nhất từ server
      const res = await axiosInstance.post('/contacts/search-friend-by-phone', { phoneNumber: user.sdt });
      const freshUser: FoundUser = { ...res.data, alias: user.alias || res.data.name };

      // Cập nhật lại danh sách gần đây với dữ liệu mới
      setRecentFound(prev =>
        prev.map(u => u.userID === freshUser.userID ? freshUser : u)
      );

      setSelectedUser(freshUser);
      setAlias(freshUser.alias || freshUser.name);
      setIsEditingAlias(false);
      setMessage(`Xin chào, mình là ${currentUser?.name || ''}. Mình tìm thấy bạn bằng số điện thoại. Kết bạn với mình nhé!`);
      setStep('profile');
    } catch {
      // Nếu API lỗi, fallback dùng dữ liệu cache cũ
      setSelectedUser(user);
      setAlias(user.alias || user.name);
      setIsEditingAlias(false);
      setMessage(`Xin chào, mình là ${currentUser?.name || ''}. Mình tìm thấy bạn bằng số điện thoại. Kết bạn với mình nhé!`);
      setStep('profile');
    }
  };

  // Lưu tên gợi nhớ mới
  const handleSaveAlias = () => {
    const newAlias = alias.trim() || selectedUser?.name || '';
    setIsEditingAlias(false);
    setAlias(newAlias);

    // Cập nhật alias trong danh sách tìm kiếm gần đây
    if (selectedUser) {
      setSelectedUser({ ...selectedUser, alias: newAlias });
      setRecentFound(prev =>
        prev.map(u => u.userID === selectedUser.userID ? { ...u, alias: newAlias } : u)
      );
    }
  };

  // Xóa một user khỏi danh sách tìm kiếm gần đây
  const handleRemoveRecent = (e: React.MouseEvent, userID: string) => {
    e.stopPropagation(); // Tránh trigger onClick của thẻ cha
    setRecentFound(prev => prev.filter(u => u.userID !== userID));
  };

  // Gửi lời mời kết bạn
  const handleSendRequest = async () => {
    if (!selectedUser) return;
    setSending(true);
    try {
      await axiosInstance.post('/contacts/send-friend-request', {
        recipientPhone: selectedUser.sdt,
        alias: alias.trim(),
        message: message.trim()
      });

      // Cập nhật trạng thái sang 'pending_sent' (đã gửi yêu cầu)
      setSelectedUser({ ...selectedUser, friendStatus: 'pending_sent' });
      setRecentFound(prev => prev.map(u => u.userID === selectedUser.userID ? { ...u, friendStatus: 'pending_sent' } : u));

      toast.success('Đã gửi lời mời kết bạn');
      setStep('profile'); // Quay lại xem profile
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi gửi lời mời');
    } finally {
      setSending(false);
    }
  };

  // Thu hồi lời mời kết bạn
  const handleRecall = async () => {
    if (!selectedUser) return;
    try {
      await axiosInstance.post('/contacts/cancel-friend-request', {
        recipientID: selectedUser.userID
      });
      setSelectedUser({ ...selectedUser, friendStatus: 'none' });
      setRecentFound(prev => prev.map(u => u.userID === selectedUser.userID ? { ...u, friendStatus: 'none' } : u));
      toast.success('Đã thu hồi lời mời kết bạn');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi thu hồi lời mời');
    }
  };

  // Mở cuộc trò chuyện với người dùng
  const handleStartChat = async () => {
    if (!selectedUser) return;
    try {
      const res = await axiosInstance.post('/createChat1-1', { userID2: selectedUser.userID });
      onStartChat(res.data);
      onClose();
    } catch {
      toast.error('Không thể mở cuộc trò chuyện');
    }
  };

  // === Giao diện tìm kiếm ===
  const renderSearch = () => (
    <div className="w-full flex justify-center h-full sm:h-auto sm:items-center">
      <div className="bg-white w-full sm:w-[400px] h-full sm:h-[600px] sm:rounded-md shadow-2xl flex flex-col text-gray-800">
        {/* Tiêu đề */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold">Thêm bạn</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Ô nhập số điện thoại */}
        <div className="px-5 pt-6 pb-2">
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Nhập số điện thoại..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[15px] text-gray-800 outline-none focus:border-[#0068FF] transition-colors"
            autoFocus
          />
        </div>

        {/* Hiệu ứng loading khi tìm kiếm */}
        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-[#0e9de8] rounded-full animate-spin"></div>
          </div>
        )}

        {/* Danh sách kết quả tìm kiếm gần đây */}
        <div className="flex-1 overflow-y-auto pb-4">
          {/* Recent Results */}
          {recentFound.length > 0 && !loading && (
            <div className="mt-4">
              <p className="px-5 text-[13px] text-gray-500 mb-2 font-medium">Kết quả gần nhất</p>
              {recentFound.map(user => (
                <div
                  key={user.userID}
                  className="flex items-center px-5 py-3 hover:bg-gray-50 cursor-pointer group transition-colors"
                  onClick={() => handleUserClick(user)}
                >
                  <img
                    src={user.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userID}
                    alt="avatar"
                    className="w-[44px] h-[44px] rounded-full object-cover mr-3 bg-gray-100 border border-gray-200"
                  />
                  <div className="flex-1">
                    <p className="text-[14.5px] font-semibold text-gray-900">{user.alias || user.name}</p>
                    <p className="text-[13px] text-gray-500 mt-0.5 ml-0.5">
                      {/* Hiển thị trạng thái quan hệ bên cạnh SĐT */}
                      {user.friendStatus === 'pending_sent' && <span className="text-orange-500 mr-2">[Đã gửi lời mời]</span>}
                      {user.friendStatus === 'pending_received' && <span className="text-blue-500 mr-2">[Lời mời kết bạn]</span>}
                      {user.friendStatus === 'accepted' && <span className="text-green-500 mr-2">[Bạn bè]</span>}
                      {user.sdt}
                    </p>
                  </div>
                  {/* Nút Nhắn tin nhanh */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      // Kích hoạt nhắn tin (hàm handleStartChat yêu cầu selectedUser phải được set)
                      setTimeout(() => {
                        const btn = document.getElementById('start-chat-hidden-btn');
                        btn?.click();
                      }, 0);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 text-[#0068FF] hover:bg-[#0068FF] hover:text-white transition-all mr-1"
                    title="Nhắn tin ngay"
                  >
                    <FaCommentDots className="text-[17px]" />
                  </button>
                  {/* Nút xóa kết quả gần đây */}
                  <button
                    onClick={(e) => handleRemoveRecent(e, user.userID)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    title="Xóa"
                  >
                    <FaTimes className="text-[14px]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nút hủy / tìm kiếm */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-md shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-[14.5px] font-semibold bg-[#E5E7EB] hover:bg-gray-300 text-gray-800 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-8 py-2 rounded-lg text-[14.5px] font-semibold bg-[#0068FF] hover:bg-[#005AE6] transition-colors disabled:opacity-50 text-white"
          >
            Tìm kiếm
          </button>
        </div>
        
        {/* Hidden button to trigger start chat logic safely */}
        <button id="start-chat-hidden-btn" className="hidden" onClick={handleStartChat} />
      </div>
    </div>
  );

  // === Giao diện gửi lời mời kết bạn ===
  const renderAddFriend = () => {
    if (!selectedUser) return null;
    return (
      <div className="w-full h-full flex justify-center sm:items-center">
        <div className="bg-white w-full sm:w-[400px] h-full sm:h-auto sm:rounded-md shadow-2xl flex flex-col text-gray-800 relative">
          {/* Header overlay trên ảnh bìa */}
          <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent rounded-t-md">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => setStep('profile')}>
              <FaChevronLeft className="text-white text-[15px]" />
              <span className="text-white text-[15px] font-semibold">Thông tin tài khoản</span>
            </div>
            <button onClick={onClose} className="text-gray-900/90 hover:text-gray-900">
              <FaTimes className="text-xl" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto sm:overflow-visible">
            {/* Ảnh bìa & Avatar */}
            <div className="relative mb-12 shrink-0">
              <img
                src={selectedUser.anhBia || "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=600&auto=format"}
                alt="cover"
                className="w-full h-[160px] object-cover sm:rounded-t-md bg-gray-200"
              />
              <div className="absolute -bottom-6 left-5 flex items-end gap-3">
                <img
                  src={selectedUser.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + selectedUser.userID}
                  alt="avatar"
                  className="w-[72px] h-[72px] rounded-full object-cover border-[3px] border-white bg-gray-100 shadow-sm"
                />
              </div>
              <div className="absolute -bottom-1 left-[110px] flex items-center gap-1.5">
                <h2 className="text-[17px] font-bold text-gray-900">{alias || selectedUser.name}</h2>
                <FaPen
                  className="text-gray-500 text-[11px] cursor-pointer"
                  title="Sửa tên gợi nhớ"
                  onClick={() => setStep('profile')}
                />
              </div>
            </div>

            {/* Form nhập tin nhắn kèm lời mời */}
            <div className="px-5 pb-6">
              <div className="border border-gray-300 rounded-lg p-3 shadow-sm focus-within:border-[#0068FF] transition-colors">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={150}
                  rows={4}
                  className="w-full bg-transparent outline-none resize-none text-[14.5px] text-gray-800"
                />
                <div className="text-right text-[12px] text-gray-400 font-medium">
                  {message.length}/150 ký tự
                </div>
              </div>
            </div>
          </div>

          {/* Nút thông tin / kết bạn */}
          <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-md mt-auto">
            <button
              onClick={() => setStep('profile')}
              className="px-6 py-2.5 rounded-lg text-[14.5px] font-semibold bg-[#E5E7EB] hover:bg-gray-300 text-gray-800 transition-colors"
            >
              Thông tin
            </button>
            <button
              onClick={handleSendRequest}
              disabled={sending}
              className="px-8 py-2.5 rounded-lg text-[14.5px] font-semibold bg-[#0068FF] hover:bg-[#005AE6] transition-colors disabled:opacity-50 text-white"
            >
              {sending ? 'Đang gửi...' : 'Kết bạn'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Wrapper backdrop chỉ hiển thị cho search và add_friend */}
      {/* OtherProfileModal đã có backdrop riêng nên KHÔNG đặt bên trong wrapper này */}
      {(step === 'search' || step === 'add_friend') && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 font-['Segoe_UI',sans-serif]">
          {step === 'search' && renderSearch()}
          {step === 'add_friend' && renderAddFriend()}
        </div>
      )}

      {/* Modal xem profile - render ngoài wrapper để tránh 2 lớp backdrop chồng lên nhau */}
      {step === 'profile' && selectedUser && (
        <OtherProfileModal
          user={selectedUser}
          currentUser={currentUser}
          onClose={onClose}
          onBack={() => {
            setStep('search');
            setPhone('');
          }}
          onStartChat={onStartChat}
          onAddFriend={() => setStep('add_friend')}
          onRecall={handleRecall}
        />
      )}
    </>
  );
};

export default AddFriendModal;
