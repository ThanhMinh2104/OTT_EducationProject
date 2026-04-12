import { useState, useEffect, useRef } from 'react';
import {
  FaTimes,
  FaChevronLeft,
  FaPen,
  FaBan,
  FaExclamationTriangle,
  FaUserFriends,
  FaAngleDown,
  FaCheck,
  FaCamera
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  currentUser: { userID: string; name: string; anhDaiDien?: string } | null;
  onStartChat: (chat: any) => void;
}

interface FoundUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
  alias?: string;
  friendStatus: 'none' | 'pending' | 'accepted' | 'self' | 'blocked';
}

type Step = 'search' | 'profile' | 'add_friend';

const AddFriendModal = ({ onClose, currentUser, onStartChat }: Props) => {
  const [step, setStep] = useState<Step>('search');
  const [phone, setPhone] = useState('');

  // Initialize recent searches from localStorage
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

  // States for Alias Edit
  const [alias, setAlias] = useState('');
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const aliasInputRef = useRef<HTMLInputElement>(null);

  // Message for Add Friend
  const [message, setMessage] = useState('');

  // Persist recent searches
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentFound));
  }, [recentFound]);

  // Focus input when editing alias
  useEffect(() => {
    if (isEditingAlias && aliasInputRef.current) {
      aliasInputRef.current.focus();
    }
  }, [isEditingAlias]);

  const handleSearch = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post('/contacts/search-friend-by-phone', { phoneNumber: phone });
      const user = res.data;

      // Update recent searches
      setRecentFound(prev => {
        const filtered = prev.filter(u => u.userID !== user.userID);
        return [{ ...user, alias: user.name }, ...filtered].slice(0, 10); // Keep up to 10 recent
      });

      handleUserClick({ ...user, alias: user.name }); // Tự động mở profile nếu tìm thấy
    } catch {
      toast.error('Không tìm thấy người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (user: FoundUser) => {
    setSelectedUser(user);
    setAlias(user.alias || user.name);
    setIsEditingAlias(false);
    setMessage(`Xin chào, mình là ${currentUser?.name || ''}. Mình tìm thấy bạn bằng số điện thoại. Kết bạn với mình nhé!`);
    setStep('profile');
  };

  const handleSaveAlias = () => {
    const newAlias = alias.trim() || selectedUser?.name || '';
    setIsEditingAlias(false);
    setAlias(newAlias);

    // Cập nhật lại alias trong danh sách tìm kiếm gần đây để không bị mất khi thoát modal
    if (selectedUser) {
      setSelectedUser({ ...selectedUser, alias: newAlias });
      setRecentFound(prev =>
        prev.map(u => u.userID === selectedUser.userID ? { ...u, alias: newAlias } : u)
      );
    }
  };

  const handleRemoveRecent = (e: React.MouseEvent, userID: string) => {
    e.stopPropagation(); // Tránh trigger onClick của thẻ cha
    setRecentFound(prev => prev.filter(u => u.userID !== userID));
  };

  const handleSendRequest = async () => {
    if (!selectedUser) return;
    setSending(true);
    try {
      await axiosInstance.post('/contacts/send-friend-request', {
        recipientPhone: selectedUser.sdt,
        alias: alias.trim(),
        message: message.trim()
      });

      // Update selectedUser status
      setSelectedUser({ ...selectedUser, friendStatus: 'pending' });
      // Update in recentFound
      setRecentFound(prev => prev.map(u => u.userID === selectedUser.userID ? { ...u, friendStatus: 'pending' } : u));

      toast.success('Đã gửi lời mời kết bạn');
      setStep('profile'); // Go back to profile view
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi gửi lời mời');
    } finally {
      setSending(false);
    }
  };

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day} tháng ${month}, ${date.getFullYear()}`;
  };

  const renderSearch = () => (
    <div className="w-full flex justify-center h-full sm:h-auto sm:items-center">
      <div className="bg-white w-full sm:w-[400px] h-full sm:h-[600px] sm:rounded-md shadow-2xl flex flex-col text-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold">Thêm bạn</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Input */}
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

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-[#0e9de8] rounded-full animate-spin"></div>
          </div>
        )}

        {/* Content Area (Recent & Suggestions) */}
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
                    <p className="text-[13px] text-gray-500 mt-0.5">{(user.sdt.startsWith('0') ? '(+84) ' + user.sdt.substring(1) : user.sdt)}</p>
                  </div>
                  {/* Delete cross for recent search */}
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

        {/* Footer buttons */}
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
      </div>
    </div>
  );

  const renderProfile = () => {
    if (!selectedUser) return null;
    return (
      <div className="w-full flex justify-center h-full sm:h-auto sm:items-center">
        <div className="bg-white w-full sm:w-[400px] h-full sm:h-[700px] sm:rounded-md shadow-2xl flex flex-col text-gray-800 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded relative">
          {/* Header overlay on cover image */}
          <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => {
                setStep('search');
                setPhone('');
              }}
            >
              <FaChevronLeft className="text-white text-[15px]" />
              <span className="text-white text-[15px] font-semibold shadow-sm">Thông tin tài khoản</span>
            </div>
            <button onClick={onClose} className="text-white/90 hover:text-white">
              <FaTimes className="text-xl" />
            </button>
          </div>

          {/* Cover Image & Avatar */}
          <div className="relative mb-14 shrink-0">
            <img
              src={selectedUser.anhBia || "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=600&auto=format"}
              alt="cover"
              className="w-full h-[220px] object-cover bg-gray-200"
            />
            <div className="absolute -bottom-10 left-5">
              <div className="relative">
                <img
                  src={selectedUser.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + selectedUser.userID}
                  alt="avatar"
                  className="w-[84px] h-[84px] rounded-full object-cover border-4 border-white bg-gray-100 shadow-sm"
                />
                {selectedUser.friendStatus === 'self' && (
                  <div className="absolute bottom-0 right-0 w-7 h-7 bg-gray-100 rounded-full shadow-md border-2 border-white flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <FaCamera className="text-gray-700 text-[12px]" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name & Actions */}
          <div className="px-5 pb-5 border-b-[8px] border-gray-100">
            <div className="flex items-center gap-2 mb-5">
              {isEditingAlias ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    ref={aliasInputRef}
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Nhập tên gợi nhớ"
                    className="flex-1 border-b-2 border-[#0e9de8] text-xl font-semibold text-gray-900 outline-none pb-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveAlias();
                    }}
                  />
                  <button onClick={handleSaveAlias} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-[#0e9de8] shrink-0">
                    <FaCheck />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-[22px] font-bold text-gray-900 truncate max-w-[280px]">
                    {alias || selectedUser.name}
                  </h2>
                  <button
                    onClick={() => setIsEditingAlias(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 shrink-0 transition-colors"
                    title="Đổi tên gợi nhớ"
                  >
                    <FaPen className="text-[13px]" />
                  </button>
                </>
              )}
            </div>

            {selectedUser.friendStatus === 'self' ? (
              <div className="text-gray-500 text-[14.5px] italic text-center py-2">Đây là bạn</div>
            ) : (
              <div className="flex gap-3">
                {selectedUser.friendStatus === 'accepted' ? (
                  <button className="flex-1 py-2.5 rounded-lg text-[14.5px] font-semibold bg-gray-100 text-gray-800" disabled>
                    Tất cả bạn bè
                  </button>
                ) : selectedUser.friendStatus === 'pending' ? (
                  <button className="flex-1 py-2.5 rounded-lg text-[14.5px] font-semibold bg-gray-100 text-gray-800 flex items-center justify-center gap-2" disabled>
                    Đã gửi yêu cầu
                  </button>
                ) : (
                  <button
                    onClick={() => setStep('add_friend')}
                    className="flex-1 py-2 rounded-lg text-[14.5px] font-semibold bg-[#E5E7EB] hover:bg-gray-300 text-gray-800 transition-colors"
                  >
                    Kết bạn
                  </button>
                )}
                <button
                  onClick={handleStartChat}
                  className="flex-1 py-2 rounded-lg text-[14.5px] font-semibold bg-[#0068FF] hover:bg-[#005AE6] text-white transition-colors"
                >
                  Nhắn tin
                </button>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="px-5 py-4 border-b-[8px] border-gray-100">
            <h3 className="text-[15px] font-bold text-gray-900 mb-4">Thông tin cá nhân</h3>
            <div className="space-y-4 text-[14.5px]">
              <div className="flex">
                <span className="w-28 text-gray-500">Giới tính</span>
                <span className="text-gray-900 font-medium">{selectedUser.gioTinh || '—'}</span>
              </div>
              <div className="flex">
                <span className="w-28 text-gray-500">Ngày sinh</span>
                <span className="text-gray-900 font-medium">{formatDate(selectedUser.ngaysinh)}</span>
              </div>
              {(selectedUser.friendStatus === 'accepted' || selectedUser.friendStatus === 'self') && (
                <>
                  <div className="flex">
                    <span className="w-28 text-gray-500">Điện thoại</span>
                    <span className="text-gray-900 font-medium">{selectedUser.sdt}</span>
                  </div>
                  <div className="pt-2">
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      Chỉ bạn bè có lưu số của bạn trong danh bạ máy xem được số này
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Options */}
          {selectedUser.friendStatus === 'self' ? (
            <div className="py-6 px-5 flex justify-center mt-auto mb-4">

            </div>
          ) : (
            <div className="py-2 mb-4">
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors">
                <FaUserFriends className="text-xl text-gray-400" />
                <span>Nhóm chung (0)</span>
              </div>
              {/* Đã bỏ: Chia sẻ danh thiếp */}
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-800 transition-colors mt-2">
                <FaBan className="text-xl text-gray-500" />
                <span>Chặn tin nhắn và cuộc gọi</span>
              </div>
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-800 transition-colors">
                <FaExclamationTriangle className="text-xl text-gray-500" />
                <span>Báo xấu</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAddFriend = () => {
    if (!selectedUser) return null;
    return (
      <div className="w-full h-full flex justify-center sm:items-center">
        <div className="bg-white w-full sm:w-[400px] h-full sm:h-auto sm:rounded-md shadow-2xl flex flex-col text-gray-800 relative">
          {/* Header overlay */}
          <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent rounded-t-md">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => setStep('profile')}>
              <FaChevronLeft className="text-white text-[15px]" />
              <span className="text-white text-[15px] font-semibold">Thông tin tài khoản</span>
            </div>
            <button onClick={onClose} className="text-white/90 hover:text-white">
              <FaTimes className="text-xl" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto sm:overflow-visible">
            {/* Cover Image & Avatar */}
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
                  onClick={() => setStep('profile')} // Bấm vào bút chì ở đây thì quay lại profile để sửa (hoặc có thể thêm logic sửa tại đây)
                />
              </div>
            </div>

            {/* Form Content */}
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

              {/* Đã bỏ: Chặn người này xem nhật ký của tôi */}
            </div>
          </div>

          {/* Footer buttons */}
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 font-['Segoe_UI',sans-serif]">
      {step === 'search' && renderSearch()}
      {step === 'profile' && renderProfile()}
      {step === 'add_friend' && renderAddFriend()}
    </div>
  );
};

export default AddFriendModal;
