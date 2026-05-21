import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import {
  FaComments,
  FaPaperPlane,
  FaSmile,
  FaPaperclip,
  FaTimes,
  FaReply,
  FaTrash,
  FaThumbsUp,
  FaInfoCircle,
  FaSearch,
  FaUserFriends,
  FaImage,
  FaVideo,
  FaMicrophone,
  FaStop,
  FaBell,
  FaPhone,
  FaPlay,
  FaPause,
  FaEllipsisV,
  FaForward,
  FaCopy,
  FaCrown,
  FaUserShield,
} from 'react-icons/fa';
import { BsPin, BsPinAngleFill } from 'react-icons/bs';
import { EmojiClickData } from 'emoji-picker-react';
import StickerEmojiPicker from './StickerEmojiPicker';
import ForwardMessageModal from './ForwardMessageModal';
import ImageViewerModal from './ImageViewerModal';
import ImageGrid from './ImageGrid';
import FilePreviewModal from './FilePreviewModal';
import { getToken } from '../utils/auth';
import { AddMembersModal } from './AddMembersModal';
import GroupInfoPanel from './GroupInfoPanel';
import GroupManagementModal from './GroupManagementModal';
import EditGroupInfoModal from './EditGroupInfoModal';
import PinLimitModal from './PinLimitModal';
import { groupMessages, isMessageGroup, MessageGroup } from '../utils/messageGrouping';
import GroupCallModal from './GroupCallModal';
import MentionDropdown, { MentionDropdownHandle } from './MentionDropdown';
import { getCaretCoordinates } from '../utils/caretPosition';
import OtherProfileModal from './OtherProfileModal';
import UserProfileModal from './UserProfileModal';
import PollMessage from './PollMessage';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import GroupBoardModal from './GroupBoardModal';
import { GroupSearchModal } from './GroupSearchModal';

const API = 'http://localhost:5000/api';

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface SenderInfo {
  name: string;
  avatar?: string;
}

interface ReplyTo {
  messageID: string;
  senderID: string;
  senderName?: string; // Thêm tên người gửi để hiển thị khi reply
  content?: string;
  type: string;
}

interface Message {
  messageID: string;
  groupID: string;
  senderID: string;
  content?: string;
  type: string;
  media_url: string[];
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  replyTo?: ReplyTo;
  senderInfo: SenderInfo;
  reactions?: Array<{ userID: string; emoji: string }>;
  pinnedInfo?: { pinnedBy?: string; pinnedAt?: string } | null;
  groupId?: string; // Thêm groupId để gom nhóm ảnh
  mentions?: string[]; // Thêm mentions
  pollID?: string; // Liên kết tới Poll document
}

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
  blockedMembers?: string[];
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

interface GroupChatWindowProps {
  groupID: string;
  userID: string;
  onShowGroupInfo?: () => void;
  onSelectChat?: (chat: any) => void;
  onGroupDissolved?: () => void;
}

const formatTime = (ts: string | Date) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

// Giphy API key cho gợi ý @GIF
const GIPHY_API_KEY = 'iw8DsJkjCByct4EHovySloueKpn6ljwK';

