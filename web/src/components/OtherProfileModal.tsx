import { useState, useEffect, useRef } from 'react';
import {
  FaTimes, FaChevronLeft, FaPen, FaBan, FaExclamationTriangle,
  FaUserFriends, FaCheck, FaCamera, FaCommentDots, FaUserMinus,
  FaChevronDown, FaUserCheck, FaUserTimes, FaUndo
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface Props {
  user: any;
  currentUser: any;
  onClose: () => void;
  onBack?: () => void;
  onStartChat?: (chat: any) => void;
  onAddFriend?: () => void;
  onOpenSelfProfile?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRecall?: () => void;
  onEditAlias?: () => void;
}

const OtherProfileModal = ({
  user, onClose, onBack, onStartChat, onAddFriend,
  onOpenSelfProfile, onAccept, onReject, onRecall, onEditAlias
}: Props) => {
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [showRequestMenu, setShowRequestMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestMenuRef = useRef<HTMLDivElement>(null);

  // Ensure friendStatus has a default value
  if (!user.friendStatus) {
    user.friendStatus = 'none';
  }

  // --- LOGIC XỬ LÝ (API) ---
  const handleStartChat = async () => {
    try {
      const res = await axiosInstance.post('/createChat1-1', { userID2: user.userID });
      onStartChat?.(res.data);
      onClose();
    } catch { toast.error('Không thể nhắn tin'); }
  };

  const handleUnfriend = async () => {
    if (!confirm(`Xóa ${user.name} khỏi danh sách bạn bè?`)) return;
    try {
      await axiosInstance.post('/contacts/unfriend', { friendID: user.userID });
      toast.success('Đã xóa khỏi danh sách bạn bè');
      onClose();
    } catch { toast.error('Lỗi khi thực hiện thao tác'); }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getDate().toString().padStart(2, '0')} tháng ${(date.getMonth() + 1).toString().padStart(2, '0')}, ${date.getFullYear()}`;
  };

  // --- RENDER HÀNH ĐỘNG (GIAO DIỆN CŨ XỊN) ---
  const renderActions = () => {
    if (user.friendStatus === 'self') {
      return (
        <div className="w-full flex flex-col items-center gap-2">
          <div className="text-gray-500 text-[14.5px] italic text-center py-2">Đây là hồ sơ của bạn</div>
          <button
            onClick={onOpenSelfProfile}
            className="w-full py-2.5 rounded-lg text-[14.5px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <FaPen className="text-xs" /> Chỉnh sửa thông tin
          </button>
        </div>
      );
    }

    if (user.friendStatus === 'accepted') {
      return (
        <div className="relative flex-1" ref={menuRef}>
          <button
            onClick={() => setShowFriendMenu(!showFriendMenu)}
            className="w-full h-[42px] rounded-xl text-[14.5px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <FaUserFriends className="text-[16px]" /> Bạn bè <FaChevronDown className={`text-[10px] transition-transform ${showFriendMenu ? "rotate-180" : ""}`} />
          </button>
          {showFriendMenu && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <button onClick={handleUnfriend} className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-red-600 hover:bg-red-50 transition-colors">
                <FaUserMinus className="text-[14px]" /> <span className="text-[14.5px] font-bold">Hủy kết bạn</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    if (user.friendStatus === 'pending_received') {
      return (
        <div className="flex-1 relative flex" ref={requestMenuRef}>
          <button
            onClick={onAccept}
            className="flex-1 h-[42px] rounded-l-xl text-[14.5px] font-bold bg-gradient-to-r from-[#0068FF] to-[#005AE6] text-gray-900 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <FaUserCheck className="text-[16px]" /> Chấp nhận
          </button>
          <button
            onClick={() => setShowRequestMenu(!showRequestMenu)}
            className="w-[42px] h-[42px] rounded-r-xl bg-[#005AE6] text-gray-900 border-l border-white/20 hover:brightness-110 transition-all flex items-center justify-center shadow-sm"
          >
            <FaChevronDown className={`text-[10px] transition-transform ${showRequestMenu ? "rotate-180" : ""}`} />
          </button>
          {showRequestMenu && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => { setShowRequestMenu(false); onReject?.(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <FaUserTimes className="text-[14px]" /> <span className="text-[14.5px] font-bold">Từ chối lời mời</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    if (user.friendStatus === 'pending_sent') {
      return (
        <button
          onClick={onRecall}
          className="flex-1 h-[42px] rounded-xl text-[14.5px] font-bold bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-red-100 shadow-sm"
        >
          <FaUndo className="text-[14px]" /> Thu hồi lời mời
        </button>
      );
    }

    return (
      <button
        onClick={onAddFriend}
        className="flex-1 h-[42px] rounded-xl text-[14.5px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 transition-all border border-gray-200"
      >
        Kết bạn
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 font-['Segoe_UI',sans-serif]">
      <div className="bg-white w-full sm:w-[400px] h-full sm:h-[700px] sm:rounded-md shadow-2xl flex flex-col text-gray-800 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 relative animate-modal-pop">

        {/* Header content */}
        <div className="absolute top-0 left-0 w-full flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent sm:rounded-t-md">
          <div className="flex items-center gap-4">
            {onBack && <FaChevronLeft className="text-white text-[15px] cursor-pointer" onClick={onBack} />}
            <span className="text-white text-[15px] font-semibold shadow-sm">Thông tin tài khoản</span>
          </div>
          <button onClick={onClose} className="text-gray-900/90 hover:text-gray-900 transition-colors">
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Banner and Avatar section */}
        <div className="relative mb-14 shrink-0">
          <img
            src={user.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userID}
            alt="cover"
            className="w-full h-[220px] object-cover bg-gray-200 sm:rounded-t-md brightness-90"
          />
          <div className="absolute -bottom-10 left-5">
            <img
              src={user.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userID}
              alt="avatar"
              className="w-[84px] h-[84px] rounded-full object-cover border-4 border-white bg-gray-100 shadow-sm"
            />
          </div>
        </div>

        {/* Action Header */}
        <div className="px-5 pb-5 border-b-[8px] border-gray-100">
          <div className="flex items-center gap-2 mb-5 group">
            <h2 className="text-[22px] font-bold text-gray-900 truncate max-w-[280px]">{user.alias || user.name}</h2>
            {user.friendStatus !== 'self' && (
              <button
                onClick={onEditAlias}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <FaPen className="text-[13px]" />
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {renderActions()}
            {user.friendStatus !== 'self' && (
              <button
                onClick={handleStartChat}
                className={`flex-1 h-[42px] rounded-xl text-[14.5px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${user.friendStatus?.startsWith('pending') ? 'bg-blue-50 text-[#0068FF] border border-blue-100 hover:bg-blue-100' : 'bg-[#0068FF] text-gray-900 hover:bg-[#005AE6]'}`}
              >
                <FaCommentDots className="text-[16px]" /> Nhắn tin
              </button>
            )}
          </div>
        </div>

        {/* Personal Details */}
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

        {/* Security and More */}
        {user.friendStatus !== 'self' && (
          <div className="py-2 mb-4">
            <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors">
              <FaUserFriends className="text-xl text-gray-400" />
              <span>Nhóm chung (0)</span>
            </div>
            <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-800 transition-colors mt-2">
              <FaBan className="text-xl text-gray-400" />
              <span>Chặn tin nhắn và cuộc gọi</span>
            </div>
            <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-800 transition-colors">
              <FaExclamationTriangle className="text-xl text-gray-400" />
              <span>Báo xấu</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OtherProfileModal;
