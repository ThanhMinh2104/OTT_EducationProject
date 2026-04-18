import { useState, useEffect } from 'react';
import {
  FaTimes, FaDownload, FaFileAlt, FaLink, FaBell, FaBellSlash,
  FaChevronLeft, FaChevronRight, FaExpand, FaUserPlus, FaCog,
  FaChevronDown, FaChevronUp, FaCopy, FaShare, FaSignOutAlt,
  FaTrash, FaUserShield, FaUsers, FaClock, FaStickyNote, FaImage,
} from 'react-icons/fa';
import { BsPin, BsPinFill } from 'react-icons/bs';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import EditGroupInfoModal from './EditGroupInfoModal';
import './GroupInfoPanel.css';

interface GroupMember {
  _id: string;
  userID: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  isActive: boolean;
}

interface GroupInfo {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
  members: GroupMember[];
  memberCount: number;
  settings?: {
    requireApproval: boolean;
    highlightAdminMessages: boolean;
    allowNewMembersReadHistory: boolean;
    allowInviteLink: boolean;
    memberPermissions: {
      changeNameAvatar: boolean;
      pinMessages: boolean;
      createNotes: boolean;
      createPolls: boolean;
      sendMessages: boolean;
    };
  };
}

interface Message {
  messageID?: string;
  groupID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: Date | string;
  media_url?: string[];
  status?: 'sent' | 'delivered' | 'read';
  replyTo?: any;
  senderInfo?: any;
  reactions?: Array<{ userID: string; emoji: string }>;
  pinnedInfo?: { pinnedBy?: string; pinnedAt?: string } | null;
}

interface Props {
  groupInfo: GroupInfo;
  currentUserID: string;
  messages: Message[];
  onClose: () => void;
  onAddMembers: () => void;
  onManageGroup: () => void;
  onLeaveGroup: () => void;
  onDeleteGroup?: () => void;
}

type Tab = 'reminders' | 'notes' | 'media' | 'files' | 'links';

// ── Fullscreen image viewer ────────────────────────────────────────────────
const ImageViewer = ({ urls, initialIndex, onClose }: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(urls.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10" onClick={onClose}>
        <FaTimes />
      </button>
      {urls.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }}
            disabled={idx === 0}
          >
            <FaChevronLeft />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(urls.length - 1, i + 1)); }}
            disabled={idx === urls.length - 1}
          >
            <FaChevronRight />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {idx + 1} / {urls.length}
          </span>
        </>
      )}
      <img
        src={urls[idx]}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={urls[idx]}
        download
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <FaDownload className="text-xs" /> Tải xuống
      </a>
    </div>
  );
};

