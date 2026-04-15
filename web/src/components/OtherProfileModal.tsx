import { useState, useEffect, useRef } from 'react';
import {
  FaTimes, FaChevronLeft, FaPen, FaBan, FaExclamationTriangle,
  FaUserFriends, FaCheck, FaCamera, FaCommentDots, FaUserMinus,
  FaChevronDown, FaUserCheck, FaUserTimes, FaUndo, FaShareAlt, FaTrash
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import socket from '../utils/socket';
import ConfirmModal from './ConfirmModal';

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
  onStatusChange?: (status: string) => void;
}

const OtherProfileModal = ({
  user, currentUser, onClose, onBack, onStartChat, onAddFriend,
  onOpenSelfProfile, onAccept, onReject, onRecall, onEditAlias,
  onStatusChange
}: Props) => {
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [showRequestMenu, setShowRequestMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const requestMenuRef = useRef<HTMLDivElement>(null);

  if (!user.friendStatus) {
    user.friendStatus = 'none';
  }

  const handleStartChat = async () => {
    try {
      const res = await axiosInstance.post('/createChat1-1', { userID2: user.userID });
      onStartChat?.(res.data);
      onClose();
    } catch { toast.error('Không thể nhắn tin'); }
  };

  const handleUnfriend = async () => {
    setShowUnfriendConfirm(false);
    setShowFriendMenu(false);
    try {
      await axiosInstance.post('/contacts/unfriend', { friendID: user.userID });
      toast.success('Đã xóa khỏi danh sách bạn bè');
      onStatusChange?.('none');
      onClose();
    } catch { toast.error('Lỗi khi thực hiện thao tác'); }
  };

  const handleBlock = async () => {
    setShowBlockConfirm(false);
    try {
      await axiosInstance.post('/contacts/block', { targetUserID: user.userID });
      toast.success('Đã chặn người dùng');
      onStatusChange?.('blocked');
      onClose();
    } catch { toast.error('Lỗi khi thực hiện thao tác'); }
  };

  const handleUnblock = async () => {
    setShowUnblockConfirm(false);
    try {
      await axiosInstance.post('/contacts/unblock', { targetUserID: user.userID });
      toast.success('Đã bỏ chặn người dùng');
      onStatusChange?.('none');
      onClose();
    } catch { toast.error('Lỗi khi thực hiện thao tác'); }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getDate().toString().padStart(2, '0')} tháng ${(date.getMonth() + 1).toString().padStart(2, '0')}, ${date.getFullYear()}`;
  };

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
              <button onClick={() => setShowUnfriendConfirm(true)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-red-600 hover:bg-red-50 transition-colors">
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
            className="flex-1 h-[42px] rounded-l-xl text-[14.5px] font-bold bg-[#0068ff] text-white hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <FaUserCheck className="text-[16px]" /> Chấp nhận
          </button>
          <button
            onClick={() => setShowRequestMenu(!showRequestMenu)}
            className="w-[42px] h-[42px] rounded-r-xl bg-[#005AE6] text-white border-l border-white/20 hover:brightness-110 transition-all flex items-center justify-center shadow-sm"
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
    <>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 font-['Segoe_UI',sans-serif]">
        <div className="bg-white w-full sm:w-[400px] h-full sm:h-[700px] sm:rounded-md shadow-2xl flex flex-col text-gray-800 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 relative animate-modal-pop">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 sm:rounded-t-md bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              {onBack && <FaChevronLeft className="text-gray-600 text-[15px] cursor-pointer hover:text-gray-900" onClick={onBack} />}
              <span className="text-gray-900 text-[15px] font-semibold">Thông tin tài khoản</span>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
              <FaTimes className="text-base" />
            </button>
          </div>

          {/* Banner and Avatar section */}
          <div className="relative mb-14 shrink-0">
            <img
              src={user.anhBia || "https://res.cloudinary.com/ddu7vms87/image/upload/v1740316684/p79itfnd9o7atd62269y.jpg"}
              alt="cover"
              className="w-full h-[200px] object-cover bg-gray-200 brightness-90"
            />
            <div className="absolute -bottom-10 left-5">
              <div className="relative">
                <img
                  src={user.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.userID}
                  alt="avatar"
                  className="w-[84px] h-[84px] rounded-full object-cover border-4 border-white bg-gray-100 shadow-sm"
                />
                <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-white ${user.trangThai === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div className="px-5 pb-5 border-b-[8px] border-gray-100">
            <div className="flex items-center gap-2 mb-5 group">
              <h2 className="text-[20px] font-bold text-gray-900 truncate max-w-[280px]">{user.alias || user.name}</h2>
              {user.friendStatus !== 'self' && (
                <button
                  onClick={onEditAlias}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <FaPen className="text-[12px]" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              {renderActions()}
              {user.friendStatus !== 'self' && user.friendStatus !== 'blocked' && (
                <button
                  onClick={handleStartChat}
                  className={`flex-1 h-[42px] rounded-xl text-[14.5px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${user.friendStatus?.startsWith('pending') ? 'bg-blue-50 text-[#0068FF] border border-blue-100 hover:bg-blue-100' : 'bg-[#0068FF] text-white hover:bg-[#005AE6]'}`}
                >
                  <FaCommentDots className="text-[16px]" /> Nhắn tin
                </button>
              )}
              {user.friendStatus === 'blocked' && (
                <button
                  onClick={() => setShowUnblockConfirm(true)}
                  className="flex-1 h-[42px] rounded-xl text-[14.5px] font-bold bg-[#0068FF] text-white hover:bg-[#005AE6] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  Bỏ chặn
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
                <div className="flex">
                  <span className="w-28 text-gray-500">Điện thoại</span>
                  <span className="text-gray-900 font-medium">{user.sdt}</span>
                </div>
              )}
            </div>
          </div>

          {/* Security and More */}
          {user.friendStatus !== 'self' && (
            <div className="py-2 mb-4 flex-1">
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors">
                <FaUserFriends className="text-xl text-gray-500" />
                <span>Nhóm chung</span>
              </div>
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors">
                <FaShareAlt className="text-xl text-gray-500" />
                <span>Chia sẻ danh thiếp</span>
              </div>
              {user.friendStatus !== 'blocked' ? (
                <div
                  onClick={() => setShowBlockConfirm(true)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors"
                >
                  <FaBan className="text-xl text-gray-500" />
                  <span>Chặn tin nhắn và cuộc gọi</span>
                </div>
              ) : (
                <div
                  onClick={() => setShowUnblockConfirm(true)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-red-600 transition-colors"
                >
                  <FaBan className="text-xl text-red-600" />
                  <span>Bỏ chặn</span>
                </div>
              )}
              <div className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-gray-600 transition-colors">
                <FaExclamationTriangle className="text-xl text-gray-500" />
                <span>Báo xấu</span>
              </div>
              {user.friendStatus === 'accepted' && (
                <div
                  onClick={() => setShowUnfriendConfirm(true)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 cursor-pointer text-[15px] font-medium text-red-500 transition-colors"
                >
                  <FaTrash className="text-xl opacity-70" />
                  <span>Xóa khỏi danh sách bạn bè</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal
        show={showBlockConfirm}
        title="Xác nhận chặn"
        message={`Chặn ${user.name}? Người này sẽ không thể gửi tin nhắn cho bạn. Bạn có muốn tiếp tục?`}
        onConfirm={handleBlock}
        onCancel={() => setShowBlockConfirm(false)}
        isDanger
      />

      <ConfirmModal
        show={showUnblockConfirm}
        title="Xác nhận bỏ chặn"
        message={`Bạn có muốn bỏ chặn liên lạc với ${user.name}?`}
        onConfirm={handleUnblock}
        onCancel={() => setShowUnblockConfirm(false)}
      />

      <ConfirmModal
        show={showUnfriendConfirm}
        title="Xác nhận xóa bạn"
        message={`Xóa ${user.name} khỏi danh sách bạn bè?`}
        onConfirm={handleUnfriend}
        onCancel={() => setShowUnfriendConfirm(false)}
        isDanger
      />
    </>
  );
};

export default OtherProfileModal;
