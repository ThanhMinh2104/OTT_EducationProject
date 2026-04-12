import { useState, useEffect, useRef } from 'react';
import {
  FaTimes,
  FaChevronLeft,
  FaPen,
  FaBan,
  FaExclamationTriangle,
  FaUserFriends,
  FaCheck,
  FaCamera,
  FaCommentDots,
  FaUserMinus,
  FaChevronDown
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface User {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'blocked';
  alias?: string;
}

interface Props {
  user: User | null;
  currentUser: { userID: string; name: string } | null;
  onClose: () => void;
  onBack?: () => void; // Thêm nút quay lại nếu cần
  onStartChat?: (chat: any) => void;
  onAddFriend?: () => void; // Chuyển sang màn hình gửi lời mời
  onOpenSelfProfile?: () => void; // Nếu trúng bản thân và muốn mở modal edit
}

const OtherProfileModal = ({ user, currentUser, onClose, onBack, onStartChat, onAddFriend, onOpenSelfProfile }: Props) => {
  const [alias, setAlias] = useState(user?.alias || user?.name || '');
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const aliasInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setAlias(user.alias || user.name);
    }
  }, [user]);

  // Focus input khi đổi tên gợi nhớ
  useEffect(() => {
    if (isEditingAlias && aliasInputRef.current) {
      aliasInputRef.current.focus();
    }
  }, [isEditingAlias]);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowFriendMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleSaveAlias = () => {
    const newAlias = alias.trim() || user.name;
    // Tạm thời chỉ cập nhật local UI, logic thực tế sẽ gửi API nếu là bạn bè
    setIsEditingAlias(false);
    setAlias(newAlias);
    toast.success('Đã cập nhật tên gợi nhớ');
  };

  const handleStartChat = async () => {
    if (!onStartChat) return;
    try {
      const res = await axiosInstance.post('/createChat1-1', { userID2: user.userID });
      onStartChat(res.data);
      onClose();
    } catch {
      toast.error('Không thể mở cuộc trò chuyện');
    }
  };

  const handleUnfriend = async () => {
    if (!confirm(`Bạn có chắc muốn hủy kết bạn với ${user.name}?`)) return;
    try {
      await axiosInstance.post('/contacts/unfriend', { friendID: user.userID });
      setShowFriendMenu(false);
      toast.success('Đã hủy kết bạn');
      onClose(); // Đóng modal sau khi hủy kết bạn thành công
    } catch {
      toast.error('Lỗi khi hủy kết bạn');
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 font-['Segoe_UI',sans-serif]">
      <div className="bg-white w-full sm:w-[400px] h-full sm:h-[700px] sm:rounded-md shadow-2xl flex flex-col text-gray-800 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded relative animate-modal-pop">
        {/* Header overlay on cover image */}
        <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent sm:rounded-t-md">
          <div className="flex items-center gap-4">
            {onBack && (
              <FaChevronLeft className="text-white text-[15px] cursor-pointer" onClick={onBack} />
            )}
            <span className="text-white text-[15px] font-semibold shadow-sm">Thông tin tài khoản</span>
          </div>
          <button onClick={onClose} className="text-white/90 hover:text-white transition-colors">
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Cover Image & Avatar */}
        <div className="relative mb-14 shrink-0">
          <img
            src={user.anhBia || "https://images.unsplash.com/photo-1542224566-6e85f2e6772f?q=80&w=600&auto=format"}
            alt="cover"
            className="w-full h-[220px] object-cover bg-gray-200 sm:rounded-t-md"
          />
          <div className="absolute -bottom-10 left-5">
            <div className="relative">
              <img
                src={user.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userID}
                alt="avatar"
                className="w-[84px] h-[84px] rounded-full object-cover border-4 border-white bg-gray-100 shadow-sm"
              />
              {user.friendStatus === 'self' && (
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
                  className="flex-1 border-b-2 border-[#0e9de8] text-xl font-semibold text-gray-900 outline-none pb-1 bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAlias();
                  }}
                />
                <button onClick={handleSaveAlias} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-[#0e9de8] shrink-0 transition-colors">
                  <FaCheck />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[22px] font-bold text-gray-900 truncate max-w-[280px]">
                  {alias || user.name}
                </h2>
                {user.friendStatus !== 'self' && (
                  <button
                    onClick={() => setIsEditingAlias(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 shrink-0 transition-colors"
                    title="Đổi tên gợi nhớ"
                  >
                    <FaPen className="text-[13px]" />
                  </button>
                )}
              </>
            )}
          </div>

          {user.friendStatus === 'self' ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-gray-500 text-[14.5px] italic text-center py-2">Đây là hồ sơ của bạn</div>
              {onOpenSelfProfile && (
                <button
                  onClick={() => { onClose(); onOpenSelfProfile(); }}
                  className="flex-1 w-full py-2.5 rounded-lg text-[14.5px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <FaPen className="text-xs" /> Chỉnh sửa thông tin
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              {user.friendStatus === 'accepted' ? (
                <div className="relative flex-1" ref={menuRef}>
                  <button
                    onClick={() => setShowFriendMenu(!showFriendMenu)}
                    className="w-full py-2.5 rounded-lg text-[14.5px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <FaUserFriends className="text-[14px]" /> Bạn bè <FaChevronDown className={`text-[10px] transition-transform ${showFriendMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showFriendMenu && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={handleUnfriend}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition-colors border-b border-gray-100"
                      >
                        <FaUserMinus className="text-[14px]" />
                        <span className="text-[14px] font-medium">Hủy kết bạn</span>
                      </button>
                      {/* Có thể thêm các option khác ở đây */}
                    </div>
                  )}
                </div>
              ) : (user.friendStatus === 'pending_sent' || user.friendStatus === 'pending_received') ? (
                <button className="flex-1 py-2.5 rounded-lg text-[14.5px] font-semibold bg-gray-100 text-gray-800 flex items-center justify-center gap-2" disabled>
                  {user.friendStatus === 'pending_sent' ? 'Đã gửi yêu cầu' : 'Lời mời kết bạn'}
                </button>
              ) : (
                <button
                  onClick={onAddFriend}
                  className="flex-1 py-2 rounded-lg text-[14.5px] font-semibold bg-[#E5E7EB] hover:bg-gray-300 text-gray-800 transition-colors"
                >
                  Kết bạn
                </button>
              )}
              <button
                onClick={handleStartChat}
                className="flex-1 py-2 rounded-lg text-[14.5px] font-semibold bg-[#0068FF] hover:bg-[#005AE6] text-white transition-colors flex items-center justify-center gap-2"
              >
                <FaCommentDots /> Nhắn tin
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
              <span className="text-gray-900 font-medium">{user.gioTinh || '—'}</span>
            </div>
            <div className="flex">
              <span className="w-28 text-gray-500">Ngày sinh</span>
              <span className="text-gray-900 font-medium">{formatDate(user.ngaysinh)}</span>
            </div>
            {(user.friendStatus === 'accepted' || user.friendStatus === 'self') && (
              <>
                <div className="flex">
                  <span className="w-28 text-gray-500">Điện thoại</span>
                  <span className="text-gray-900 font-medium">{user.sdt}</span>
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
        {user.friendStatus !== 'self' && (
          <div className="py-2 mb-4">
            <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors">
              <FaUserFriends className="text-xl text-gray-400" />
              <span>Nhóm chung (0)</span>
            </div>
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

export default OtherProfileModal;