const formatDate = (ts: string | Date) => {
  const date = typeof ts === 'string' ? new Date(ts) : ts;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
    <span className="text-3xl opacity-30">📂</span>
    <p className="text-sm">{text}</p>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
const GroupInfoPanel = ({
  groupInfo,
  currentUserID,
  messages,
  onClose,
  onAddMembers,
  onManageGroup,
  onLeaveGroup,
  onDeleteGroup,
}: Props) => {
  const [tab, setTab] = useState<Tab>('media');
  const [viewerUrls, setViewerUrls] = useState<string[] | null>(null);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [showMembersExpanded, setShowMembersExpanded] = useState(true);
  const [showBoardExpanded, setShowBoardExpanded] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const currentMember = groupInfo.members.find(m => m.userID === currentUserID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  
  // Kiểm tra quyền chỉnh sửa: Owner/Admin luôn có quyền, Member kiểm tra setting
  const canEditGroupInfo = isOwner || isAdmin || 
    (groupInfo.settings?.memberPermissions?.changeNameAvatar ?? true);

  // Media từ messages
  const mediaImages = messages
    .filter((m) => m.type === 'image' && m.media_url?.length)
    .flatMap((m) => (m.media_url || []).map((url, i) => ({ url, timestamp: m.timestamp, id: `${m.messageID}_${i}` })));

  const mediaVideos = messages
    .filter((m) => m.type === 'video' && m.media_url?.length)
    .flatMap((m) => (m.media_url || []).map((url, i) => ({ url, timestamp: m.timestamp, id: `${m.messageID}_${i}` })));

  const mediaFiles = messages
    .filter((m) => m.type === 'file' && m.media_url?.length)
    .flatMap((m) => (m.media_url || []).map((url, i) => ({
      url, name: m.content || `file_${i}`, timestamp: m.timestamp, id: `${m.messageID}_${i}`,
    })));

  const mediaLinks = messages
    .filter((m) => m.type === 'text' && m.content?.match(/https?:\/\//))
    .map((m) => ({ 
      url: m.content || '', 
      timestamp: m.timestamp, 
      id: m.messageID || (typeof m.timestamp === 'string' ? m.timestamp : m.timestamp.toISOString())
    }));

  const allImageUrls = mediaImages.map((i) => i.url);

  const groupAvatar = groupInfo.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupInfo.groupID}`;
  const groupInviteLink = `zalo.me/g/${groupInfo.groupID.substring(0, 10)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(groupInviteLink);
    toast.success('Đã sao chép link tham gia nhóm');
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: groupInfo.name,
        text: `Tham gia nhóm ${groupInfo.name}`,
        url: groupInviteLink,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast.success(isMuted ? 'Đã bật thông báo' : 'Đã tắt thông báo');
  };

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
    toast.success(isPinned ? 'Đã bỏ ghim hội thoại' : 'Đã ghim hội thoại');
  };

  return (
    <>
      <div
        className="w-[320px] border-l border-gray-100 bg-[#2a2f35] text-white flex flex-col shrink-0 overflow-hidden group-info-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 shrink-0">
          <h3 className="text-[15px] font-semibold flex-1">Thông tin nhóm</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto content-scroll [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-600">
          {/* Avatar + tên nhóm */}
          <div className="flex flex-col items-center py-5 px-4 border-b border-gray-700 gap-3">
            <div 
              className={`relative ${canEditGroupInfo ? 'cursor-pointer group' : ''}`}
              onClick={() => canEditGroupInfo && setShowEditModal(true)}
              title={canEditGroupInfo ? 'Click để chỉnh sửa thông tin nhóm' : ''}
            >
              <img 
                src={groupAvatar} 
                alt="avatar" 
                className="w-20 h-20 rounded-full object-cover border-2 border-blue-400 transition-opacity group-hover:opacity-80" 
              />
              {canEditGroupInfo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-full transition-all">
                  <FaImage className="text-white opacity-0 group-hover:opacity-100 text-xl transition-opacity" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-[16px] mb-1">{groupInfo.name}</p>
              {canEditGroupInfo && (
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mx-auto transition-colors"
                >
                  ✏️ Đổi tên
                </button>
              )}
            </div>
          </div>

          {/* 4 Action buttons */}
          <div className="grid grid-cols-4 gap-2 px-4 py-4 border-b border-gray-700">
            <button
              onClick={handleToggleMute}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors group-action-btn"
            >
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                {isMuted ? <FaBellSlash className="text-lg" /> : <FaBell className="text-lg" />}
              </div>
              <span className="text-[10px] text-center leading-tight">
                {isMuted ? 'Bật' : 'Tắt'} thông báo
              </span>
            </button>

            <button
              onClick={handleTogglePin}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                {isPinned ? <BsPinFill className="text-lg" /> : <BsPin className="text-lg" />}
              </div>
              <span className="text-[10px] text-center leading-tight">
                Ghim hội thoại
              </span>
            </button>

            <button
              onClick={onAddMembers}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                <FaUserPlus className="text-lg" />
              </div>
              <span className="text-[10px] text-center leading-tight">
                Thêm thành viên
              </span>
            </button>

            <button
              onClick={onManageGroup}
              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                <FaCog className="text-lg" />
              </div>
              <span className="text-[10px] text-center leading-tight">
                Quản lý nhóm
              </span>
            </button>
          </div>

          {/* Link tham gia nhóm */}
          <div className="px-4 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <FaLink className="text-gray-400" />
              <span className="text-sm font-semibold">Link tham gia nhóm</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-blue-400 truncate">{groupInviteLink}</span>
              <button
                onClick={handleCopyLink}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-600 transition-colors"
                title="Sao chép"
              >
                <FaCopy className="text-sm" />
              </button>
              <button
                onClick={handleShareLink}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-600 transition-colors"
                title="Chia sẻ"
              >
                <FaShare className="text-sm" />
              </button>
            </div>
          </div>

          {/* Bảng tin nhóm */}
          <div className="border-b border-gray-700">
            <button
              onClick={() => setShowBoardExpanded(!showBoardExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700 transition-colors"
            >
              <span className="text-sm font-semibold">Bảng tin nhóm</span>
              {showBoardExpanded ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
            </button>

            {showBoardExpanded && (
              <div className="px-4 pb-3">
                {/* Tabs */}
                <div className="flex flex-col gap-2 mb-3">
                  <button
                    onClick={() => setTab('reminders')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      tab === 'reminders' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    <FaClock className="text-xs" />
                    Danh sách nhắc hẹn
                  </button>
                  <button
                    onClick={() => setTab('notes')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      tab === 'notes' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    <FaStickyNote className="text-xs" />
                    Ghi chú, ghim, bình chọn
                  </button>
                </div>

                {/* Tab content preview */}
                {tab === 'reminders' && (
                  <EmptyState text="Chưa có nhắc hẹn" />
                )}
                {tab === 'notes' && (
                  <EmptyState text="Chưa có ghi chú" />
                )}
              </div>
            )}
          </div>

          {/* Media tabs - Ảnh/Video, File, Link */}
          <div className="px-4 py-3">
            <div className="flex border-b border-gray-700 mb-3">
              {(['media', 'files', 'links'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t as Tab)}
                  className={`flex-1 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                    tab === t ? 'text-blue-400 border-blue-400' : 'text-gray-400 border-transparent hover:text-blue-400'
                  }`}
                >
                  {t === 'media' ? 'Ảnh/Video' : t === 'files' ? 'File' : 'Link'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-600">
              {tab === 'media' && (
                <>
                  {mediaImages.length === 0 && mediaVideos.length === 0 ? (
                    <EmptyState text="Chưa có ảnh/video" />
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {mediaImages.map((img, i) => (
                        <div
                          key={img.id}
                          className="relative group aspect-square cursor-pointer"
                          onClick={() => { setViewerUrls(allImageUrls); setViewerIdx(i); }}
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                            <FaExpand className="text-white opacity-0 group-hover:opacity-100 text-sm transition-opacity" />
                          </div>
                        </div>
                      ))}
                      {mediaVideos.map((vid) => (
                        <div key={vid.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-700">
                          <video src={vid.url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white text-xs">▶</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'files' && (
                <>
                  {mediaFiles.length === 0 ? (
                    <EmptyState text="Chưa có file" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {mediaFiles.map((f) => (
                        <div key={f.id} className="flex items-center gap-2.5 p-2.5 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors group">
                          <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                            <FaFileAlt className="text-blue-400 text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-white truncate">{f.name}</p>
                            <p className="text-[11px] text-gray-400">{formatDate(f.timestamp)}</p>
                          </div>
                          <a
                            href={f.url}
                            download={f.name}
                            target="_blank"
                            rel="noreferrer"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FaDownload className="text-xs" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'links' && (
                <>
                  {mediaLinks.length === 0 ? (
                    <EmptyState text="Chưa có link" />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {mediaLinks.map((l) => (
                        <a
                          key={l.id}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-2.5 p-2.5 bg-gray-700 rounded-xl hover:bg-gray-600 transition-colors"
                        >
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                            <FaLink className="text-blue-400 text-xs" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-blue-400 truncate">{l.url}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(l.timestamp)}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions - Rời nhóm / Giải tán nhóm */}
        <div className="px-4 py-3 border-t border-gray-700 shrink-0 space-y-2">
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-[13px] font-medium"
          >
            <FaSignOutAlt className="text-xs" />
            Rời nhóm
          </button>

          {isOwner && onDeleteGroup && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-[13px] font-medium"
            >
              <FaTrash className="text-xs" />
              Giải tán nhóm
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen image viewer */}
      {viewerUrls && (
        <ImageViewer
          urls={viewerUrls}
          initialIndex={viewerIdx}
          onClose={() => setViewerUrls(null)}
        />
      )}

      {/* Leave confirm modal */}
      <ConfirmModal
        show={showLeaveConfirm}
        title="Rời nhóm"
        message={`Bạn có chắc muốn rời khỏi nhóm "${groupInfo.name}"?`}
        onConfirm={() => {
          setShowLeaveConfirm(false);
          onLeaveGroup();
        }}
        onCancel={() => setShowLeaveConfirm(false)}
        isDanger
        confirmText="Rời nhóm"
      />

      {/* Delete group confirm modal */}
      {isOwner && (
        <ConfirmModal
          show={showDeleteConfirm}
          title="Giải tán nhóm"
          message={`Bạn có chắc muốn giải tán nhóm "${groupInfo.name}"? Hành động này không thể hoàn tác.`}
          onConfirm={() => {
            setShowDeleteConfirm(false);
            onDeleteGroup?.();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
          isDanger
          confirmText="Giải tán"
        />
      )}

      {/* Edit Group Info Modal */}
      {showEditModal && canEditGroupInfo && (
        <EditGroupInfoModal
          groupID={groupInfo.groupID}
          currentName={groupInfo.name}
          currentAvatar={groupInfo.avatar}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            // Reload group data
            window.location.reload();
          }}
        />
      )}
    </>
  );
};

export default GroupInfoPanel;
