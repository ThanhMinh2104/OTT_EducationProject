import { useState, useEffect } from 'react';
import {
  FaTimes, FaDownload, FaFileAlt, FaLink, FaBell, FaBellSlash,
  FaChevronLeft, FaChevronRight, FaExpand, FaUserPlus, FaCog,
  FaChevronDown, FaChevronUp, FaCopy, FaShare, FaSignOutAlt,
  FaTrash, FaUserShield, FaUsers, FaClock, FaStickyNote, FaImage,
  FaQrcode,
} from 'react-icons/fa';
import { BsPin, BsPinFill } from 'react-icons/bs';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import EditGroupInfoModal from './EditGroupInfoModal';
import GroupBoardModal from './GroupBoardModal';
import GroupReminderModal from './GroupReminderModal';
import { TransferOwnershipModal } from './TransferOwnershipModal';
import GroupQRModal from './GroupQRModal';
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
  onViewMessage?: (messageID: string) => void;
  onLeaveGroup: () => void;
  onDeleteGroup?: () => void;
  onPinLimitReached?: (noteID: string) => void;
  onGroupInfoUpdated?: (data: { name?: string; avatar?: string }) => void;
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
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 40, gap: 8, color: '#9ca3af' }}>
    <span style={{ fontSize: 30, opacity: 0.3 }}>📂</span>
    <p style={{ fontSize: 13 }}>{text}</p>
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
  onViewMessage,
  onLeaveGroup,
  onDeleteGroup,
  onPinLimitReached,
  onGroupInfoUpdated,
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
  const [showGroupBoard, setShowGroupBoard] = useState(false);
  const [showGroupReminder, setShowGroupReminder] = useState(false);
  const [showTransferOwnership, setShowTransferOwnership] = useState(false);

  const currentMember = groupInfo.members.find(m => m.userID === currentUserID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';

  const canEditGroupInfo = isOwner || isAdmin ||
    (groupInfo.settings?.memberPermissions?.changeNameAvatar ?? true);

  const canCreateNotes = isOwner || isAdmin ||
    (groupInfo.settings?.memberPermissions?.createNotes ?? true);

  const canCreatePolls = isOwner || isAdmin ||
    (groupInfo.settings?.memberPermissions?.createPolls ?? true);

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
  const groupInviteLink = `ott-edu://join-group/${groupInfo.groupID}`;
  const groupInviteLinkDisplay = `ott-edu.app/g/${groupInfo.groupID.substring(0, 10)}`;
  const [showGroupQR, setShowGroupQR] = useState(false);

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

  // Shared inline styles (forced light)
  const S = {
    panel: {
      width: 320,
      borderLeft: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      color: '#111827',
      display: 'flex',
      flexDirection: 'column' as const,
      flexShrink: 0,
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: 600,
      flex: 1,
      color: '#111827',
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#6b7280',
      display: 'flex',
      alignItems: 'center',
    },
    scrollArea: {
      flex: 1,
      overflowY: 'auto' as const,
      backgroundColor: '#ffffff',
    },
    avatarSection: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '20px 16px',
      borderBottom: '1px solid #e5e7eb',
      gap: 12,
      backgroundColor: '#ffffff',
    },
    groupName: {
      fontWeight: 700,
      color: '#111827',
      fontSize: 16,
      marginBottom: 4,
      textAlign: 'center' as const,
    },
    editBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#3b82f6',
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    actionGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 8,
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
    },
    actionBtn: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 8,
      padding: 8,
      borderRadius: 8,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
    },
    actionIcon: {
      width: 40,
      height: 40,
      backgroundColor: '#f3f4f6',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#374151',
    },
    actionLabel: {
      fontSize: 10,
      textAlign: 'center' as const,
      lineHeight: '1.3',
      color: '#374151',
    },
    section: {
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 600,
      color: '#111827',
    },
    linkBox: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#f3f4f6',
      borderRadius: 8,
      padding: '8px 12px',
    },
    linkText: {
      flex: 1,
      fontSize: 13,
      color: '#3b82f6',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    iconBtn: {
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#6b7280',
    },
    collapseBtn: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'none',
      border: 'none',
      borderBottom: '1px solid #e5e7eb',
      cursor: 'pointer',
      backgroundColor: '#ffffff',
    },
    boardItem: (active: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 8,
      cursor: 'pointer',
      backgroundColor: active ? '#f3f4f6' : 'transparent',
      border: 'none',
      width: '100%',
      fontSize: 13,
      color: active ? '#111827' : '#6b7280',
    }),
    tabBar: {
      display: 'flex',
      borderBottom: '1px solid #e5e7eb',
      marginBottom: 12,
    },
    tabBtn: (active: boolean) => ({
      flex: 1,
      padding: '8px 0',
      fontSize: 11,
      fontWeight: 500,
      border: 'none',
      borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      background: 'none',
      cursor: 'pointer',
      color: active ? '#3b82f6' : '#6b7280',
    }),
    footer: {
      padding: '12px 16px',
      borderTop: '1px solid #e5e7eb',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
      backgroundColor: '#ffffff',
    },
    dangerBtn: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 12,
      color: '#ef4444',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 500,
    },
  };

  return (
    <>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <h3 style={S.headerTitle}>Thông tin nhóm</h3>
          <button onClick={onClose} style={S.closeBtn}>
            <FaTimes style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={S.scrollArea}>
          {/* Avatar + tên nhóm */}
          <div style={S.avatarSection}>
            <div
              style={{ position: 'relative', cursor: canEditGroupInfo ? 'pointer' : 'default' }}
              onClick={() => canEditGroupInfo && setShowEditModal(true)}
            >
              <img
                src={groupAvatar}
                alt="avatar"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #60a5fa' }}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={S.groupName}>{groupInfo.name}</p>
            </div>
          </div>

          {/* 4 Action buttons */}
          <div style={S.actionGrid}>
            {[
              {
                icon: isMuted ? <FaBellSlash style={{ fontSize: 18 }} /> : <FaBell style={{ fontSize: 18 }} />,
                label: `${isMuted ? 'Bật' : 'Tắt'}\nthông báo`,
                onClick: handleToggleMute,
              },
              {
                icon: isPinned ? <BsPinFill style={{ fontSize: 18 }} /> : <BsPin style={{ fontSize: 18 }} />,
                label: 'Ghim\nhội thoại',
                onClick: handleTogglePin,
              },
              {
                icon: <FaUserPlus style={{ fontSize: 18 }} />,
                label: 'Thêm\nthành viên',
                onClick: onAddMembers,
              },
              {
                icon: <FaCog style={{ fontSize: 18 }} />,
                label: 'Quản lý\nnhóm',
                onClick: onManageGroup,
              },
            ].map((item, i) => (
              <button key={i} style={S.actionBtn} onClick={item.onClick}>
                <div style={S.actionIcon}>{item.icon}</div>
                <span style={S.actionLabel}>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Link tham gia nhóm */}
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <FaLink style={{ color: '#6b7280', fontSize: 13 }} />
              <span style={S.sectionTitle}>Link tham gia nhóm</span>
            </div>
            <div style={S.linkBox}>
              <span style={S.linkText}>{groupInviteLinkDisplay}</span>
              <button style={S.iconBtn} onClick={handleCopyLink} title="Sao chép">
                <FaCopy style={{ fontSize: 13 }} />
              </button>
              <button style={S.iconBtn} onClick={handleShareLink} title="Chia sẻ">
                <FaShare style={{ fontSize: 13 }} />
              </button>
              <button style={S.iconBtn} onClick={() => setShowGroupQR(true)} title="Mã QR">
                <FaQrcode style={{ fontSize: 13 }} />
              </button>
            </div>
          </div>

          {/* Bảng tin nhóm */}
          <div>
            <button
              style={S.collapseBtn}
              onClick={() => setShowBoardExpanded(!showBoardExpanded)}
            >
              <span style={S.sectionTitle}>Bảng tin nhóm</span>
              {showBoardExpanded
                ? <FaChevronUp style={{ fontSize: 11, color: '#6b7280' }} />
                : <FaChevronDown style={{ fontSize: 11, color: '#6b7280' }} />}
            </button>

            {showBoardExpanded && (
              <div style={{ padding: '8px 16px 12px', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <button style={S.boardItem(tab === 'reminders')} onClick={() => { setShowGroupReminder(true); }}>
                    <FaClock style={{ fontSize: 11 }} />
                    Danh sách nhắc hẹn
                  </button>
                  <button
                    onClick={() => setShowGroupBoard(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      width: '100%',
                      transition: 'all 0.2s',
                      backgroundColor: tab === 'notes' ? '#e4e6eb' : 'transparent',
                      color: tab === 'notes' ? '#050505' : '#65676b',
                    }}
                    onMouseEnter={(e) => {
                      if (tab !== 'notes') e.currentTarget.style.backgroundColor = '#f2f2f2';
                    }}
                    onMouseLeave={(e) => {
                      if (tab !== 'notes') e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <FaStickyNote style={{ fontSize: 11 }} />
                    Ghi chú, ghim, bình chọn
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Media tabs */}
          <div style={{ padding: '12px 16px', backgroundColor: '#ffffff' }}>
            <div style={S.tabBar}>
              {(['media', 'files', 'links'] as const).map((t) => (
                <button key={t} style={S.tabBtn(tab === t)} onClick={() => setTab(t)}>
                  {t === 'media' ? 'Ảnh/Video' : t === 'files' ? 'File' : 'Link'}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {tab === 'media' && (
                mediaImages.length === 0 && mediaVideos.length === 0 ? (
                  <EmptyState text="Chưa có ảnh/video" />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {mediaImages.map((img, i) => (
                      <div
                        key={img.id}
                        style={{ aspectRatio: '1', cursor: 'pointer', borderRadius: 8, overflow: 'hidden' }}
                        onClick={() => { setViewerUrls(allImageUrls); setViewerIdx(i); }}
                      >
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>
                    ))}
                    {mediaVideos.map((vid) => (
                      <div key={vid.id} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', backgroundColor: '#374151', position: 'relative' }}>
                        <video src={vid.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: 32, height: 32, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>▶</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'files' && (
                mediaFiles.length === 0 ? <EmptyState text="Chưa có file" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mediaFiles.map((f) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12 }}>
                        <div style={{ width: 36, height: 36, backgroundColor: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FaFileAlt style={{ color: '#3b82f6', fontSize: 13 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                          <p style={{ fontSize: 11, color: '#6b7280' }}>{formatDate(f.timestamp)}</p>
                        </div>
                        <a href={f.url} download={f.name} target="_blank" rel="noreferrer" style={{ color: '#6b7280', display: 'flex' }} onClick={(e) => e.stopPropagation()}>
                          <FaDownload style={{ fontSize: 12 }} />
                        </a>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'links' && (
                mediaLinks.length === 0 ? <EmptyState text="Chưa có link" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mediaLinks.map((l) => (
                      <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, backgroundColor: '#f9fafb', borderRadius: 12, textDecoration: 'none' }}>
                        <div style={{ width: 32, height: 32, backgroundColor: '#eff6ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FaLink style={{ color: '#3b82f6', fontSize: 11 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</p>
                          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{formatDate(l.timestamp)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer - Rời nhóm / Giải tán nhóm */}
        <div style={S.footer}>
          <button style={S.dangerBtn} onClick={() => {
            // Nếu là owner, phải chuyển quyền trước
            if (isOwner) {
              setShowTransferOwnership(true);
            } else {
              setShowLeaveConfirm(true);
            }
          }}>
            <FaSignOutAlt style={{ fontSize: 12 }} />
            Rời nhóm
          </button>
          {isOwner && onDeleteGroup && (
            <button style={S.dangerBtn} onClick={() => setShowDeleteConfirm(true)}>
              <FaTrash style={{ fontSize: 12 }} />
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
        onConfirm={() => { setShowLeaveConfirm(false); onLeaveGroup(); }}
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
          onConfirm={() => { setShowDeleteConfirm(false); onDeleteGroup?.(); }}
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
          onSuccess={(data) => { setShowEditModal(false); onGroupInfoUpdated && onGroupInfoUpdated(data); }}
        />
      )}

      {/* Group Board Modal */}
      <GroupBoardModal
        show={showGroupBoard}
        onClose={() => setShowGroupBoard(false)}
        groupID={groupInfo.groupID}
        userID={currentUserID}
        onViewMessage={onViewMessage}
        onPinLimitReached={onPinLimitReached}
        canCreateNotes={canCreateNotes}
        canCreatePolls={canCreatePolls}
      />

      {/* Group Reminder Modal */}
      {showGroupReminder && (
        <GroupReminderModal
          groupID={groupInfo.groupID}
          userID={currentUserID}
          onClose={() => setShowGroupReminder(false)}
        />
      )}

      {/* Transfer Ownership Modal */}
      {showTransferOwnership && (
        <TransferOwnershipModal
          members={groupInfo.members}
          currentOwnerID={currentUserID}
          onClose={() => setShowTransferOwnership(false)}
          onTransfer={async (newOwnerID: string) => {
            try {
              // Chuyển quyền owner
              await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${newOwnerID}/role`, {
                role: 'owner'
              });
              
              toast.success('Đã chuyển quyền trưởng nhóm');
              setShowTransferOwnership(false);
              
              // Sau khi chuyển quyền thành công, cho phép rời nhóm
              await axiosInstance.post(`/groups/${groupInfo.groupID}/leave`);
              toast.success('Đã rời khỏi nhóm');
              
              // Redirect về home
              window.location.href = '/home';
            } catch (error: any) {
              toast.error(error.response?.data?.message || 'Lỗi khi chuyển quyền');
            }
          }}
        />
      )}

      {/* Group QR Modal */}
      {showGroupQR && (
        <GroupQRModal
          group={{
            groupID: groupInfo.groupID,
            name: groupInfo.name,
            avatar: groupInfo.avatar,
            memberCount: groupInfo.members?.length,
          }}
          onClose={() => setShowGroupQR(false)}
        />
      )}
    </>
  );
};

export default GroupInfoPanel;