// Dữ liệu Sticker mẫu để tìm kiếm
const STICKER_DATA = [
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002734/android/sticker.png',
    name: 'cute dog',
    tags: ['cho', 'dog', 'hi', 'hello'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002735/android/sticker.png',
    name: 'happy cat',
    tags: ['meo', 'cat', 'vui', 'cuoi', 'haha'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002736/android/sticker.png',
    name: 'sad bear',
    tags: ['gau', 'bear', 'buon', 'khoc', 'hic'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002737/android/sticker.png',
    name: 'angry duck',
    tags: ['vit', 'duck', 'gian', 'cau', 'thoi'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002738/android/sticker.png',
    name: 'cool monkey',
    tags: ['khi', 'monkey', 'ngau', 'kinh', 'chat'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002739/android/sticker.png',
    name: 'shy bunny',
    tags: ['tho', 'bunny', 'ngai', 'xau ho', 'ahihi'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002740/android/sticker.png',
    name: 'surprised fox',
    tags: ['cao', 'fox', 'bat ngo', 'soc', 'ha'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002741/android/sticker.png',
    name: 'sleeping owl',
    tags: ['cu', 'owl', 'ngu', 'met', 'ngáp'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/51869384/android/sticker.png',
    name: 'love heart',
    tags: ['yeu', 'love', 'tim', 'heart'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/51869385/android/sticker.png',
    name: 'cheer up',
    tags: ['co len', 'cheer', 'fighting'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/51869386/android/sticker.png',
    name: 'thank you',
    tags: ['cam on', 'thanks', 'cảm ơn'],
  },
  {
    url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/51869387/android/sticker.png',
    name: 'good luck',
    tags: ['may man', 'lucky', 'chuc mung'],
  },
];

// ==================== Role Badge Component ====================
const RoleBadge = ({ role }: { role: 'owner' | 'admin' | 'member' }) => {
  if (role === 'owner') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0">
        <FaCrown className="text-[8px]" /> Trưởng nhóm
      </span>
    );
  }
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0">
        <FaUserShield className="text-[8px]" /> Phó nhóm
      </span>
    );
  }
  return null;
};

// ==================== File Icon Component ====================
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();

  type IconConfig = { bg: string; label: string };
  let config: IconConfig = { bg: '#8e8e93', label: 'FILE' };

  if (['doc', 'docx'].includes(ext || '')) config = { bg: '#4285f4', label: 'W' };
  else if (['xls', 'xlsx'].includes(ext || '')) config = { bg: '#34a853', label: 'X' };
  else if (['ppt', 'pptx'].includes(ext || '')) config = { bg: '#ea4335', label: 'P' };
  else if (ext === 'pdf') config = { bg: '#ea4335', label: 'PDF' };
  else if (['zip', 'rar', '7z'].includes(ext || '')) config = { bg: '#ff9500', label: 'ZIP' };

  return (
    <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
      <path d="M4 0h26l10 10v38a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" fill={config.bg} />
      <path d="M30 0l10 10H34a4 4 0 01-4-4V0z" fill="rgba(0,0,0,0.2)" />
      <text
        x="22"
        y="34"
        textAnchor="middle"
        fill="white"
        fontSize={config.label.length > 2 ? '11' : '16'}
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
      >
        {config.label}
      </text>
    </svg>
  );
};

// ==================== File Display Component ====================
const FileDisplay = ({
  fileName,
  fileUrl,
  isMine = false,
}: {
  fileName: string;
  fileUrl: string;
  isMine?: boolean;
}) => {
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetch(fileUrl, { method: 'HEAD' })
      .then((res) => {
        const size = res.headers.get('content-length');
        if (size) setFileSize(parseInt(size));
      })
      .catch(() => {});
  }, [fileUrl]);

  const handleDownload = async () => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-3 px-3 py-2.5 min-w-[280px] max-w-[400px] cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
        onClick={() => setShowPreview(true)}
      >
        {getFileIcon(fileName)}
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-[14px] truncate mb-0.5 ${isMine ? 'text-gray-900' : 'text-gray-900'}`}
          >
            {fileName}
          </p>
          <div className={`text-[12px] ${isMine ? 'text-gray-500' : 'text-gray-500'}`}>
            <span>{fileSize ? formatFileSize(fileSize) : 'Đang tải...'}</span>
            <span className="mx-1">•</span>
            <span className="text-blue-500">Nhấn để xem</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isMine ? 'bg-blue-100 hover:bg-blue-200 text-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
          title="Tải xuống"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
        </button>
      </div>

      {/* File Preview Modal */}
      {showPreview && (
        <FilePreviewModal
          fileName={fileName}
          fileUrl={fileUrl}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};

// ==================== Audio Player Component ====================
const AudioPlayer = ({ src, isMine }: { src: string; isMine: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(s % 60)
      .toString()
      .padStart(2, '0')}`;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[240px] max-w-[280px] ${isMine ? 'bg-blue-50' : 'bg-white'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          setProgress(
            audioRef.current.duration
              ? (audioRef.current.currentTime / audioRef.current.duration) * 100
              : 0
          );
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
      />

      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#0068ff] text-white hover:bg-[#0077c2] transition-colors shadow-md"
      >
        {playing ? <FaPause className="text-sm" /> : <FaPlay className="text-sm ml-0.5" />}
      </button>

      <div className="flex items-center gap-[3px] h-8 flex-1">
        {[20, 35, 50, 40, 55, 30, 45, 38, 52, 28, 42, 35].map((height, i) => (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all ${isMine ? 'bg-blue-400/70' : 'bg-[#0068ff]'}`}
            style={{
              height: `${progress > (i / 12) * 100 ? height : height * 0.4}%`,
              opacity: progress > (i / 12) * 100 ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      <span
        className={`text-xs font-medium shrink-0 ${isMine ? 'text-gray-600' : 'text-gray-700'}`}
      >
        {fmt(duration)}
      </span>

      <a
        href={src}
        download
        className={`shrink-0 ${isMine ? 'text-gray-900/80 hover:text-gray-900' : 'text-gray-300 hover:text-gray-900'} transition-colors`}
        onClick={(e) => e.stopPropagation()}
        title="Tải xuống"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 3a1 1 0 011 1v5.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L9 9.586V4a1 1 0 011-1z" />
          <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
        </svg>
      </a>
    </div>
  );
};

export const GroupChatWindow = ({
  groupID,
  userID,
  onShowGroupInfo,
  onSelectChat,
  onGroupDissolved,
}: GroupChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showMembersSidebar, setShowMembersSidebar] = useState(false);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<any[]>([]);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [chatImages, setChatImages] = useState<
    { url: string; timestamp: string; messageID?: string }[]
  >([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showGroupInfoPanel, setShowGroupInfoPanel] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showEditGroupInfoModal, setShowEditGroupInfoModal] = useState(false);
  const [showGroupCall, setShowGroupCall] = useState(false);
  const [joinExistingCall, setJoinExistingCall] = useState(false);
  const [groupCallIsCallee, setGroupCallIsCallee] = useState(false);
  const [groupCallWithVideo, setGroupCallWithVideo] = useState(true);
  const [groupCallInitialParticipants, setGroupCallInitialParticipants] = useState<
    { userID: string; name: string; avatar?: string }[]
  >([]);

  // Board Modal States
  const [showBoard, setShowBoard] = useState(false);
  const [boardTab, setBoardTab] = useState<'all' | 'pinned' | 'notes' | 'polls'>('all');
  const [boardInitialPollId, setBoardInitialPollId] = useState<string | undefined>(undefined);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  // Lắng nghe sự kiện mở chi tiết bình chọn từ các component con (như PollMessage)
  useEffect(() => {
    const handleOpenPollDetail = (e: any) => {
      const { pollID } = e.detail;
      if (pollID) {
        setBoardInitialPollId(pollID);
        setBoardTab('polls');
        setShowBoard(true);
      }
    };

    window.addEventListener('open-poll-detail', handleOpenPollDetail);
    return () => window.removeEventListener('open-poll-detail', handleOpenPollDetail);
  }, []);

  const getMyInfo = () => ({
    userID,
    name:
      members.find((m) => m.userID === userID)?.name ||
      groupInfo?.members.find((m) => m.userID === userID)?.name ||
      userID,
    anhDaiDien: groupInfo?.members.find((m) => m.userID === userID)?.avatar,
  });

  // Chuyển sang chat 1-1 từ profile (khi nhấn "Nhắn tin")
  const handleStartChat1_1 = (chat: any) => {
    setShowOtherProfile(false);
    // Nếu có callback từ HomePage, gọi nó để chuyển chat
    if (onSelectChat) {
      onSelectChat(chat);
    }
  };

  // Gửi lời mời kết bạn (Dùng sdt từ profile đã fetch)
  const handleAddFriendFromProfile = async () => {
    if (!selectedUserForProfile || !selectedUserForProfile.sdt) {
      toast.error('Không tìm thấy số điện thoại người dùng');
      return;
    }
    try {
      await axiosInstance.post('/contacts/send-friend-request', {
        recipientPhone: selectedUserForProfile.sdt,
        message: 'Mình kết bạn nhé!',
      });
      toast.success(`Đã gửi lời mời kết bạn tới ${selectedUserForProfile.name}`);

      // Update local state for friendStatus
      setSelectedUserForProfile((prev: any) =>
        prev ? { ...prev, friendStatus: 'pending_sent' } : prev
      );

      // Emit socket để thông báo bên kia
      socket.emit('friend_request_sent', {
        from: userID,
        to: selectedUserForProfile.userID,
      });
    } catch {
      toast.error('Lỗi khi gửi lời mời kết bạn');
    }
  };

  const handleAcceptFriendFromProfile = async () => {
    if (!selectedUserForProfile) return;
    try {
      await axiosInstance.post('/contacts/accept-friend-request', {
        senderID: selectedUserForProfile.userID,
      });
      toast.success(`Đã trở thành bạn với ${selectedUserForProfile.name}`);
      setSelectedUserForProfile((prev: any) =>
        prev ? { ...prev, friendStatus: 'accepted' } : prev
      );
      socket.emit('friend_request_accepted', { from: userID, to: selectedUserForProfile.userID });
    } catch {
      toast.error('Lỗi khi chấp nhận kết bạn');
    }
  };

  const handleRejectFriendFromProfile = async () => {
    if (!selectedUserForProfile) return;
    try {
      await axiosInstance.post('/contacts/reject-friend-request', {
        senderID: selectedUserForProfile.userID,
      });
      toast.success(`Đã từ chối lời mời từ ${selectedUserForProfile.name}`);
      setSelectedUserForProfile((prev: any) => (prev ? { ...prev, friendStatus: 'none' } : prev));
    } catch {
      toast.error('Lỗi khi từ chối kết bạn');
    }
  };

  const handleRecallFriendFromProfile = async () => {
    if (!selectedUserForProfile) return;
    try {
      await axiosInstance.post('/contacts/cancel-friend-request', {
        recipientID: selectedUserForProfile.userID,
      });
      toast.success(`Đã thu hồi lời mời tới ${selectedUserForProfile.name}`);
      setSelectedUserForProfile((prev: any) => (prev ? { ...prev, friendStatus: 'none' } : prev));
    } catch {
      toast.error('Lỗi khi thu hồi lời mời');
    }
  };

  const openNewCall = () => setShowGroupCall(true);

  const joinCall = () => {
    setGroupCallIsCallee(true);
    setGroupCallWithVideo(true);
    setGroupCallInitialParticipants([]);
    setJoinExistingCall(true);
  };
  const [incomingGroupCall, setIncomingGroupCall] = useState<{
    callerInfo: { name: string; avatar?: string };
    groupName: string;
    invitedNames: string[];
    groupID: string;
  } | null>(null);
  const [groupCallAccepted, setGroupCallAccepted] = useState<{ withVideo: boolean } | null>(null);
  const [showPinLimitModal, setShowPinLimitModal] = useState(false);
  const [pendingPinItem, setPendingPinItem] = useState<{
    type: 'message' | 'note';
    id: string;
    data: any;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  interface JoinRequest {
    requestID: string;
    userID: string;
    name: string;
    avatar?: string;
    requestedByName: string;
  }
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [pendingApprovalModal, setPendingApprovalModal] = useState<{
    requestID: string;
    inviteeName: string;
    inviterName: string;
  } | null>(null);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [pinnedMenuId, setPinnedMenuId] = useState<string | null>(null);

  // States cho tính năng Mention
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentions, setMentions] = useState<string[]>([]); // Lưu danh sách UserID được tag
  const [dropdownCoords, setDropdownCoords] = useState({ x: 0, y: 0 });
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<any>(null);
  const [showOtherProfile, setShowOtherProfile] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [suggestedGifs, setSuggestedGifs] = useState<any[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionDropdownRef = useRef<MentionDropdownHandle>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Helper: lấy role của sender từ members list
  const getSenderRole = (senderID: string): 'owner' | 'admin' | 'member' => {
    return members.find((m) => m.userID === senderID)?.role || 'member';
  };

  // Helper cho việc trả lời tin nhắn: Tự động @tên người khác
  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    if (msg.senderID !== userID) {
      const senderName =
        msg.senderInfo?.name || members.find((m) => m.userID === msg.senderID)?.name;
      if (senderName) {
        handleInputChange(`@${senderName} `);
        // Tự động focus vào ô nhập
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    }
  };

  const fetchGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const [groupRes, messagesRes] = await Promise.all([
        axiosInstance.get(`/groups/${groupID}`),
        axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=50`),
      ]);

      const groupData = groupRes.data;

      console.log('📥 Fetched group data:', {
        groupID: groupData.groupID,
        hasSettings: !!groupData.settings,
        settings: groupData.settings,
      });

      setGroupInfo({
        groupID: groupData.groupID,
        name: groupData.name,
        avatar: groupData.avatar,
        description: groupData.description,
        ownerID: groupData.ownerID,
        members: groupData.members || [],
        memberCount: groupData.members?.length || 0,
        settings: groupData.settings,
        blockedMembers: groupData.blockedMembers || [],
      });

      // Fetch user info for each member
      const membersWithInfo = await Promise.all(
        (groupData.members || []).map(async (member: any) => {
          try {
            const userRes = await axiosInstance.post('/usersID', { userID: member.userID });
            return {
              _id: member._id,
              userID: member.userID,
              name: userRes.data.name || member.userID,
              avatar: userRes.data.anhDaiDien,
              role: member.role,
              joinedAt: member.joinedAt,
              isActive: member.isActive,
            };
          } catch {
            return {
              _id: member._id,
              userID: member.userID,
              name: member.userID,
              avatar: undefined,
              role: member.role,
              joinedAt: member.joinedAt,
              isActive: member.isActive,
            };
          }
        })
      );

      setMembers(membersWithInfo);

      // Cập nhật groupInfo.members với tên/avatar thật
      setGroupInfo((prev) => (prev ? { ...prev, members: membersWithInfo } : prev));
      setMessages(messagesRes.data.messages || []);

      // Load pinned messages
      setPinnedMessages(
        (messagesRes.data.messages || []).filter(
          (m: Message) => m.pinnedInfo && m.pinnedInfo.pinnedBy
        )
      );

      // Load all images from chat
      const images = (messagesRes.data.messages || [])
        .filter((m: Message) => m.type === 'image' && m.media_url?.length)
        .map((m: Message) => ({
          url: m.media_url[0],
          timestamp: m.timestamp.toString(),
          messageID: m.messageID,
        }));
      setChatImages(images);
    } catch (error) {
      console.error('Error fetching group data:', error);
    } finally {
      setLoading(false);
    }
  }, [groupID]);

  const fetchPinnedMessages = useCallback(async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/pinned-messages`);
      setPinnedMessages(response.data.pinnedMessages || []);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      setPinnedMessages([]);
    }
  }, [groupID]);

  const fetchPinnedNotes = useCallback(async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/notes`);
      const allNotes = response.data.notes || [];
      const pinned = allNotes.filter((note: any) => note.isPinned);
      setPinnedNotes(pinned);
    } catch (error) {
      console.error('Error fetching pinned notes:', error);
      setPinnedNotes([]);
    }
  }, [groupID]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;

    try {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      const response = await axiosInstance.get(
        `/groups/${groupID}/messages?page=${nextPage}&limit=50`
      );
      const olderMessages = response.data.messages || [];

      if (olderMessages.length > 0) {
        // Save current scroll position
        const container = messagesContainerRef.current;
        const oldScrollHeight = container?.scrollHeight || 0;

        setMessages((prev) => [...olderMessages, ...prev]);
        setCurrentPage(nextPage);
        setHasMoreMessages(olderMessages.length === 50);

        // Restore scroll position after new messages are added
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 0);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [groupID, currentPage, isLoadingMore, hasMoreMessages]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      // Load more when scrolled to top (within 100px)
      if (container.scrollTop < 100 && !isLoadingMore && hasMoreMessages) {
        loadMoreMessages();
      }
    },
    [isLoadingMore, hasMoreMessages, loadMoreMessages]
  );

  const fetchJoinRequests = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/groups/${groupID}/join-requests`);
      setJoinRequests(res.data);
    } catch {
      // không phải owner/admin thì bỏ qua
    }
  }, [groupID]);

  // Fetch nhẹ — chỉ cập nhật group info + members, không reload messages, không set loading
  const refreshGroupInfo = useCallback(async () => {
    try {
      const groupRes = await axiosInstance.get(`/groups/${groupID}`);
      const groupData = groupRes.data;

      const membersWithInfo = await Promise.all(
        (groupData.members || []).map(async (member: any) => {
          try {
            const userRes = await axiosInstance.post('/usersID', { userID: member.userID });
            return {
              _id: member._id,
              userID: member.userID,
              name: userRes.data.name || member.userID,
              avatar: userRes.data.anhDaiDien,
              role: member.role,
              joinedAt: member.joinedAt,
              isActive: member.isActive,
            };
          } catch {
            return {
              _id: member._id,
              userID: member.userID,
              name: member.userID,
              avatar: undefined,
              role: member.role,
              joinedAt: member.joinedAt,
              isActive: member.isActive,
            };
          }
        })
      );

      setMembers(membersWithInfo);
      setGroupInfo((prev) =>
        prev
          ? {
              ...prev,
              name: groupData.name,
              avatar: groupData.avatar,
              description: groupData.description,
              ownerID: groupData.ownerID,
              members: membersWithInfo,
              memberCount: membersWithInfo.length,
              settings: groupData.settings,
              blockedMembers: groupData.blockedMembers || [],
            }
          : prev
      );
    } catch (error) {
      console.error('Error refreshing group info:', error);
    }
  }, [groupID]);

  const handleNewMessage = useCallback(
    (message: Message) => {
      console.log('📨 handleNewMessage called:', {
        messageID: message.messageID,
        groupID: message.groupID,
        currentGroupID: groupID,
        senderID: message.senderID,
        currentUserID: userID,
        forwardedFrom: message.forwardedFrom,
        type: message.type,
      });

      if (message.groupID !== groupID) {
        console.log('⏭️ Skipping: different groupID');
        return;
      }

      setMessages((prev) => {
        // KIỂM TRA TRÙNG LẶP: Nếu messageID đã tồn tại thì không thêm nữa
        const exists = prev.some((m) => m.messageID === message.messageID);
        if (exists) {
          console.log('⚠️ Duplicate message detected, skipping:', message.messageID);
          return prev;
        }

        // Nếu là tin nhắn của chính mình → BỎ QUA hoàn toàn
        // NGOẠI TRỪ: Poll, Notification, và Forwarded message (cần hiển thị ngay)
        if (
          message.senderID === userID &&
          message.type !== 'poll' &&
          message.type !== 'notification' &&
          !message.forwardedFrom
        ) {
          console.log('⏭️ Skipping: own message (not poll/notification/forwarded)');
          return prev;
        }

        // Tin nhắn người khác hoặc forwarded message → thêm bình thường
        console.log('✅ Adding message to state:', message.messageID);
        return [...prev, message];
      });

      // Nếu đang mở group này, đánh dấu đã đọc tin nhắn mới ngay lập tức
      if (message.senderID !== userID) {
        socket.emit('mark_as_read', {
          messageID: message.messageID,
          userID,
          groupID,
        });
      }
    },
    [groupID, userID]
  );

  const handleTypingStart = useCallback(
    (data: { groupID: string; userID: string; userName: string }) => {
      if (data.groupID === groupID && data.userID !== userID) {
        setTypingUsers((prev) => new Map(prev).set(data.userID, data.userName));
      }
    },
    [groupID, userID]
  );

  const handleTypingStop = useCallback(
    (data: { groupID: string; userID: string }) => {
      if (data.groupID === groupID) {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(data.userID);
          return newMap;
        });
      }
    },
    [groupID]
  );

  // Fetch GIF gợi ý khi người dùng gõ @GIF
  useEffect(() => {
    const lowerText = inputText.toLowerCase();
    if (lowerText.startsWith('@gif')) {
      const query = inputText.substring(4).trim();
      const timer = setTimeout(() => {
        fetchGifs(query);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSuggestedGifs([]);
    }
  }, [inputText]);

  const fetchGifs = async (query: string) => {
    setIsLoadingGifs(true);
    try {
      const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=15&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=15&rating=g`;
      const response = await fetch(url);
      const data = await response.json();
      setSuggestedGifs(data.data || []);
    } catch (error) {
      console.error('Error fetching GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const handleMessageDeleted = useCallback((data: { messageID: string; deleteForAll: boolean }) => {
    if (data.deleteForAll) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === data.messageID
            ? { ...msg, type: 'notification', content: 'Tin nhắn đã bị xóa' }
            : msg
        )
      );
    }
  }, []);

  const handleUnsendNotification = useCallback((data: any) => {
    console.log('📩 Received unsend_group_notification:', data);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.messageID === data.messageID
          ? { ...msg, type: 'notification', content: 'Tin nhắn đã bị thu hồi', media_url: [] }
          : msg
      )
    );
    // Xóa khỏi pinned messages nếu có
    setPinnedMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
  }, []);

  const handleMessageDeletedLocal = useCallback(
    (data: { messageID: string; userID: string }) => {
      // Chỉ xóa message khỏi UI của user hiện tại
      if (data.userID === userID) {
        setMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
        setPinnedMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
      }
    },
    [userID]
  );

  const handleReactionUpdated = useCallback(
    (data: { messageID: string; reactions: Array<{ userID: string; emoji: string }> }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === data.messageID ? { ...msg, reactions: data.reactions } : msg
        )
      );
    },
    []
  );

  const handlePinNotification = useCallback(
    (data: any) => {
      console.log('📌 Pin notification received:', data);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === data.messageID ? { ...msg, pinnedInfo: data.pinnedInfo } : msg
        )
      );
      // Refresh pinned messages list from API
      fetchPinnedMessages();
    },
    [fetchPinnedMessages]
  );

  const handleUnpinNotification = useCallback(
    (data: any) => {
      console.log('📌 Unpin notification received:', data);
      setMessages((prev) =>
        prev.map((msg) => (msg.messageID === data.messageID ? { ...msg, pinnedInfo: null } : msg))
      );
      // Refresh pinned messages list from API
      fetchPinnedMessages();
    },
    [fetchPinnedMessages]
  );

  // Note event handlers
  const handleNoteCreated = useCallback(
    (note: any) => {
      console.log('📝 Note created:', note);
      fetchPinnedNotes();
    },
    [fetchPinnedNotes]
  );

  const handleNoteUpdated = useCallback(
    (note: any) => {
      console.log('📝 Note updated:', note);
      fetchPinnedNotes();
    },
    [fetchPinnedNotes]
  );

  const handleNoteDeleted = useCallback(
    (data: { noteID: string }) => {
      console.log('📝 Note deleted:', data);
      fetchPinnedNotes();
    },
    [fetchPinnedNotes]
  );

  const handleNotePinToggled = useCallback(
    (note: any) => {
      console.log('📝 Note pin toggled:', note);
      fetchPinnedNotes();
    },
    [fetchPinnedNotes]
  );

  // Group settings updated handler
  const handleGroupSettingsUpdated = useCallback(
    (data: { groupID: string; settings: any }) => {
      console.log('⚙️ Group settings updated:', data);
      if (data.groupID === groupID) {
        // Update groupInfo.settings real-time instead of full reload
        setGroupInfo((prev) =>
          prev
            ? {
                ...prev,
                settings: data.settings,
              }
            : prev
        );
        toast.success('Cài đặt nhóm đã được cập nhật');
      }
    },
    [groupID]
  );

  // Group info updated handler (real-time name/avatar change)
  const handleGroupInfoUpdated = useCallback(
    (data: { groupID: string; name?: string; avatar?: string }) => {
      console.log('🖼️ Group info updated:', data);
      if (data.groupID !== groupID) return;
      setGroupInfo((prev) =>
        prev
          ? {
              ...prev,
              name: data.name ?? prev.name,
              avatar: data.avatar ?? prev.avatar,
            }
          : prev
      );
    },
    [groupID]
  );

  // Group dissolved handler
  const handleGroupDissolved = useCallback(
    (data: { groupID: string; message: string }) => {
      console.log('💥 Group dissolved:', data);
      if (data.groupID === groupID) {
        toast.error(data.message);
        // Use callback to navigate without hard reload
        setTimeout(() => {
          if (onGroupDissolved) {
            onGroupDissolved();
          } else if (onSelectChat) {
            // Fallback: clear selected chat if used in HomePage
            onSelectChat(null);
          } else {
            // Last resort: navigate to home (but this shouldn't happen)
            window.location.href = '/home';
          }
        }, 2000);
      }
    },
    [groupID, onGroupDissolved, onSelectChat]
  );

  // Member role changed handler
  const handleMemberRoleChanged = useCallback(
    (data: { groupID: string; userID: string; newRole: string }) => {
      console.log('👤 Member role changed:', data);
      if (data.groupID === groupID) {
        // Refresh group data to get latest member roles
        fetchGroupData();
        if (data.userID === userID) {
          toast.success(
            `Vai trò của bạn đã được thay đổi thành ${data.newRole === 'admin' ? 'Phó nhóm' : 'Thành viên'}`
          );
        }
      }
    },
    [groupID, userID, fetchGroupData]
  );

  // Member kicked handler
  const handleMemberKicked = useCallback(
    (data: { groupID: string; kickedUserID: string; kickedName: string }) => {
      console.log('👢 Member kicked:', data);
      if (data.groupID === groupID) {
        if (data.kickedUserID === userID) {
          toast.error('Bạn đã bị xóa khỏi nhóm');
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          // Refresh group data to update member list
          fetchGroupData();
        }
      }
    },
    [groupID, userID, fetchGroupData]
  );

  // Member left handler
  const handleMemberLeft = useCallback(
    (data: { groupID: string; userID: string; userName: string }) => {
      console.log('🚪 Member left:', data);
      if (data.groupID === groupID) {
        // Refresh group data to update member list
        fetchGroupData();
      }
    },
    [groupID, fetchGroupData]
  );

  useEffect(() => {
    fetchGroupData();

    // Monitor socket connection
    const handleConnect = () => {
      console.log('✅ Socket connected');
      console.log('🔌 Joining group:', { groupID, userID });
      setSocketConnected(true);
      socket.emit('join_group', { groupID, userID });
    };

    const handleDisconnect = () => {
      console.log('❌ Socket disconnected');
      setSocketConnected(false);
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Add error handler
    socket.on('error_notification', (data: { message: string }) => {
      console.error('❌ Socket error:', data.message);
      toast.error(data.message);
    });

    socket.on('new_group_message', handleNewMessage);
    socket.on('group_typing_start', handleTypingStart);
    socket.on('group_typing_stop', handleTypingStop);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('unsend_group_notification', handleUnsendNotification);
    socket.on('message_deleted_local', handleMessageDeletedLocal);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('ghim_group_notification', handlePinNotification);
    socket.on('unghim_group_notification', handleUnpinNotification);
    socket.on('note_created', handleNoteCreated);
    socket.on('note_updated', handleNoteUpdated);
    socket.on('note_deleted', handleNoteDeleted);
    socket.on('note_pin_toggled', handleNotePinToggled);
    socket.on('group_settings_updated', handleGroupSettingsUpdated);
    socket.on('group_info_updated', handleGroupInfoUpdated);
    socket.on('group_dissolved', handleGroupDissolved);
    socket.on('member_role_changed', handleMemberRoleChanged);
    socket.on('member_kicked', handleMemberKicked);
    socket.on('member_left', handleMemberLeft);
    socket.on('new_join_request', () => fetchJoinRequests());
    socket.on('join_request_resolved', (data: { requestID: string }) => {
      setJoinRequests((prev) => prev.filter((r) => r.requestID !== data.requestID));
    });
    socket.on('new_join_request_notification', (data: { groupID: string; message: Message }) => {
      if (data.groupID !== groupID) return;
      const currentRole = groupInfo?.members?.find((m) => m.userID === userID)?.role;
      if (currentRole === 'owner' || currentRole === 'admin') {
        setMessages((prev) => [...prev, data.message]);
      }
    });

    // ==================== MENTION NOTIFICATIONS ====================
    socket.on('user_mentioned', (data: any) => {
      console.log('🔔 Received user_mentioned:', data);
      if (data.groupID === groupID) {
        toast(`Bạn được ${data.mentionerName} nhắc tên: "${data.contentSnippet}..."`, {
          icon: '🔔',
          duration: 5000,
          position: 'top-right',
        });
      }
    });

    socket.on('group_mention_all', (data: any) => {
      console.log('🔔 Received group_mention_all:', data);
      if (data.groupID === groupID && data.mentionerID !== userID) {
        toast(`${data.mentionerName} đã nhắc tên tất cả`, {
          icon: '📣',
          duration: 5000,
          position: 'top-right',
        });
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error_notification');
      socket.off('new_group_message', handleNewMessage);
      socket.off('group_typing_start', handleTypingStart);
      socket.off('group_typing_stop', handleTypingStop);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('unsend_group_notification', handleUnsendNotification);
      socket.off('message_deleted_local', handleMessageDeletedLocal);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('ghim_group_notification', handlePinNotification);
      socket.off('unghim_group_notification', handleUnpinNotification);
      socket.off('note_created', handleNoteCreated);
      socket.off('note_updated', handleNoteUpdated);
      socket.off('note_deleted', handleNoteDeleted);
      socket.off('note_pin_toggled', handleNotePinToggled);
      socket.off('group_settings_updated', handleGroupSettingsUpdated);
      socket.off('group_info_updated', handleGroupInfoUpdated);
      socket.off('group_dissolved', handleGroupDissolved);
      socket.off('member_role_changed', handleMemberRoleChanged);
      socket.off('member_kicked', handleMemberKicked);
      socket.off('member_left', handleMemberLeft);
      socket.off('new_join_request');
      socket.off('join_request_resolved');
      socket.off('new_join_request_notification');
      socket.emit('leave_group', { groupID, userID });
    };
  }, [
    groupID,
    userID,
    fetchGroupData,
    fetchJoinRequests,
    handleNewMessage,
    handleTypingStart,
    handleTypingStop,
    handleMessageDeleted,
    handleUnsendNotification,
    handleMessageDeletedLocal,
    handleReactionUpdated,
    handlePinNotification,
    handleUnpinNotification,
    handleNoteCreated,
    handleNoteUpdated,
    handleNoteDeleted,
    handleNotePinToggled,
    handleGroupSettingsUpdated,
    handleGroupInfoUpdated,
    handleGroupDissolved,
    handleMemberRoleChanged,
    handleMemberKicked,
    handleMemberLeft,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close pinned menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pinnedMenuId) {
        setPinnedMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [pinnedMenuId]);

  const dispatchGroupMessageContent = (
    msgData: { content: string; type: Message['type']; media_url: string[]; groupId?: string },
    currentReplyTo?: typeof replyTo
  ) => {
    if (!socketConnected) {
      toast.error('Không có kết nối socket. Vui lòng tải lại trang.');
      return;
    }

    const tempMessageID = `temp_${Date.now()}_${Math.random()}`;
    const currentUserInfo = members.find((m) => m.userID === userID);
    const optimisticMessage: Message = {
      messageID: tempMessageID,
      groupID,
      senderID: userID,
      content: msgData.content,
      type: msgData.type,
      media_url: msgData.media_url,
      groupId: msgData.groupId,
      timestamp: new Date(),
      status: 'sent',
      replyTo: currentReplyTo
        ? {
            messageID: currentReplyTo.messageID,
            senderID: currentReplyTo.senderID,
            senderName:
              currentReplyTo.senderInfo?.name ||
              members.find((m) => m.userID === currentReplyTo.senderID)?.name,
            content: currentReplyTo.content,
            type: currentReplyTo.type,
          }
        : undefined,
      mentions: [...mentions], // QUAN TRỌNG: Include mentions để render tag ngay lập tức cho người gửi
      senderInfo: {
        name: currentUserInfo?.name || 'Bạn',
        avatar: currentUserInfo?.avatar,
      },
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const message = {
      groupID,
      senderID: userID,
      content: msgData.content,
      type: msgData.type,
      media_url: msgData.media_url,
      groupId: msgData.groupId,
      replyTo: currentReplyTo
        ? {
            messageID: currentReplyTo.messageID,
            senderID: currentReplyTo.senderID,
            senderName:
              currentReplyTo.senderInfo?.name ||
              members.find((m) => m.userID === currentReplyTo.senderID)?.name,
            content: currentReplyTo.content,
            type: currentReplyTo.type,
          }
        : undefined,
      mentions: mentions, // Gửi danh sách ID được tag
    };

    socket.emit('send_group_message', message, (response: any) => {
      if (response?.error) {
        toast.error(response.error);
      } else if (response?.success && response?.message) {
        const realMessage: Message = response.message;
        setMessages((prev) => {
          const withoutTemp = prev.filter((msg) => msg.messageID !== tempMessageID);
          const alreadyExists = withoutTemp.some((msg) => msg.messageID === realMessage.messageID);
          return alreadyExists ? withoutTemp : [...withoutTemp, realMessage];
        });
      }
    });

    console.log('✅ Message emitted via socket');

    setInputText('');
    setReplyTo(null);
    setMentions([]); // QUAN TRỌNG: Clear danh sách tag sau khi gửi

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('group_typing_stop', { groupID, userID });
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const messageContent = inputText.trim();
    const currentReplyTo = replyTo;

    setInputText('');
    setReplyTo(null);

    dispatchGroupMessageContent(
      { content: messageContent, type: 'text', media_url: [] },
      currentReplyTo
    );
  };

  const sendEmoji = (emojiData: EmojiClickData) => {
    setInputText((prev) => prev + emojiData.emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const sendSticker = async (stickerUrl: string) => {
    dispatchGroupMessageContent(
      { content: '', type: 'sticker', media_url: [stickerUrl] },
      replyTo || undefined
    );
    setShowEmoji(false);
    setReplyTo(null);
  };

  const sendGif = async (gifUrl: string) => {
    dispatchGroupMessageContent(
      { content: '', type: 'gif', media_url: [gifUrl] },
      replyTo || undefined
    );
    setShowEmoji(false);
    setReplyTo(null);
  };

  const sendFilesDirectly = async (fileList: File[]) => {
    if (!fileList.length) return;
    setIsUploading(true);

    const groups: Record<string, File[]> = { image: [], video: [], file: [] };
    fileList.forEach((f) => {
      if (f.type.startsWith('image/')) groups.image.push(f);
      else if (f.type.startsWith('video/')) groups.video.push(f);
      else groups.file.push(f);
    });

    try {
      for (const [type, files] of Object.entries(groups)) {
        if (!files.length) continue;

        const form = new FormData();
        files.forEach((f) => form.append('files', f));

        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });

        if (!res.ok) {
          throw new Error(`Upload failed: ${res.status}`);
        }

        const data = await res.json();

        // Tạo groupId cho các ảnh được gửi cùng lúc
        const groupId =
          type === 'image' && data.urls.length > 1
            ? `img_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            : undefined;
        if (type === 'image' || type === 'video') {
          for (let i = 0; i < data.urls.length; i++) {
            dispatchGroupMessageContent(
              {
                content: '',
                type: type as any,
                media_url: [data.urls[i]],
                groupId, // Thêm groupId để gom nhóm ảnh
              },
              replyTo || undefined
            );
            if (i < data.urls.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        } else {
          for (let i = 0; i < files.length; i++) {
            dispatchGroupMessageContent(
              {
                content: files[i].name,
                type: 'file',
                media_url: [data.urls[i]],
              },
              replyTo || undefined
            );
            if (i < files.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
        }
      }
      setFiles([]);
      setReplyTo(null);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Lỗi upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error('Không thể truy cập microphone');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setAudioBlob(null);
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingTime(0);
  };

  const sendAudio = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', audioBlob, 'voice-message.webm');
      const res = await fetch(`${API}/upload/audio`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      dispatchGroupMessageContent(
        {
          content: '',
          type: 'audio',
          media_url: [data.url],
        },
        replyTo || undefined
      );
      setAudioBlob(null);
      setRecordingTime(0);
      setReplyTo(null);
    } catch (err) {
      console.error('Error sending audio:', err);
      toast.error('Lỗi gửi audio');
    } finally {
      setIsUploading(false);
    }
  };

  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handlePin = (msg: Message) => {
    if (!msg.messageID) return;

    if (msg.pinnedInfo) {
      // Unpin message - Optimistic update
      console.log('📌 Unpinning message:', msg.messageID);

      // Update UI immediately
      setMessages((prev) =>
        prev.map((m) => (m.messageID === msg.messageID ? { ...m, pinnedInfo: null } : m))
      );
      setPinnedMessages((prev) => prev.filter((m) => m.messageID !== msg.messageID));

      // Send to server
      socket.emit('unghim_group_message', {
        messageID: msg.messageID,
        groupID,
        senderID: userID,
      });
    } else {
      // Check if already have 3 pinned items (messages + notes)
      const totalPinned = pinnedMessages.length + pinnedNotes.length;
      if (totalPinned >= 3) {
        // Store the pending pin item
        setPendingPinItem({ type: 'message', id: msg.messageID, data: msg });
        setShowPinLimitModal(true);
        setActionMsgId(null);
        return;
      }

      // Pin message - Optimistic update
      console.log('📌 Pinning message:', msg.messageID);

      const pinnedInfo = {
        pinnedBy: userID,
        pinnedAt: new Date().toISOString(),
      };

      // Update UI immediately
      setMessages((prev) =>
        prev.map((m) => (m.messageID === msg.messageID ? { ...m, pinnedInfo } : m))
      );

      // Add to pinned messages list
      const updatedMsg = { ...msg, pinnedInfo };
      setPinnedMessages((prev) => [updatedMsg, ...prev]);

      // Send to server
      socket.emit('ghim_group_message', {
        messageID: msg.messageID,
        groupID,
        senderID: userID,
      });
    }

    setActionMsgId(null);
  };

  const handleMoveToTop = (msg: Message) => {
    if (!msg.messageID) return;
    // Unpin then re-pin to move to top
    socket.emit('unghim_group_message', {
      messageID: msg.messageID,
      groupID,
      senderID: userID,
    });
    setTimeout(() => {
      socket.emit('ghim_group_message', {
        messageID: msg.messageID,
        groupID,
        senderID: userID,
      });
    }, 100);
    setPinnedMenuId(null);
    toast.success('Đã đưa lên đầu');
  };

  const handleCopyPinned = (msg: Message) => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
      toast.success('Đã sao chép');
    }
    setPinnedMenuId(null);
  };

  const handleUnpinFromMenu = (msg: Message) => {
    if (!msg.messageID) return;

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.messageID === msg.messageID ? { ...m, pinnedInfo: null } : m))
    );
    setPinnedMessages((prev) => prev.filter((m) => m.messageID !== msg.messageID));

    // Send to server
    socket.emit('unghim_group_message', {
      messageID: msg.messageID,
      groupID,
      senderID: userID,
    });
    setPinnedMenuId(null);
  };

  const handleReplacePinnedItem = async (itemIdToReplace: string) => {
    if (!pendingPinItem) return;

    // Step 1: Unpin the selected item
    const messageToUnpin = pinnedMessages.find((m) => m.messageID === itemIdToReplace);
    const noteToUnpin = pinnedNotes.find((n) => n.noteID === itemIdToReplace);

    if (messageToUnpin) {
      socket.emit('unghim_group_message', {
        messageID: itemIdToReplace,
        groupID,
        senderID: userID,
      });
    } else if (noteToUnpin) {
      try {
        await axiosInstance.post(`/groups/${groupID}/notes/${itemIdToReplace}/toggle-pin`);
      } catch (error) {
        console.error('Error unpinning note:', error);
      }
    }

    // Step 2: Wait a bit for unpin to complete, then pin the new item
    setTimeout(async () => {
      if (pendingPinItem.type === 'message') {
        socket.emit('ghim_group_message', {
          messageID: pendingPinItem.id,
          groupID,
          senderID: userID,
        });
      } else if (pendingPinItem.type === 'note') {
        try {
          await axiosInstance.post(`/groups/${groupID}/notes/${pendingPinItem.id}/toggle-pin`);
          fetchPinnedNotes();
        } catch (error) {
          console.error('Error pinning note:', error);
        }
      }

      setShowPinLimitModal(false);
      setPendingPinItem(null);
      toast.success('Đã cập nhật danh sách ghim');
    }, 300);
  };

  const handleUnsend = (msg: Message) => {
    console.log('🎯 handleUnsend called:', {
      messageID: msg.messageID,
      senderID: msg.senderID,
      userID: userID,
      match: msg.senderID === userID,
    });

    if (!msg.messageID || msg.senderID !== userID) {
      console.log('❌ Cannot unsend: validation failed');
      toast.error('Bạn chỉ có thể thu hồi tin nhắn của mình');
      return;
    }

    // Tìm tất cả messages trong cùng group (nếu có)
    let messagesToUnsend: Message[] = [msg];
    if (msg.type === 'image' && msg.groupId) {
      messagesToUnsend = messages.filter((m) => m.groupId === msg.groupId && m.senderID === userID);
      console.log(`📸 Unsending ${messagesToUnsend.length} images from group ${msg.groupId}`);
    }

    console.log(
      '🔄 Unsending message(s):',
      messagesToUnsend.map((m) => m.messageID)
    );

    // Cập nhật UI ngay lập tức (optimistic update)
    setMessages((prev) =>
      prev.map((m) =>
        messagesToUnsend.some((unsend) => unsend.messageID === m.messageID)
          ? { ...m, type: 'notification', content: 'Tin nhắn đã bị thu hồi', media_url: [] }
          : m
      )
    );

    // Gửi socket event cho message đầu tiên
    socket.emit('unsend_group_message', {
      messageID: msg.messageID,
      groupID,
      senderID: userID,
    });

    console.log('📤 Emitted unsend_group_message event');
    setActionMsgId(null);
  };

  const handleDeleteLocal = (msg: Message) => {
    if (!msg.messageID || !userID) return;

    // Tìm tất cả messages trong cùng group (nếu có)
    let messagesToDelete: Message[] = [msg];
    if (msg.type === 'image' && msg.groupId) {
      messagesToDelete = messages.filter((m) => m.groupId === msg.groupId);
      console.log(`📸 Deleting ${messagesToDelete.length} images from group ${msg.groupId}`);
    }

    // Xóa tin nhắn khỏi UI ngay lập tức (optimistic update)
    setMessages((prev) =>
      prev.filter((m) => !messagesToDelete.some((del) => del.messageID === m.messageID))
    );
    setPinnedMessages((prev) =>
      prev.filter((m) => !messagesToDelete.some((del) => del.messageID === m.messageID))
    );

    // Gửi socket event để lưu vào database cho từng message
    messagesToDelete.forEach((message) => {
      socket.emit('delete_group_message_local', {
        messageID: message.messageID,
        userID: userID,
        groupID,
      });
    });

    setActionMsgId(null);
    toast.success('Đã xóa tin nhắn');
  };

  const handleCopy = (msg: Message) => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content);
      toast.success('Đã sao chép');
    }
    setActionMsgId(null);
  };

  const handleForwardMessage = (msg: Message) => {
    setForwardingMessage(msg);
    setActionMsgId(null);
  };

  const overlayRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement> | string) => {
    let value = '';
    let cursorPosition = 0;

    if (typeof e === 'string') {
      value = e;
      cursorPosition = value.length; // Điền từ Bot Suggestion thì trỏ cuối
    } else {
      value = e.target.value;
      cursorPosition = e.target.selectionStart || 0;
    }

    setInputText(value);

    // Nếu là lệnh từ phím tắt Bot Suggestion, đảm bảo con trỏ ở cuối sau khi focus
    if (typeof e === 'string' && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          const len = value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 0);
    }

    // Logic phát hiện Mention
    const textBeforeCursor = value.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const query = textBeforeCursor.substring(atIndex + 1);
      if (!query.includes(' ')) {
        setMentionSearch(query);
        setShowMentionDropdown(true);
        // Tính toán vị trí con trỏ cho dropdown
        if (inputRef.current) {
          const coords = getCaretCoordinates(inputRef.current);
          setDropdownCoords(coords);
        }
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }

    socket.emit('group_typing_start', {
      groupID,
      userID,
      userName: groupInfo?.members?.find((m) => m.userID === userID)?.name || 'User',
    });

    // Tự động cập nhật danh sách ID mention dựa trên text (Anti-Spam & Sync)
    const lowerValue = value.toLowerCase();
    const newMentions: string[] = [];

    // Kiểm tra Command trước (GIF/Sticker/Bot)
    const hasGif = lowerValue.includes('@gif');
    const hasSticker = lowerValue.includes('@sticker');
    const hasBot = lowerValue.includes('@bot');

    // Nếu có Command thì không nhận diện tag người
    if (hasGif) {
      newMentions.push('gif');
    } else if (hasSticker) {
      newMentions.push('sticker');
    } else if (hasBot) {
      newMentions.push('bot');
    } else {
      // Nếu không có Command thì mới nhận diện tag @All và tag tên người
      if (lowerValue.includes('@all')) newMentions.push('all');

      members.forEach((m) => {
        if (m.userID !== userID && lowerValue.includes(`@${m.name.toLowerCase()}`)) {
          if (!newMentions.includes(m.userID)) {
            newMentions.push(m.userID);
          }
        }
      });
    }

    setMentions(newMentions);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('group_typing_stop', { groupID, userID });
    }, 2000);
  };

  const renderHighlightedInputText = (text: string) => {
    if (!text) {
      return (
        <span className="text-gray-400 opacity-70">
          Nhập @, tin nhắn tới {groupInfo?.name || 'nhóm'}
        </span>
      );
    }

    // Xây dựng biểu thức chính quy (Regex) từ danh sách thành viên hiện tại
    const specialTags = ['All', 'GIF', 'STICKER', 'Bot'];

    // Sắp xếp tên theo độ dài giảm dần để ưu tiên khớp tên dài nhất trước (tránh lỗi khi tên là tập con của nhau)
    const sortedMemberNames = [...members]
      .map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);

    const allPatterns = [...specialTags, ...sortedMemberNames].join('|');

    // Regex tìm @ theo sau là các từ khóa (case-insensitive)
    const regex = new RegExp(`(@(?:${allPatterns}))`, 'gi');

    // Tách text theo regex (capturing group sẽ giữ lại các phần khớp trong mảng kết quả)
    const parts = text.split(regex);

    const elements = parts.map((part, index) => {
      if (!part) return null;

      // Kiểm tra xem phần này có phải là một tag hợp lệ không
      if (part.startsWith('@')) {
        const candidate = part.substring(1).toLowerCase();
        const isValid =
          specialTags.some((t) => t.toLowerCase() === candidate) ||
          members.some((m) => m.name.toLowerCase() === candidate);

        if (isValid) {
          return (
            <span key={index} className="text-[#0068ff] font-normal">
              {part}
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });

    // Ghost Placeholder: Nếu chỉ mới gõ @Bot hoặc @STICKER thì hiện gợi ý mờ phía sau
    const lowerText = text.toLowerCase().trim();
    if (lowerText === '@bot') {
      elements.push(
        <span key="ghost-bot" className="text-gray-400 opacity-60 italic ml-1 pointer-events-none">
          Bạn có yêu cầu gì...
        </span>
      );
    } else if (lowerText === '@sticker') {
      elements.push(
        <span
          key="ghost-sticker"
          className="text-gray-400 opacity-60 italic ml-1 pointer-events-none"
        >
          Gõ từ khóa để tìm kiếm Sticker
        </span>
      );
    } else if (lowerText === '@gif') {
      elements.push(
        <span key="ghost-gif" className="text-gray-400 opacity-60 italic ml-1 pointer-events-none">
          Gõ từ khóa để tìm kiếm GIF
        </span>
      );
    }

    return elements;
  };

  const handleMentionSelect = (item: any) => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = inputText.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    const textBeforeMention = inputText.substring(0, atIndex);
    const textAfterMention = inputText.substring(cursorPosition);

    let mentionText = '';
    if (item === 'all') {
      mentionText = '@All ';
    } else if (item === 'gif') {
      mentionText = '@GIF ';
    } else if (item === 'sticker') {
      mentionText = '@STICKER ';
    } else if (item === 'bot') {
      mentionText = '@Bot ';
    } else {
      // Trường hợp chọn một thành viên cụ thể
      const member = item as GroupMember;
      mentionText = `@${member.name} `;
      setMentions((prev) => {
        if (!prev.includes(member.userID)) {
          return [...prev, member.userID];
        }
        return prev;
      });
    }

    const newText = textBeforeMention + mentionText + textAfterMention;
    handleInputChange(newText);
    setShowMentionDropdown(false);

    // Đặt vị trí con trỏ sau khi tag (cần đợi một nhịp để state cập nhật)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = textBeforeMention.length + mentionText.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleDeleteMessage = (messageID: string) => {
    if (!window.confirm('Xóa tin nhắn này?')) return;

    socket.emit('delete_group_message', {
      messageID,
      userID,
      groupID,
      deleteForAll: true,
    });
    setActionMsgId(null);
  };

  const handleAddReaction = (messageID: string, emoji: string) => {
    socket.emit('add_reaction', {
      messageID,
      userID,
      emoji,
      groupID,
    });
  };

  const handlePromoteToAdmin = async (targetUserID: string) => {
    try {
      await axiosInstance.put(`/groups/${groupID}/members/${targetUserID}/role`, { role: 'admin' });
      toast.success('Đã thêm phó nhóm');
      setMemberMenuId(null);
      fetchGroupData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi thêm phó nhóm');
    }
  };

  const handleDemoteFromAdmin = async (targetUserID: string) => {
    try {
      await axiosInstance.put(`/groups/${groupID}/members/${targetUserID}/role`, {
        role: 'member',
      });
      toast.success('Đã gỡ quyền phó nhóm');
      setMemberMenuId(null);
      fetchGroupData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi gỡ quyền');
    }
  };

  const handleKickMember = async (targetUserID: string, memberName: string) => {
    if (!window.confirm(`Xóa ${memberName} khỏi nhóm?`)) return;

    try {
      await axiosInstance.delete(`/groups/${groupID}/members/${targetUserID}`);
      toast.success('Đã xóa thành viên khỏi nhóm');
      setMemberMenuId(null);
      fetchGroupData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi xóa thành viên');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        // Xác định loại file
        let uploadEndpoint = '/upload';
        let messageType: 'image' | 'video' | 'audio' | 'file' = 'file';

        if (file.type.startsWith('image/')) {
          messageType = 'image';
        } else if (file.type.startsWith('video/')) {
          messageType = 'video';
        } else if (file.type.startsWith('audio/')) {
          messageType = 'audio';
          uploadEndpoint = '/upload/audio';
        }

        const response = await axiosInstance.post(uploadEndpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Sử dụng dispatchGroupMessageContent để đảm bảo tin nhắn được xử lý đúng
        dispatchGroupMessageContent(
          {
            content: messageType === 'file' ? file.name : '',
            type: messageType,
            media_url: [response.data.url || response.data.urls?.[0]],
          },
          replyTo || undefined
        );

        // Clear reply sau khi gửi
        if (i === files.length - 1) {
          setReplyTo(null);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error('Không thể tải file lên');
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gray-100">
        <div className="flex-1 flex flex-col justify-center items-center gap-4 bg-linear-to-br from-blue-50 to-gray-50">
          <div className="w-20 h-20 bg-linear-to-br from-[#0068ff] to-[#0077c2] rounded-full flex items-center justify-center text-white text-4xl shadow-[0_4px_16px_rgba(14,157,232,0.35)] animate-pulse">
            <FaComments />
          </div>
          <p className="text-sm text-gray-400 m-0">Đang tải nhóm chat...</p>
        </div>
      </div>
    );
  }

  const groupAvatar =
    groupInfo?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupID}`;
  const typingUsersList = Array.from(typingUsers.values());

  // Kiểm tra quyền chỉnh sửa thông tin nhóm
  const currentMember = members.find((m) => m.userID === userID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  const canEditGroupInfo =
    isOwner || isAdmin || (groupInfo?.settings?.memberPermissions?.changeNameAvatar ?? true);

  // Kiểm tra quyền gửi tin nhắn
  const canSendMessages =
    isOwner || isAdmin || (groupInfo?.settings?.memberPermissions?.sendMessages ?? true);

  // Kiểm tra quyền tạo ghi chú và bình chọn
  const canCreateNotes =
    isOwner || isAdmin || (groupInfo?.settings?.memberPermissions?.createNotes ?? true);

  const canCreatePolls =
    isOwner || isAdmin || (groupInfo?.settings?.memberPermissions?.createPolls ?? true);

  console.log('🔐 Send message permission check:', {
    userID,
    role: currentMember?.role,
    isOwner,
    isAdmin,
    sendMessagesPermission: groupInfo?.settings?.memberPermissions?.sendMessages,
    canSendMessages,
  });

  const renderMessageContent = (content: string, messageMentions?: string[]) => {
    if (!content) return null;

    // Kiểm tra xem tin nhắn có các hình thức tag/lệnh đặc biệt không
    const lowerContent = content.toLowerCase();
    const hasSpecialCommands = ['@all', '@bot', '@gif', '@sticker'].some((cmd) =>
      lowerContent.includes(cmd)
    );
    const hasMentions = (messageMentions && messageMentions.length > 0) || hasSpecialCommands;

    if (!hasMentions) {
      return <span className="text-sm whitespace-pre-wrap break-words">{content}</span>;
    }

    // Sử dụng cùng logic Regex như ô nhập liệu để đảm bảo thống nhất
    const specialTags = ['All', 'GIF', 'STICKER', 'Bot'];
    const sortedMemberNames = [...members]
      .map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);
    const allPatterns = [...specialTags, ...sortedMemberNames].join('|');
    const regex = new RegExp(`(@(?:${allPatterns}))`, 'gi');

    const parts = content.split(regex);

    return (
      <span className="text-sm whitespace-pre-wrap break-words">
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            const candidate = part.substring(1).toLowerCase().trim();
            const isMentionAll = candidate === 'all';

            // Tìm thành viên trong danh sách có tên khớp HOẶC userID khớp
            const mentionMember = members.find(
              (m) =>
                m.name.toLowerCase().trim() === candidate ||
                m.userID === candidate ||
                (messageMentions &&
                  messageMentions.includes(m.userID) &&
                  m.name.toLowerCase().trim().includes(candidate))
            );

            const isValid =
              isMentionAll ||
              specialTags.some((t) => t.toLowerCase() === candidate) ||
              !!mentionMember;

            if (isValid) {
              return (
                <b
                  key={index}
                  className="text-[#0068ff] cursor-pointer hover:underline font-bold"
                  title={mentionMember ? `Xem hồ sơ của ${mentionMember.name}` : ''}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isMentionAll) {
                      // Không làm gì khi nhấn @All
                    } else if (
                      candidate === 'gif' ||
                      candidate === 'sticker' ||
                      candidate === 'bot'
                    ) {
                      // Không làm gì với lệnh hệ thống
                    } else if (mentionMember) {
                      handleShowUserProfile(mentionMember.userID);
                    }
                  }}
                >
                  {part}
                </b>
              );
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  const handleShowUserProfile = async (targetUserID: string) => {
    if (targetUserID === 'bot') {
      // Không mở hồ sơ cho AI Bot theo yêu cầu người dùng
      return;
    }

    try {
      // 1. Lấy thông tin cơ bản từ danh sách members hiện có
      const memberInfo = members.find((m) => m.userID === targetUserID);

      // 2. Fetch thông tin đầy đủ từ server
      const userRes = await axiosInstance.post('/usersID', { userID: targetUserID });
      const fullUserData = userRes.data;

      // 3. Fetch trạng thái bạn bè
      const statusRes = await axiosInstance.get(`/contacts/friend-status/${targetUserID}`);

      // 4. Hợp nhất dữ liệu
      const completeUser = {
        ...fullUserData,
        userID: targetUserID,
        name: fullUserData.name || memberInfo?.name || targetUserID,
        avatar: fullUserData.anhDaiDien || memberInfo?.avatar,
        anhDaiDien: fullUserData.anhDaiDien || memberInfo?.avatar,
        friendStatus: statusRes.data.friendStatus || 'none',
      };

      setSelectedUserForProfile(completeUser);
      setShowOtherProfile(true);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Không thể tải thông tin người dùng');
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-screen bg-gray-100"
      onClick={() => {
        setActionMsgId(null);
      }}
    >
      <div className="flex-1 flex w-full h-full overflow-hidden">
        <div className="flex-1 h-full bg-white flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-4 py-3 bg-white/85 backdrop-blur-xl border-b border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] flex-shrink-0 sticky top-0 z-30">
            <div
              className={`relative flex-shrink-0 mr-3 ${canEditGroupInfo ? 'cursor-pointer group' : ''}`}
              onClick={(e) => {
                if (canEditGroupInfo) {
                  e.stopPropagation();
                  setShowEditGroupInfoModal(true);
                }
              }}
              title={canEditGroupInfo ? 'Click để chỉnh sửa thông tin nhóm' : ''}
            >
              <img
                src={groupAvatar}
                alt="avatar"
                className="w-[42px] h-[42px] rounded-full object-cover border-2 border-[#0068ff]/10 transition-opacity group-hover:opacity-80"
              />
              {canEditGroupInfo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 rounded-full transition-all">
                  <FaImage className="text-white opacity-0 group-hover:opacity-100 text-sm transition-opacity" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2
                  className={`text-[15px] font-bold m-0 mb-0.5 text-gray-900 ${canEditGroupInfo ? 'cursor-pointer hover:text-[#0068ff] transition-colors' : ''}`}
                  onClick={(e) => {
                    if (canEditGroupInfo) {
                      e.stopPropagation();
                      setShowEditGroupInfoModal(true);
                    }
                  }}
                  title={canEditGroupInfo ? 'Click để chỉnh sửa tên nhóm' : ''}
                >
                  {groupInfo?.name || 'Nhóm Chat'}
                </h2>
              </div>
              <p className="text-xs text-gray-400 m-0 flex items-center gap-2">
                {groupInfo?.memberCount || 0} thành viên
                {!socketConnected && (
                  <span className="text-red-500 text-[10px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Mất kết nối
                  </span>
                )}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openNewCall();
                }}
                title="Gọi video"
                className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]"
              >
                <FaVideo />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSearchPanel((v) => !v);
                }}
                title="Tìm kiếm"
                className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${showSearchPanel ? 'bg-blue-50 text-[#0068ff]' : 'text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'}`}
              >
                <FaSearch />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMembersSidebar(!showMembersSidebar);
                  if (!showMembersSidebar) {
                    const currentRole = members.find((m) => m.userID === userID)?.role;
                    if (currentRole === 'owner' || currentRole === 'admin') {
                      fetchJoinRequests();
                    }
                  }
                }}
                title="Danh sách thành viên"
                className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors relative ${
                  showMembersSidebar
                    ? 'bg-blue-50 text-[#0068ff]'
                    : 'text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'
                }`}
              >
                <FaUserFriends />
                {(() => {
                  const currentRole = members.find((m) => m.userID === userID)?.role;
                  if (
                    (currentRole === 'owner' || currentRole === 'admin') &&
                    joinRequests.length > 0
                  ) {
                    return (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                        {joinRequests.length > 9 ? '9+' : joinRequests.length}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGroupInfoPanel(!showGroupInfoPanel);
                }}
                title="Thông tin nhóm"
                className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${
                  showGroupInfoPanel
                    ? 'bg-blue-50 text-[#0068ff]'
                    : 'text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'
                }`}
              >
                <FaInfoCircle />
              </button>
            </div>
          </div>

          {/* Pinned Messages & Notes Bar - New Implementation */}
          <PinnedMessagesPanel
            groupID={groupID}
            onClose={() => {}}
            onViewBoard={(tab) => {
              setBoardTab((tab as any) || 'all');
              setShowBoard(true);
            }}
            onScrollToMessage={(msgId) => {
              if (msgId) {
                setHighlightedMsgId(msgId);
                msgRefsMap.current.get(msgId)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
                setTimeout(() => setHighlightedMsgId(null), 2500);
              }
            }}
          />

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50"
          >
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            )}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 bg-linear-to-br from-[#0068ff] to-[#0077c2] rounded-full flex items-center justify-center text-white text-3xl shadow-[0_4px_16px_rgba(14,157,232,0.35)]">
                  <FaComments />
                </div>
                <p className="text-sm text-gray-400 m-0">Chưa có tin nhắn nào</p>
                <p className="text-xs text-gray-300 m-0">Hãy bắt đầu cuộc trò chuyện</p>
              </div>
            ) : (
              groupMessages(messages as any).map((item) => {
                // Kiểm tra xem item là message group hay message đơn
                if (isMessageGroup(item)) {
                  // Render image group
                  const group = item as MessageGroup;
                  const isMine = group.senderID === userID;
                  const firstMsg = group.messages[0];

                  return (
                    <div
                      key={group.groupId}
                      ref={(el) => {
                        if (el) {
                          // Set ref cho tất cả messages trong group
                          (group.messages as any).forEach((msg: Message) => {
                            if (msg.messageID) {
                              msgRefsMap.current.set(msg.messageID, el);
                            }
                          });
                        }
                      }}
                      className={`flex mb-3 ${isMine ? 'justify-end' : 'justify-start'} transition-all duration-300 ${
                        // Highlight nếu bất kỳ message nào trong group được highlight
                        (group.messages as any).some(
                          (msg: Message) => msg.messageID === highlightedMsgId
                        )
                          ? 'bg-blue-200/50 rounded-xl px-2 py-1 -mx-2 -my-1'
                          : ''
                      }`}
                    >
                      {!isMine && (
                        <div className="relative flex-shrink-0 mr-2">
                          <img
                            src={
                              firstMsg.senderInfo?.avatar ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.senderID}`
                            }
                            alt="avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        </div>
                      )}

                      <div
                        className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        {!isMine && (
                          <span className="text-xs text-gray-500 mb-1 font-semibold px-1 flex items-center">
                            {firstMsg.senderInfo?.name}
                            <RoleBadge role={getSenderRole(group.senderID)} />
                          </span>
                        )}

                        <div className="relative group">
                          <ImageGrid
                            messages={group.messages as any}
                            onImageClick={(url, allUrls) => {
                              const imageIndex = chatImages.findIndex((img) => img.url === url);
                              if (imageIndex !== -1) {
                                setImageViewerIndex(imageIndex);
                                setShowImageViewer(true);
                              }
                            }}
                          />

                          {/* Action buttons for image group */}
                          <div
                            className={`absolute ${
                              isMine ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'
                            } top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 px-2`}
                          >
                            <button
                              onClick={() => handleAddReaction(firstMsg.messageID || '', '👍')}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                              title="Thích"
                            >
                              <FaThumbsUp className="text-xs" />
                            </button>
                            <button
                              onClick={() => handleReply(firstMsg as any)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                              title="Trả lời"
                            >
                              <FaReply className="text-xs" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMsgId(
                                  actionMsgId === firstMsg.messageID
                                    ? null
                                    : firstMsg.messageID || null
                                );
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                              title="Thêm"
                            >
                              <FaEllipsisV className="text-xs" />
                            </button>
                          </div>

                          {/* Context Menu for Image Group */}
                          {actionMsgId === firstMsg.messageID && (
                            <div
                              className={`absolute z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] ${isMine ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleForwardMessage(firstMsg as unknown as Message)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <FaForward className="text-xs" />
                                Chuyển tiếp
                              </button>
                              <button
                                onClick={() => handlePin(firstMsg as unknown as Message)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <BsPin className="text-xs" />
                                {firstMsg.pinnedInfo ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                              </button>
                              {isMine && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleDeleteLocal(firstMsg as unknown as Message);
                                      setActionMsgId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 transition-colors"
                                  >
                                    <FaTrash className="text-xs" />
                                    Xóa phía tôi
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleUnsend(firstMsg as unknown as Message);
                                      setActionMsgId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <FaTrash className="text-xs" />
                                    Thu hồi
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <span className="text-[11px] text-gray-400 mt-1 px-1">
                          {formatTime(group.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Render message đơn
                const msg = item as unknown as Message;
                const isMine = msg.senderID === userID;
                const msgKey = msg.messageID || `temp-${Date.now()}`;

                return (
                  <div
                    key={msgKey}
                    ref={(el) => {
                      if (el && msg.messageID) {
                        msgRefsMap.current.set(msg.messageID, el);
                      }
                    }}
                    // highlight search group
                    className={`flex mb-3 ${isMine ? 'justify-end' : 'justify-start'} transition-all duration-300 ${
                      highlightedMsgId === msg.messageID
                        ? 'bg-yellow-200/70 rounded-xl px-2 py-1 -mx-2 -my-1'
                        : ''
                    }`}
                  >
                    {/* Notification — căn giữa, không có avatar/bubble */}
                    {msg.type === 'notification' ? (
                      <div className="w-full flex justify-center my-1">
                        <div className="max-w-[80%] text-center">
                          {(() => {
                            try {
                              if (msg.content?.startsWith('##FRIENDSHIP##')) {
                                const parts = msg.content.split('|');
                                const senderID = parts[1];
                                const receiverID = parts[2];
                                const senderName = parts[3];
                                const receiverName = parts[4];
                                const otherName = userID === senderID ? receiverName : senderName;
                                return (
                                  <span className="text-xs text-gray-500 italic bg-gray-100 rounded-full px-3 py-1 inline-block shadow-sm border border-gray-100">
                                    🤝 Bạn và <b>{otherName}</b> đã trở thành bạn bè
                                  </span>
                                );
                              }

                              // [NEW] Xử lý thông báo Bình chọn (Poll Notification)
                              if (
                                msg.content?.startsWith('##POLL_') ||
                                msg.content?.startsWith('POLL_NOTIF|')
                              ) {
                                let type = '',
                                  pollID = '',
                                  question = '',
                                  personName = '';

                                if (msg.content.startsWith('POLL_NOTIF|')) {
                                  // Format: POLL_NOTIF|ACTION|pollID|question|userName
                                  const parts = msg.content.split('|');
                                  const action = parts[1]; // CREATE, VOTE, LOCK, SHARE
                                  pollID = parts[2];
                                  question = parts[3];
                                  personName = parts[4] || '';
                                  if (action === 'CREATE') type = '##POLL_CREATED##';
                                  else if (action === 'VOTE' || action === 'JOIN')
                                    type = '##POLL_VOTED##';
                                  else if (action === 'LOCK') type = '##POLL_CLOSED##';
                                  else if (action === 'SHARE') type = '##POLL_SHARED##';
                                  else if (action === 'LEAVE') type = '##POLL_LEFT##';
                                  else if (action === 'CHANGE') type = '##POLL_CHANGED##';
                                  else type = '##POLL_CREATED##';
                                } else {
                                  // Format cũ: ##POLL_TYPE##|pollID|question|personName|voterAction
                                  const parts = msg.content.split('|');
                                  type = parts[0];
                                  pollID = parts[1];
                                  question = parts[2];
                                  personName = parts[3];
                                }

                                let text = '';
                                const isMe = msg.senderID === userID;
                                const displayName = isMe ? 'Bạn' : personName;

                                if (type === '##POLL_CREATED##') {
                                  text = `${displayName} đã tạo bình chọn: ${question}`;
                                } else if (type === '##POLL_VOTED##') {
                                  text = `${displayName} đã tham gia bình chọn: ${question}`;
                                } else if (type === '##POLL_CLOSED##') {
                                  text = `${displayName} đã khóa bình chọn: ${question}`;
                                } else if (type === '##POLL_SHARED##') {
                                  text = `${displayName} đã chia sẻ bình chọn: ${question}`;
                                } else if (type === '##POLL_LEFT##') {
                                  text = `${displayName} đã bỏ bình chọn: ${question}`;
                                } else if (type === '##POLL_CHANGED##') {
                                  text = `${displayName} đã đổi lựa chọn: ${question}`;
                                }

                                return (
                                  <div className="flex items-center gap-2 text-gray-500 italic bg-gray-50 rounded-full px-4 py-1.5 shadow-sm border border-[#c8e6c9] max-w-full">
                                    {/* Icon 3 cột sóng xanh lá giống ảnh */}
                                    <div className="flex items-end gap-[2px] h-3 mb-[1px] shrink-0">
                                      <div className="w-[3px] h-[6px] bg-[#2e7d32] rounded-t-sm"></div>
                                      <div className="w-[3px] h-[10px] bg-[#2e7d32] rounded-t-sm"></div>
                                      <div className="w-[3px] h-[8px] bg-[#2e7d32] rounded-t-sm"></div>
                                    </div>
                                    <span className="text-xs font-medium truncate shrink-1">
                                      {text}
                                    </span>
                                    <button
                                      className="text-blue-600 hover:text-blue-700 font-bold text-xs shrink-0 ml-1"
                                      onClick={() => {
                                        // Tìm tin nhắn chứa pollID này để cuộn tới
                                        const targetMsg = messages.find(
                                          (m) => m.pollID === pollID && m.type === 'poll'
                                        );
                                        if (targetMsg?.messageID) {
                                          setHighlightedMsgId(targetMsg.messageID);
                                          msgRefsMap.current
                                            .get(targetMsg.messageID)
                                            ?.scrollIntoView({
                                              behavior: 'smooth',
                                              block: 'center',
                                            });
                                          setTimeout(() => setHighlightedMsgId(null), 2500);
                                        } else {
                                          // Nếu không tìm thấy trong list hiện tại (có thể là tin nhắn cũ), mở modal Board
                                          setBoardTab('polls');
                                          setBoardInitialPollId(pollID);
                                          setShowBoard(true);
                                          toast('Đang mở chi tiết bình chọn...');
                                        }
                                      }}
                                    >
                                      Xem
                                    </button>
                                  </div>
                                );
                              }

                              const parsed = JSON.parse(msg.content || '');
                              if (parsed.type === 'join_request_notification') {
                                return (
                                  <span className="text-xs text-gray-500 italic bg-gray-100 rounded-full px-3 py-1 inline-block shadow-sm border border-gray-100">
                                    🔔 <b>{parsed.inviteeName}</b> được <b>{parsed.inviterName}</b>{' '}
                                    mời tham gia nhóm và cần bạn phê duyệt.{' '}
                                    <button
                                      className="text-blue-500 underline font-medium not-italic"
                                      onClick={() =>
                                        setPendingApprovalModal({
                                          requestID: parsed.requestID,
                                          inviteeName: parsed.inviteeName,
                                          inviterName: parsed.inviterName,
                                        })
                                      }
                                    >
                                      Chi tiết
                                    </button>
                                  </span>
                                );
                              }
                            } catch {
                              /* không phải JSON hoặc không phải friendship */
                            }
                            return (
                              <span className="text-xs text-gray-500 italic bg-gray-100 rounded-full px-3 py-1 inline-block shadow-sm border border-gray-100">
                                {msg.content}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ) : msg.type === 'group-call' ? (
                      /* Tin nhắn cuộc gọi nhóm */
                      <div className="w-full flex justify-center my-2">
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 max-w-[320px]">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                            <FaVideo className="text-white text-sm" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">Cuộc gọi nhóm</p>
                            <p className="text-xs text-gray-500">
                              {msg.senderInfo?.name} đã bắt đầu
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              // Kiểm tra call còn active không trước khi join
                              socket.emit('group-call-check', { groupID }, (active: boolean) => {
                                if (active) {
                                  joinCall();
                                } else {
                                  toast('Cuộc gọi đã kết thúc', {
                                    icon: '📵',
                                    style: { fontSize: '14px' },
                                    duration: 2500,
                                  });
                                }
                              });
                            }}
                            className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                          >
                            Tham gia
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!isMine && msg.type !== 'poll' && (
                          <div className="relative flex-shrink-0 mr-2">
                            <img
                              src={
                                msg.senderInfo?.avatar ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`
                              }
                              alt="avatar"
                              className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleShowUserProfile(msg.senderID)}
                            />
                          </div>
                        )}

                        <div
                          className={`flex flex-col ${msg.type === 'poll' ? 'w-full max-w-full items-center' : `max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}`}
                        >
                          {!isMine && msg.type !== 'poll' && (
                            <span
                              className="text-xs text-gray-500 mb-1 font-semibold px-1 flex items-center cursor-pointer hover:text-blue-500 transition-colors"
                              onClick={() => handleShowUserProfile(msg.senderID)}
                            >
                              {msg.senderInfo?.name}
                              <RoleBadge role={getSenderRole(msg.senderID)} />
                            </span>
                          )}

                          <div className="relative group">
                            <div
                              className={`${
                                msg.type === 'notification'
                                  ? 'bg-transparent'
                                  : msg.type === 'poll'
                                    ? '' // [UPDATE] Thẻ Poll tự lo phần UI/Background
                                    : msg.type === 'sticker' || msg.type === 'gif'
                                      ? ''
                                      : isMine
                                        ? 'bg-[#e3f2ff] text-gray-800 border border-[#d1e9ff]'
                                        : (() => {
                                            const senderRole = getSenderRole(msg.senderID);
                                            const isAdminMsg =
                                              groupInfo?.settings?.highlightAdminMessages &&
                                              (senderRole === 'owner' || senderRole === 'admin');
                                            if (isAdminMsg && senderRole === 'owner')
                                              return 'bg-yellow-50 text-gray-800 border border-yellow-300';
                                            if (isAdminMsg && senderRole === 'admin')
                                              return 'bg-blue-50 text-gray-800 border border-blue-300';
                                            return 'bg-white text-gray-800 border border-gray-100';
                                          })()
                              } ${
                                msg.type === 'image' ||
                                msg.type === 'video' ||
                                msg.type === 'sticker' ||
                                msg.type === 'gif' ||
                                msg.type === 'poll'
                                  ? 'p-0 rounded-2xl overflow-hidden'
                                  : msg.type === 'file'
                                    ? 'rounded-2xl'
                                    : 'px-4 py-2.5 rounded-2xl'
                              } ${msg.type !== 'notification' && msg.type !== 'sticker' && msg.type !== 'gif' && msg.type !== 'poll' ? 'shadow-sm' : ''} ${isMine && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'sticker' && msg.type !== 'gif' && msg.type !== 'poll' ? 'rounded-br-sm' : ''} ${!isMine && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'sticker' && msg.type !== 'gif' && msg.type !== 'poll' ? 'rounded-bl-sm' : ''}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {msg.replyTo && (
                                <div
                                  className={`text-xs mb-2 pb-2 border-b cursor-pointer hover:bg-gray-50/50 -mx-2 px-2 py-1 rounded transition-colors ${isMine ? 'border-blue-400/30' : 'border-gray-200'}`}
                                  onClick={() => {
                                    if (msg.replyTo?.messageID) {
                                      setHighlightedMsgId(msg.replyTo.messageID);
                                      msgRefsMap.current
                                        .get(msg.replyTo.messageID)
                                        ?.scrollIntoView({
                                          behavior: 'smooth',
                                          block: 'center',
                                        });
                                      setTimeout(() => setHighlightedMsgId(null), 2500);
                                    }
                                  }}
                                >
                                  <span
                                    className={`font-semibold ${isMine ? 'text-blue-600' : 'text-gray-700'}`}
                                  >
                                    Trả lời{' '}
                                    {msg.replyTo.senderID === userID
                                      ? 'chính mình'
                                      : msg.replyTo.senderName || 'tin nhắn'}
                                  </span>
                                  <div
                                    className={`mt-0.5 ${isMine ? 'text-gray-600' : 'text-gray-500'}`}
                                  >
                                    {msg.replyTo.type === 'text' || msg.replyTo.type === 'emoji' ? (
                                      <span className="line-clamp-1">{msg.replyTo.content}</span>
                                    ) : msg.replyTo.type === 'image' ? (
                                      <span className="flex items-center gap-1">
                                        <FaImage className="text-[10px]" /> Hình ảnh
                                      </span>
                                    ) : msg.replyTo.type === 'video' ? (
                                      <span className="flex items-center gap-1">
                                        <FaVideo className="text-[10px]" /> Video
                                      </span>
                                    ) : msg.replyTo.type === 'audio' ? (
                                      <span className="flex items-center gap-1">
                                        <FaMicrophone className="text-[10px]" /> Tin nhắn thoại
                                      </span>
                                    ) : msg.replyTo.type === 'file' ? (
                                      <span className="flex items-center gap-1">
                                        <FaPaperclip className="text-[10px]" />{' '}
                                        {msg.replyTo.content || 'File'}
                                      </span>
                                    ) : msg.replyTo.type === 'sticker' ? (
                                      <span>Sticker</span>
                                    ) : (
                                      <span>{msg.replyTo.content}</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {msg.type === 'image' && msg.media_url?.length ? (
                                <img
                                  src={msg.media_url[0]}
                                  alt="img"
                                  className="max-w-[400px] max-h-[400px] w-auto h-auto object-contain cursor-pointer rounded-lg hover:opacity-90 transition-opacity"
                                  onClick={() => {
                                    const imageIndex = chatImages.findIndex(
                                      (img) => img.url === msg.media_url[0]
                                    );
                                    if (imageIndex !== -1) {
                                      setImageViewerIndex(imageIndex);
                                      setShowImageViewer(true);
                                    }
                                  }}
                                />
                              ) : msg.type === 'sticker' && msg.media_url?.length ? (
                                <div className="p-0">
                                  <img
                                    src={msg.media_url[0]}
                                    alt="sticker"
                                    className="w-[150px] h-[150px] object-contain cursor-pointer"
                                    onClick={() => window.open(msg.media_url[0], '_blank')}
                                  />
                                </div>
                              ) : msg.type === 'gif' && msg.media_url?.length ? (
                                <img
                                  src={msg.media_url[0]}
                                  alt="gif"
                                  className="max-w-[300px] max-h-[300px] w-auto h-auto object-contain cursor-pointer rounded-lg"
                                  onClick={() => window.open(msg.media_url[0], '_blank')}
                                />
                              ) : msg.type === 'video' && msg.media_url?.length ? (
                                <video
                                  src={msg.media_url[0]}
                                  controls
                                  className="max-w-[280px] rounded-lg"
                                />
                              ) : msg.type === 'audio' && msg.media_url?.length ? (
                                <AudioPlayer src={msg.media_url[0]} isMine={isMine} />
                              ) : msg.type === 'file' && msg.media_url?.length ? (
                                <FileDisplay
                                  fileName={msg.content || 'file'}
                                  fileUrl={msg.media_url[0]}
                                  isMine={isMine}
                                />
                              ) : msg.type === 'poll' && msg.pollID ? (
                                <PollMessage
                                  pollID={msg.pollID}
                                  groupID={groupID}
                                  userID={userID}
                                  senderName={msg.senderInfo?.name || 'Người dùng'}
                                />
                              ) : (
                                renderMessageContent(msg.content || '', msg.mentions)
                              )}

                              {msg.reactions && msg.reactions.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {msg.reactions.map((reaction, rIdx) => (
                                    <span
                                      key={rIdx}
                                      className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs cursor-pointer hover:bg-white/30"
                                    >
                                      {reaction.emoji}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Action buttons */}
                              {msg.type !== 'notification' && (
                                <>
                                  <div
                                    className={`absolute ${
                                      isMine
                                        ? 'left-0 -translate-x-full'
                                        : 'right-0 translate-x-full'
                                    } top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 px-2`}
                                  >
                                    <button
                                      onClick={() => handleAddReaction(msg.messageID, '👍')}
                                      className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                                      title="Thích"
                                    >
                                      <FaThumbsUp className="text-xs" />
                                    </button>
                                    <button
                                      onClick={() => handleReply(msg)}
                                      className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                                      title="Trả lời"
                                    >
                                      <FaReply className="text-xs" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMsgId(
                                          actionMsgId === msg.messageID ? null : msg.messageID
                                        );
                                      }}
                                      className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                                      title="Thêm"
                                    >
                                      <FaEllipsisV className="text-xs" />
                                    </button>
                                  </div>

                                  {/* Context Menu */}
                                  {actionMsgId === msg.messageID && (
                                    <div
                                      className={`absolute z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] ${isMine ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {(msg.type === 'text' || msg.type === 'emoji') && (
                                        <button
                                          onClick={() => handleCopy(msg)}
                                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                          <FaCopy className="text-xs" />
                                          Sao chép
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleForwardMessage(msg)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                      >
                                        <FaForward className="text-xs" />
                                        Chuyển tiếp
                                      </button>
                                      <button
                                        onClick={() => handlePin(msg)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                      >
                                        <BsPin className="text-xs" />
                                        {msg.pinnedInfo ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                                      </button>
                                      {isMine && msg.type !== 'notification' && (
                                        <>
                                          <button
                                            onClick={() => handleDeleteLocal(msg)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 transition-colors"
                                          >
                                            <FaTrash className="text-xs" />
                                            Xóa phía tôi
                                          </button>
                                          <button
                                            onClick={() => handleUnsend(msg)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                          >
                                            <FaTrash className="text-xs" />
                                            Thu hồi
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <span className={`text-[11px] text-gray-400 mt-1 px-1`}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}

            {typingUsersList.length > 0 && (
              <div className="flex mb-3 justify-start">
                <div className="relative flex-shrink-0 mr-2">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold">
                    T
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-1 font-semibold px-1">
                    {typingUsersList.join(', ')} đang nhập...
                  </span>
                  <div className="bg-white px-4 py-2.5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                    <div
                      className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                    <div
                      className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Reply bar */}
          {replyTo && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-100">
              <FaReply className="text-[#0068ff]" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 m-0">Trả lời {replyTo.senderInfo?.name}</p>
                <p className="text-sm text-gray-700 m-0 truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-blue-100 text-gray-500"
              >
                <FaTimes />
              </button>
            </div>
          )}

          {/* File preview */}
          {files.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex-wrap">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700"
                >
                  {f.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <span className="text-[10px] truncate max-w-[80px]">{f.name}</span>
                  )}
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500 ml-1"
                  >
                    <FaTimes className="text-[10px]" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => sendFilesDirectly(files)}
                disabled={isUploading}
                className="ml-auto px-3 py-1.5 bg-[#0068ff] text-white text-xs rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="flex-shrink-0">
            {!canSendMessages ? (
              // Hiển thị thông báo khi không có quyền gửi tin nhắn
              <div className="flex items-center justify-center gap-2 px-4 py-4 bg-gray-50 border-t border-gray-200">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p className="text-sm text-gray-500 m-0 italic">
                  Chỉ trưởng nhóm và phó nhóm mới có thể gửi tin nhắn
                </p>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    if (files) setFiles(Array.from(files));
                  }}
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    if (files) {
                      const fileArray = Array.from(files);
                      setFiles(fileArray);
                      setTimeout(() => {
                        if (fileArray.length > 0) {
                          sendFilesDirectly(fileArray);
                        }
                      }, 100);
                    }
                  }}
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*"
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    if (files) sendFilesDirectly(Array.from(files));
                  }}
                  className="hidden"
                />

                {/* Toolbar icons */}
                <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-t border-gray-100 bg-white">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmoji((v) => !v);
                    }}
                    title="Emoji"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors ${showEmoji ? 'text-[#0068ff] bg-blue-50' : 'text-gray-500 hover:text-[#0068ff] hover:bg-gray-100'}`}
                  >
                    <FaSmile />
                  </button>
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    title="Gửi ảnh"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0068ff] hover:bg-gray-100 transition-colors"
                  >
                    <FaImage />
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Gửi file"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0068ff] hover:bg-gray-100 transition-colors"
                  >
                    <FaPaperclip />
                  </button>

                  {!isRecording && !audioBlob && (
                    <button
                      onClick={startRecording}
                      title="Ghi âm"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0068ff] hover:bg-gray-100 transition-colors"
                    >
                      <FaMicrophone />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toast('Tính năng nhắc hẹn đang phát triển');
                    }}
                    title="Nhắc hẹn"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors text-gray-500 hover:text-[#0068ff] hover:bg-gray-100"
                  >
                    <FaBell />
                  </button>
                </div>
              </>
            )}

            {/* Emoji picker modal */}
            {showEmoji && canSendMessages && (
              <StickerEmojiPicker
                onEmojiClick={sendEmoji}
                onStickerClick={sendSticker}
                onGifClick={sendGif}
                onClose={() => setShowEmoji(false)}
              />
            )}

            {/* Recording bar — waveform animation */}
            {isRecording && canSendMessages && (
              <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border-t border-red-100">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                {/* Waveform bars */}
                <div className="flex items-center gap-[3px] h-6">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-red-500"
                      style={{
                        height: `${Math.random() * 60 + 20}%`,
                        animation: `waveBar 0.${4 + i}s ease-in-out infinite alternate`,
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm text-red-600 font-medium flex-1">
                  {formatRecordTime(recordingTime)}
                </span>
                <button
                  onClick={cancelRecording}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Hủy"
                >
                  <FaTimes className="text-sm" />
                </button>
                <button
                  onClick={stopRecording}
                  className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
                >
                  <FaStop className="text-[10px]" /> Dừng
                </button>
              </div>
            )}

            {/* Audio preview */}
            {audioBlob && !isRecording && canSendMessages && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border-t border-blue-100">
                <audio src={URL.createObjectURL(audioBlob)} controls className="h-8 flex-1" />
                <button
                  onClick={cancelRecording}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Hủy"
                >
                  <FaTimes className="text-sm" />
                </button>
                <button
                  onClick={sendAudio}
                  disabled={isUploading}
                  className="px-3 py-1 bg-[#0068ff] text-white text-xs rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            )}

            {/* Thành phần Dropdown gợi ý Mention */}
            <MentionDropdown
              ref={mentionDropdownRef}
              isOpen={showMentionDropdown && canSendMessages}
              members={members.filter((m) => m.userID !== userID)}
              query={mentionSearch}
              onSelect={handleMentionSelect}
              onClose={() => setShowMentionDropdown(false)}
              coords={dropdownCoords}
              existingMentionIDs={mentions}
            />

            {/* Ô nhập văn bản với lớp phủ Highlight và Suggestions */}
            {canSendMessages && (
              <div className="flex flex-col bg-white">
                {/* Thanh Suggestion cho @Bot */}
                {inputText.toLowerCase().includes('@bot') && (
                  <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden w-full text-sm">
                    {[
                      'Tóm tắt nhóm chat',
                      'Lên lịch họp',
                      'Dịch tin nhắn gần nhất',
                      'Tạo bình chọn',
                    ].map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const hasSpace = inputText.endsWith(' ');
                          handleInputChange(inputText + (hasSpace ? sug : ' ' + sug) + ' ');
                          inputRef.current?.focus();
                        }}
                        className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors shrink-0 font-medium border border-indigo-100/50 flex items-center gap-1.5"
                      >
                        <span className="text-[10px] opacity-70">✦</span> {sug}
                      </button>
                    ))}
                  </div>
                )}

                {/* Thanh Suggestion cho @STICKER (Yêu cầu mới) */}
                {inputText.toLowerCase().startsWith('@sticker') && (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden w-full bg-white/50 backdrop-blur-sm">
                    {(() => {
                      const query = inputText.substring(8).trim().toLowerCase();
                      const filtered = query
                        ? STICKER_DATA.filter(
                            (s) => s.name.includes(query) || s.tags.some((t) => t.includes(query))
                          )
                        : STICKER_DATA;

                      if (filtered.length === 0) {
                        return (
                          <span className="text-xs text-gray-500 mx-auto italic py-1">
                            Vui lòng thử lại với từ khóa khác
                          </span>
                        );
                      }

                      return filtered.map((sticker, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            sendSticker(sticker.url);
                            handleInputChange(''); // Clear input sau khi gửi
                          }}
                          className="w-[60px] h-[60px] shrink-0 bg-gray-50 rounded-xl p-1.5 hover:bg-blue-50 hover:scale-110 transition-all border border-gray-100/50 shadow-sm"
                          title={sticker.name}
                        >
                          <img
                            src={sticker.url}
                            alt={sticker.name}
                            className="w-full h-full object-contain"
                          />
                        </button>
                      ));
                    })()}
                  </div>
                )}

                {/* Thanh Suggestion cho @GIF (Mới) */}
                {inputText.toLowerCase().startsWith('@gif') && (
                  <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden w-full bg-white/50 backdrop-blur-sm h-[90px]">
                    {isLoadingGifs ? (
                      <div className="flex items-center gap-2 text-gray-400 italic text-xs py-2 mx-auto">
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                        Đang tìm GIF...
                      </div>
                    ) : suggestedGifs.length === 0 ? (
                      <span className="text-xs text-gray-500 mx-auto italic py-1">
                        Không tìm thấy GIF phù hợp
                      </span>
                    ) : (
                      suggestedGifs.map((gif, i) => (
                        <button
                          key={gif.id}
                          onClick={() => {
                            sendGif(gif.images.original.url);
                            handleInputChange('');
                          }}
                          className="w-[100px] h-[70px] shrink-0 bg-gray-50 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-400 hover:scale-105 transition-all shadow-sm"
                        >
                          <img
                            src={gif.images.fixed_height.url}
                            alt="gif"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 px-4 py-2 bg-white">
                  <div className="flex-1 relative group h-[40px] bg-gray-100 rounded-full overflow-hidden">
                    {/* Lớp phủ Highlight (Phản chiếu nội dung của ô nhập) */}
                    <div
                      ref={overlayRef}
                      className="absolute inset-0 px-4 py-2 text-sm font-sans pointer-events-none whitespace-pre overflow-hidden text-gray-900 z-10 box-border leading-[24px]"
                      aria-hidden="true"
                      style={{
                        letterSpacing: 'normal',
                        fontFamily:
                          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        margin: 0,
                        border: 'none',
                      }}
                    >
                      {renderHighlightedInputText(inputText)}
                    </div>

                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={handleInputChange}
                      onScroll={() => {
                        if (inputRef.current && overlayRef.current) {
                          overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          // Nếu dropdown đang mở, ưu tiên xử lý phím Enter tại đó
                          if (showMentionDropdown && mentionDropdownRef.current) {
                            const handled = mentionDropdownRef.current.handleKeyDown(e);
                            if (handled) return;
                          }

                          e.preventDefault();
                          handleSendMessage();
                        } else if (showMentionDropdown && mentionDropdownRef.current) {
                          // Các phím điều hướng khác (Up, Down, Escape)
                          mentionDropdownRef.current.handleKeyDown(e);
                        }
                      }}
                      placeholder={
                        inputText.toLowerCase().startsWith('@gif')
                          ? 'Gõ từ khóa để tìm kiếm GIF'
                          : inputText.toLowerCase().startsWith('@sticker')
                            ? 'Gõ từ khóa để tìm kiếm Sticker'
                            : inputText.toLowerCase().includes('@bot')
                              ? 'Bạn có yêu cầu gì'
                              : `Nhập @, tin nhắn tới ${groupInfo?.name || 'nhóm'}`
                      }
                      className="absolute inset-0 w-full h-full px-4 py-2 bg-transparent text-transparent caret-gray-900 text-sm font-sans focus:outline-none z-20 box-border leading-[24px]"
                      style={{
                        letterSpacing: 'normal',
                        fontFamily:
                          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                        margin: 0,
                        border: 'none',
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isUploading}
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
                      inputText.toLowerCase().includes('@bot')
                        ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm'
                        : 'bg-[#0068ff] text-white hover:bg-[#0077c2]'
                    }`}
                    title="Gửi"
                  >
                    <FaPaperPlane className="text-sm" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Group Info Panel */}
        {showGroupInfoPanel && groupInfo && (
          <GroupInfoPanel
            groupInfo={groupInfo}
            currentUserID={userID}
            messages={messages}
            onClose={() => setShowGroupInfoPanel(false)}
            onAddMembers={() => {
              setShowAddMembersModal(true);
              setShowGroupInfoPanel(false);
            }}
            onManageGroup={() => {
              setShowManagementModal(true);
              setShowGroupInfoPanel(false);
            }}
            onViewMessage={(messageID: string) => {
              setHighlightedMsgId(messageID);
              msgRefsMap.current.get(messageID)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
              setTimeout(() => setHighlightedMsgId(null), 2500);
              setShowGroupInfoPanel(false);
            }}
            onPinLimitReached={(noteID: string) => {
              // Find the note to pin
              setPendingPinItem({ type: 'note', id: noteID, data: null });
              setShowPinLimitModal(true);
            }}
            onLeaveGroup={async () => {
              try {
                await axiosInstance.post(`/groups/${groupID}/leave`);
                toast.success('Đã rời khỏi nhóm');
                window.location.href = '/home';
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Lỗi khi rời nhóm');
              }
            }}
            onDeleteGroup={async () => {
              try {
                await axiosInstance.delete(`/groups/${groupID}`);
                toast.success('Đã giải tán nhóm');
                window.location.href = '/home';
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Lỗi khi giải tán nhóm');
              }
            }}
            onGroupInfoUpdated={(data) => {
              setGroupInfo((prev) =>
                prev
                  ? {
                      ...prev,
                      name: data.name ?? prev.name,
                      avatar: data.avatar ?? prev.avatar,
                    }
                  : prev
              );
            }}
          />
        )}

        {/* Members Sidebar */}
        {showMembersSidebar && (
          <div
            className="w-[280px] bg-white border-l border-gray-200 flex flex-col overflow-hidden"
            onClick={() => setMemberMenuId(null)}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 m-0">Thành viên ({members.length})</h3>
              <button
                onClick={() => setShowMembersSidebar(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
              >
                <FaTimes />
              </button>
            </div>

            <div className="px-3 pt-3 pb-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddMembersModal(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium text-sm"
              >
                <FaUserFriends className="text-base" />
                Thêm thành viên
              </button>
            </div>

            {joinRequests.length > 0 &&
              (() => {
                const currentRole = members.find((m) => m.userID === userID)?.role;
                if (currentRole !== 'owner' && currentRole !== 'admin') return null;
                return (
                  <div className="px-3 pb-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      Yêu cầu tham gia nhóm ({joinRequests.length})
                    </p>
                    <div className="space-y-2">
                      {joinRequests.map((req) => (
                        <div
                          key={req.requestID}
                          className="bg-gray-50 rounded-xl p-3 border border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <img
                              src={
                                req.avatar ||
                                `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.userID}`
                              }
                              alt={req.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 m-0 truncate">
                                {req.name}
                              </p>
                              <p className="text-xs text-gray-500 m-0">
                                được thêm bởi {req.requestedByName}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await axiosInstance.post(
                                    `/groups/${groupID}/join-requests/${req.requestID}/reject`
                                  );
                                  setJoinRequests((prev) =>
                                    prev.filter((r) => r.requestID !== req.requestID)
                                  );
                                  toast.success(`Đã từ chối ${req.name}`);
                                } catch {
                                  toast.error('Lỗi khi từ chối');
                                }
                              }}
                              className="flex-1 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm text-gray-700 font-medium transition-colors"
                            >
                              Từ chối
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await axiosInstance.post(
                                    `/groups/${groupID}/join-requests/${req.requestID}/approve`
                                  );
                                  setJoinRequests((prev) =>
                                    prev.filter((r) => r.requestID !== req.requestID)
                                  );
                                  fetchGroupData();
                                  toast.success(`Đã đồng ý cho ${req.name} vào nhóm`);
                                } catch {
                                  toast.error('Lỗi khi phê duyệt');
                                }
                              }}
                              className="flex-1 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm text-white font-semibold transition-colors"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Danh sách thành viên ({members.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {members.map((member) => {
                const currentUserMember = members.find((m) => m.userID === userID);
                const currentUserRole = currentUserMember?.role;
                const canManage =
                  currentUserRole === 'owner' ||
                  (currentUserRole === 'admin' && member.role === 'member');

                return (
                  <div
                    key={member.userID}
                    className="relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group cursor-pointer"
                    onClick={() => handleShowUserProfile(member.userID)}
                  >
                    <img
                      src={
                        member.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userID}`
                      }
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 m-0 truncate">
                        {member.name}
                      </p>
                      <p
                        className={`text-xs m-0 ${
                          member.role === 'owner'
                            ? 'text-red-500 font-semibold'
                            : member.role === 'admin'
                              ? 'text-orange-500 font-semibold'
                              : 'text-gray-500'
                        }`}
                      >
                        {member.role === 'owner'
                          ? 'Trưởng nhóm'
                          : member.role === 'admin'
                            ? 'Phó nhóm'
                            : 'Thành viên'}
                      </p>
                    </div>

                    {canManage && member.userID !== userID && member.role !== 'owner' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMemberMenuId(memberMenuId === member.userID ? null : member.userID);
                        }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 transition-opacity"
                      >
                        <FaEllipsisV className="text-xs" />
                      </button>
                    )}

                    {memberMenuId === member.userID && (
                      <div
                        className="absolute right-2 top-full mt-1 z-30 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[180px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {currentUserRole === 'owner' && (
                          <>
                            {member.role === 'member' && (
                              <button
                                onClick={() => handlePromoteToAdmin(member.userID)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                              >
                                <FaUserFriends className="text-xs text-blue-500" />
                                Thêm phó nhóm
                              </button>
                            )}
                            {member.role === 'admin' && (
                              <button
                                onClick={() => handleDemoteFromAdmin(member.userID)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors"
                              >
                                <FaUserFriends className="text-xs text-orange-500" />
                                Gỡ quyền phó nhóm
                              </button>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => handleKickMember(member.userID, member.name)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <FaTrash className="text-xs" />
                          Xóa khỏi nhóm
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Panel — inline sidebar */}
        {showSearchPanel && (
          <GroupSearchModal
            groupID={groupID}
            members={members.map((m) => ({ userID: m.userID, name: m.name, avatar: m.avatar }))}
            onClose={() => setShowSearchPanel(false)}
            onScrollToMessage={(msgId) => {
              setHighlightedMsgId(msgId);
              msgRefsMap.current
                .get(msgId)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => setHighlightedMsgId(null), 2500);
            }}
          />
        )}
      </div>

      {/* Modals outside flex row */}
      {forwardingMessage && (
        <ForwardMessageModal
          message={{ ...forwardingMessage, chatID: forwardingMessage.groupID } as any}
          onClose={() => setForwardingMessage(null)}
          user={{ userID, name: members.find((m) => m.userID === userID)?.name || 'User' }}
        />
      )}

      {showImageViewer && (
        <ImageViewerModal
          images={chatImages}
          initialIndex={imageViewerIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {showAddMembersModal && (
        <AddMembersModal
          groupID={groupID}
          currentUserID={userID}
          onClose={() => setShowAddMembersModal(false)}
          onSuccess={() => {
            fetchGroupData();
            toast.success('Đã thêm thành viên vào nhóm');
          }}
          onBlockedNotification={(content) => {
            const localMsg: Message = {
              messageID: `local_${Date.now()}`,
              groupID,
              senderID: userID,
              content,
              type: 'notification',
              media_url: [],
              timestamp: new Date(),
              status: 'sent',
              senderInfo: { name: '' },
            };
            setMessages((prev) => [...prev, localMsg]);
          }}
        />
      )}

      {showManagementModal && groupInfo && (
        <GroupManagementModal
          groupInfo={groupInfo}
          currentUserID={userID}
          onClose={() => setShowManagementModal(false)}
          onUpdate={() => refreshGroupInfo()}
          onDeleteGroup={async () => {
            try {
              await axiosInstance.delete(`/groups/${groupID}`);
              toast.success('Đã giải tán nhóm');
              window.location.href = '/home';
            } catch (error: any) {
              toast.error(error.response?.data?.message || 'Lỗi khi giải tán nhóm');
            }
          }}
        />
      )}

      {showEditGroupInfoModal && groupInfo && (
        <EditGroupInfoModal
          groupID={groupInfo.groupID}
          currentName={groupInfo.name}
          currentAvatar={groupInfo.avatar}
          onClose={() => setShowEditGroupInfoModal(false)}
          onSuccess={(data) => {
            setShowEditGroupInfoModal(false);
            setGroupInfo((prev) =>
              prev ? { ...prev, name: data.name, avatar: data.avatar ?? prev.avatar } : prev
            );
          }}
        />
      )}

      {/* Pin Limit Modal */}
      <PinLimitModal
        show={showPinLimitModal}
        onClose={() => setShowPinLimitModal(false)}
        pinnedItems={[
          ...pinnedMessages.map((m) => ({
            id: m.messageID,
            type: 'message' as const,
            content: m.content || '[Media]',
            senderName: m.senderInfo?.name,
            timestamp: m.timestamp.toString(),
          })),
          ...pinnedNotes.map((n) => ({
            id: n.noteID,
            type: 'note' as const,
            content: n.content,
            creatorName: n.creatorInfo?.name,
            timestamp: n.createdAt,
          })),
        ]}
        onReplace={handleReplacePinnedItem}
      />

      {pendingApprovalModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setPendingApprovalModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Yêu cầu tham gia nhóm</h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-700">
                <b>{pendingApprovalModal.inviteeName}</b> được{' '}
                <b>{pendingApprovalModal.inviterName}</b> mời tham gia nhóm.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Bạn có muốn đồng ý cho họ vào nhóm không?
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button
                onClick={async () => {
                  try {
                    await axiosInstance.post(
                      `/groups/${groupID}/join-requests/${pendingApprovalModal.requestID}/reject`
                    );
                    setJoinRequests((prev) =>
                      prev.filter((r) => r.requestID !== pendingApprovalModal.requestID)
                    );
                    toast.success(`Đã từ chối ${pendingApprovalModal.inviteeName}`);
                    setPendingApprovalModal(null);
                  } catch {
                    toast.error('Lỗi khi từ chối');
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 font-medium transition-colors"
              >
                Từ chối
              </button>
              <button
                onClick={async () => {
                  try {
                    await axiosInstance.post(
                      `/groups/${groupID}/join-requests/${pendingApprovalModal.requestID}/approve`
                    );
                    setJoinRequests((prev) =>
                      prev.filter((r) => r.requestID !== pendingApprovalModal.requestID)
                    );
                    fetchGroupData();
                    toast.success(`Đã đồng ý cho ${pendingApprovalModal.inviteeName} vào nhóm`);
                    setPendingApprovalModal(null);
                  } catch {
                    toast.error('Lỗi khi phê duyệt');
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm text-white font-semibold transition-colors"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {showOtherProfile && selectedUserForProfile && (
        <OtherProfileModal
          user={selectedUserForProfile}
          currentUser={members.find((m) => m.userID === userID)}
          onClose={() => setShowOtherProfile(false)}
          onStartChat={handleStartChat1_1}
          onAddFriend={handleAddFriendFromProfile}
          onAccept={handleAcceptFriendFromProfile}
          onReject={handleRejectFriendFromProfile}
          onRecall={handleRecallFriendFromProfile}
          onStatusChange={(status) => {
            setSelectedUserForProfile((prev: any) =>
              prev ? { ...prev, friendStatus: status } : prev
            );
          }}
        />
      )}

      {showUserProfile && (
        <UserProfileModal
          user={members.find((m) => m.userID === userID) as any}
          onClose={() => setShowUserProfile(false)}
          setUser={() => {}}
        />
      )}

      {/* Incoming Group Call Modal — handled globally in HomePage */}

      {/* Group Call Modal — floating window */}
      {(showGroupCall || joinExistingCall) && (
        <GroupCallModal
          user={{ userID, name: getMyInfo().name, anhDaiDien: getMyInfo().anhDaiDien }}
          groupID={groupID}
          groupName={groupInfo?.name || 'Nhóm'}
          groupAvatar={groupInfo?.avatar}
          members={members
            .filter((m) => m.userID !== userID)
            .map((m) => ({ userID: m.userID, name: m.name, avatar: m.avatar }))}
          isCallee={groupCallIsCallee}
          initialWithVideo={groupCallWithVideo}
          initialParticipants={groupCallInitialParticipants}
          onClose={() => {
            setShowGroupCall(false);
            setJoinExistingCall(false);
            setGroupCallIsCallee(false);
          }}
        />
      )}

      {showBoard && (
        <GroupBoardModal
          show={showBoard}
          onClose={() => setShowBoard(false)}
          groupID={groupID}
          userID={userID}
          initialTab={boardTab}
          initialPollId={boardInitialPollId}
          canCreateNotes={canCreateNotes}
          canCreatePolls={canCreatePolls}
          members={
            groupInfo?.members?.map((m) => ({
              userID: m.userID,
              name: m.name,
              avatar: m.avatar,
            })) || []
          }
        />
      )}
    </div>
  );
};

export default GroupChatWindow;
