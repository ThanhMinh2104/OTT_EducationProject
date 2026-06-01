import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import axiosInstance from '../utils/axios';
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
  FaImage,
  FaVideo,
  FaMicrophone,
  FaStop,
  FaBell,
  FaPhone,
  FaPlay,
  FaPause,
  FaUserFriends,
  FaBan,
} from 'react-icons/fa';
import { BsPin, BsPinAngleFill } from 'react-icons/bs';
import { EmojiClickData } from 'emoji-picker-react';
import socket from '../utils/socket';
import { getToken } from '../utils/auth';
import ReminderModal from './ReminderModal';
import ConfirmModal from './ConfirmModal';
import ChatInfoPanel from './ChatInfoPanel';
import StickerEmojiPicker from './StickerEmojiPicker';
import ForwardMessageModal from './ForwardMessageModal';
import ImageViewerModal from './ImageViewerModal';
import OtherProfileModal from './OtherProfileModal';
import ImageGrid from './ImageGrid'; // ⭐ Import ImageGrid
import FilePreviewModal from './FilePreviewModal';
import { groupMessages, isMessageGroup } from '../utils/messageGrouping'; // ⭐ Import grouping utilities
import {
  loadReminderEvents,
  type ReminderEvent,
} from '../hooks/useReminderChecker';
import MentionDropdown, { MentionDropdownHandle } from './MentionDropdown';
import { getCaretCoordinates } from '../utils/caretPosition';

// Không cần tạo socket mới nữa, đã import từ utils/socket.ts
const API = 'http://localhost:5000/api';

// Giphy API key cho gợi ý @GIF
const GIPHY_API_KEY = 'iw8DsJkjCByct4EHovySloueKpn6ljwK';

// Dữ liệu Sticker mẫu để tìm kiếm 
const STICKER_DATA = [
  { url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002734/android/sticker.png', name: 'cute dog', tags: ['cho', 'dog', 'hi', 'hello'] },
  { url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002735/android/sticker.png', name: 'happy cat', tags: ['meo', 'cat', 'vui', 'cuoi', 'haha'] },
  { url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002736/android/sticker.png', name: 'sad bear', tags: ['gau', 'bear', 'buon', 'khoc', 'hic'] },
  { url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002737/android/sticker.png', name: 'angry duck', tags: ['vit', 'duck', 'gian', 'cau', 'thoi'] },
  { url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002738/android/sticker.png', name: 'cool monkey', tags: ['khi', 'monkey', 'ngau', 'kinh', 'chat'] },
  { url: 'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002739/android/sticker.png', name: 'shy bunny', tags: ['tho', 'bunny', 'ngai', 'xau ho', 'ahihi'] },
];

interface Member {
  userID: string;
  role: string;
}
interface ReplyTo {
  messageID?: string;
  senderID?: string;
  content?: string;
  type?: string;
  media_url?: string[];
}
interface Message {
  messageID?: string;
  tempID?: string;
  _id?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
  status?: string;
  senderInfo?: { name: string; avatar?: string | null };
  pinnedInfo?: { pinnedBy?: string; pinnedAt?: string } | null;
  replyTo?: ReplyTo | null;
  groupId?: string; // ⭐ ID để group các ảnh gửi cùng lúc
  mentions?: string[]; // Danh sách userID được nhắc tên
}
interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: Member[];
  lastMessage: Message[];
}
interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
  sdt?: string;
  trangThai?: string;
  friendStatus?: string;
}
interface Props {
  selectedChat: Chat | null;
  user: User | null;
  onStartVideoCall?: (callType: 'voice' | 'video') => void;
}

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatTime = (ts: string) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

  // Dog-ear document shape via SVG
  return (
    <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
      <path d="M4 0h26l10 10v38a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" fill={config.bg} />
      <path d="M30 0l10 10H34a4 4 0 01-4-4V0z" fill="rgba(0,0,0,0.2)" />
      <text x="22" y="34" textAnchor="middle" fill="white" fontSize={config.label.length > 2 ? "11" : "16"} fontWeight="bold" fontFamily="Arial, sans-serif">
        {config.label}
      </text>
    </svg>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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

  // Fetch file size
  useEffect(() => {
    fetch(fileUrl, { method: 'HEAD' })
      .then((res) => {
        const size = res.headers.get('content-length');
        if (size) setFileSize(parseInt(size));
      })
      .catch(() => { });
  }, [fileUrl]);

  const handleDownload = async () => {
    try {
      // Fetch file as blob
      const response = await fetch(fileUrl);
      const blob = await response.blob();

      // Create download link with correct filename
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName; // Sử dụng tên file gốc
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: open in new tab
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
          <p className={`font-semibold text-[14px] truncate mb-0.5 ${isMine ? 'text-gray-900' : 'text-gray-900'}`}>{fileName}</p>
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
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

// ==================== TV3: Audio Player Component ====================
const AudioPlayer = ({ src, isMine }: { src: string; isMine: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

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
          setCurrent(audioRef.current.currentTime);
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
          setCurrent(0);
        }}
      />

      {/* Play/Pause Button */}
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#0068ff] text-gray-900 hover:bg-[#0077c2] transition-colors shadow-md"
      >
        {playing ? <FaPause className="text-sm" /> : <FaPlay className="text-sm ml-0.5" />}
      </button>

      {/* Waveform Bars */}
      <div className="flex items-center gap-[3px] h-8 flex-1">
        {[20, 35, 50, 40, 55, 30, 45, 38, 52, 28, 42, 35].map((height, i) => (
          <div
            key={i}
            className={`w-[3px] rounded-full transition-all ${isMine ? 'bg-blue-400/70' : 'bg-[#0068ff]'
              }`}
            style={{
              height: `${progress > (i / 12) * 100 ? height : height * 0.4}%`,
              opacity: progress > (i / 12) * 100 ? 1 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Duration */}
      <span className={`text-xs font-medium shrink-0 ${isMine ? 'text-gray-600' : 'text-gray-700'}`}>
        {fmt(duration)}
      </span>

      {/* Cloud Download Icon */}
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
          <path d="M6.5 9.5a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1z" />
        </svg>
      </a>
    </div>
  );
};
// ==================== Hàm chuẩn hóa URL hình ảnh ====================
// Loại bỏ giao thức, host, query parameters và decode các ký tự đặc biệt để so sánh URL chính xác hơn
const cleanUrl = (u: string): string => {
  if (!u) return '';
  try {
    let decoded = decodeURIComponent(u).trim();
    decoded = decoded.split('?')[0]; // Bỏ query parameters
    decoded = decoded.replace(/^(https?:)?\/\/[^/]+/, ''); // Bỏ protocol và host (ví dụ: http://localhost:5000)
    return decoded;
  } catch (e) {
    return u.trim();
  }
};

// Fix Cloudinary URL để browser/React Native hiển thị được:
// - /raw/upload/ → /image/upload/ (ảnh bị upload sai resource_type)
// - f_auto: convert HEIC/HEIF/AVIF → JPEG/WebP tùy client
// - q_auto: tối ưu chất lượng tự động
// - w_1200,c_limit: giới hạn width 1200px để giảm file size, tăng tốc load
const fixImageUrl = (url: string): string => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  let fixed = url.includes('/raw/upload/')
    ? url.replace('/raw/upload/', '/image/upload/')
    : url;
  if (!fixed.includes('/f_auto')) {
    fixed = fixed.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit/');
  }
  return fixed;
};

const ChatWindow = ({ selectedChat, user, onStartVideoCall }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [memberInfo, setMemberInfo] = useState<User | null>(null);
  const [isStranger, setIsStranger] = useState(false);
  const [isSendingFriendRequest, setIsSendingFriendRequest] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<
    {
      type: string;
      content?: string;
      url?: string;
      name?: string;
      timestamp: string;
      messageID?: string;
    }[]
  >([]);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [searchSenderFilter, setSearchSenderFilter] = useState('');
  const [searchFromDate, setSearchFromDate] = useState('');
  const [searchToDate, setSearchToDate] = useState('');
  const [showSearchSenderDrop, setShowSearchSenderDrop] = useState(false);
  const [showSearchDateDrop, setShowSearchDateDrop] = useState(false);
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [isBlockingOrUnblocking, setIsBlockingOrUnblocking] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState<{ url: string; timestamp: string; messageID?: string }[]>([]);

  // Lấy danh sách ảnh từ danh sách tin nhắn hiện tại để truyền vào bộ xem ảnh
  const chatImages = useMemo(() => {
    return messages
      .filter((m) => m.type === 'image' && m.media_url?.length)
      .flatMap((m) =>
        (m.media_url || []).map((url) => ({
          url: fixImageUrl(typeof url === 'string' ? url : ''),
          timestamp: m.timestamp.toString(),
          messageID: m.messageID,
        }))
      );
  }, [messages]);

  // Helper: mở image viewer - tìm trong chatImages trước, fallback sang set ảnh tùy ý
  const openImageViewer = (
    url: string,
    fallbackUrls?: string[],
    fallbackTimestamp?: string
  ) => {
    const targetUrl = cleanUrl(url);
    const idx = chatImages.findIndex((img) => cleanUrl(img.url) === targetUrl);
    if (idx !== -1) {
      setViewerImages(chatImages);
      setImageViewerIndex(idx);
      setShowImageViewer(true);
    } else if (fallbackUrls && fallbackUrls.length > 0) {
      // Fallback: dùng set ảnh được truyền vào
      const ts = fallbackTimestamp || new Date().toISOString();
      const imgs = fallbackUrls.map((u) => ({ url: u, timestamp: ts }));
      const fallbackIdx = fallbackUrls.indexOf(url);
      setViewerImages(imgs);
      setImageViewerIndex(fallbackIdx !== -1 ? fallbackIdx : 0);
      setShowImageViewer(true);
    }
  };

  const [reminderEvents, setReminderEvents] = useState<ReminderEvent[]>([]);

  const [typingUsers, setTypingUsers] = useState<{ userID: string; userName: string }[]>([]);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [seenMap, setSeenMap] = useState<
    Record<string, { userID: string; userName: string; avatar?: string | null; readAt: string }[]>
  >({});

  const [showOtherProfile, setShowOtherProfile] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);

  const [showPinnedList, setShowPinnedList] = useState(false);
  const [pinnedMenuId, setPinnedMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('top');

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [showFileSizeError, setShowFileSizeError] = useState(false);
  const [fileSizeErrorMessage, setFileSizeErrorMessage] = useState('');

  // States cho tính năng Command (@Bot, @STICKER, @GIF)
  const [suggestedText, setSuggestedText] = useState('');
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [suggestedGifs, setSuggestedGifs] = useState<any[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [mutualGroups, setMutualGroups] = useState<any[]>([]);
  const [loadingMutual, setLoadingMutual] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<MentionDropdownHandle>(null);

  // States cho MentionDropdown
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
  const [mentions, setMentions] = useState<string[]>([]); // Lưu trữ các user ID được nhắc tên

  const handleRecallFriendRequest = async (targetUserID: string) => {
    try {
      await axiosInstance.post('/contacts/cancel-friend-request', { recipientID: targetUserID });
      toast.success('Đã thu hồi lời mời kết bạn');
      // Cập nhật state cả memberInfo (cho banner) và selectedUserForProfile (cho modal nếu đang mở)
      if (memberInfo && memberInfo.userID === targetUserID) {
        setMemberInfo({ ...memberInfo, friendStatus: 'none' });
      }
      if (selectedUserForProfile && (selectedUserForProfile as any).userID === targetUserID) {
        setSelectedUserForProfile({ ...(selectedUserForProfile as any), friendStatus: 'none' });
      }
    } catch (err) {
      toast.error('Lỗi khi thu hồi lời mời');
    }
  };

  const handleAcceptFriendRequest = async (targetUserID: string) => {
    try {
      await axiosInstance.post('/contacts/accept-friend-request', { senderID: targetUserID });
      toast.success('Đã chấp nhận kết bạn');
      if (memberInfo && memberInfo.userID === targetUserID) {
        setMemberInfo({ ...memberInfo, friendStatus: 'accepted' });
        setIsStranger(false);
      }
      if (selectedUserForProfile && (selectedUserForProfile as any).userID === targetUserID) {
        setSelectedUserForProfile({ ...(selectedUserForProfile as any), friendStatus: 'accepted' });
      }
      socket.emit('friend_request_accepted', { from: user?.userID, to: targetUserID });
    } catch (err) {
      toast.error('Lỗi khi chấp nhận kết bạn');
    }
  };

  const handleRejectFriendRequest = async (targetUserID: string) => {
    try {
      await axiosInstance.post('/contacts/reject-friend-request', { senderID: targetUserID });
      toast.success('Đã từ chối lời mời kết bạn');
      if (memberInfo && memberInfo.userID === targetUserID) {
        setMemberInfo({ ...memberInfo, friendStatus: 'none' });
        setIsStranger(true);
      }
      if (selectedUserForProfile && (selectedUserForProfile as any).userID === targetUserID) {
        setSelectedUserForProfile({ ...(selectedUserForProfile as any), friendStatus: 'none' });
      }
    } catch (err) {
      toast.error('Lỗi khi từ chối kết bạn');
    }
  };

  useEffect(() => {
    if (!selectedChat || !user) return;

    const chatID = selectedChat.chatID;
    const userID = user.userID;

    console.log('🔌 Socket status:', {
      connected: socket.connected,
      id: socket.id,
      chatID,
      userID
    });

    setMessages(selectedChat.lastMessage || []);
    setPage(1);
    setHasMore((selectedChat.lastMessage || []).length >= 50);
    setIsLoadingMore(false);

    setPinnedMessages(
      (selectedChat.lastMessage || []).filter((m) => m.pinnedInfo && m.pinnedInfo.pinnedBy)
    );
    setReplyTo(null);
    setFiles([]);
    setInputText('');
    setTypingUsers([]);
    setSeenMap({});
    setIsStranger(false);
    setFriendRequestSent(false);

    // Load reminder events from API
    loadReminderEvents(selectedChat.chatID).then((events) => {
      setReminderEvents(events);
    });

    msgRefsMap.current.clear();
    setHighlightedMsgId(null);

    console.log('📤 Emitting join events:', { userID, chatID });
    socket.emit('join_user', userID);
    socket.emit('join_chat', chatID);
    socket.emit('read_messages', { chatID, userID });

    if (selectedChat.type === 'private') {
      const otherId = selectedChat.members.find((m) => m.userID !== userID)?.userID;
      if (otherId) {
        fetch(`${API}/usersID`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userID: otherId }),
        })
          .then((r) => r.json())
          .then((d) => setMemberInfo(d))
          .catch(() => { });

        // Check stranger status & mutual groups
        axiosInstance.get(`/contacts/friend-status/${otherId}`)
          .then((res) => {
            const d = res.data;
            const status = d.friendStatus;
            // Banner hiện lên khi không phải bạn bè (không là accepted, self, blocked)
            setIsStranger(status === 'none' || status === 'pending_sent' || status === 'pending_received');
            setMemberInfo(prev => prev?.userID === otherId ? { ...prev, friendStatus: status } : prev);
          })
          .catch(() => setIsStranger(false));

        // Fetch mutual groups
        setLoadingMutual(true);
        axiosInstance.get(`/groups/mutual/${otherId}`)
          .then(res => setMutualGroups(res.data))
          .catch(() => setMutualGroups([]))
          .finally(() => setLoadingMutual(false));
      }
    } else {
      setIsStranger(false);
    }

    // Emit bulk_seen
    if (user) {
      socket.emit('bulk_seen', {
        chatID,
        userID,
        userName: user.name,
        avatar: user.anhDaiDien || null,
      });
    }

    const onNewMessage = (msg: Message) => {
      setMessages((prev) => {
        const existingMsg = prev.find(
          (m) => m.messageID === msg.messageID || (msg.tempID && m.tempID === msg.tempID)
        );
        if (existingMsg) {
          return prev.map((m) =>
            (m.messageID === msg.messageID) || (msg.tempID && m.tempID === msg.tempID)
              ? { ...m, ...msg }
              : m
          );
        }
        return [...prev, msg];
      });
      if (msg.senderID !== userID) {
        socket.emit('read_messages', { chatID, userID });
      }
    };

    const onUnsend = (updated: Message) => {
      console.log('📩 Received unsend_notification:', updated);
      setMessages((prev) =>
        prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m))
      );
      // Xóa khỏi pinned messages nếu có
      setPinnedMessages((prev) => prev.filter((m) => m.messageID !== updated.messageID));
    };

    const onGhim = (updated: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m))
      );
      setPinnedMessages((prev) => {
        const exists = prev.find((m) => m.messageID === updated.messageID);
        return exists
          ? prev.map((m) => (m.messageID === updated.messageID ? updated : m))
          : [...prev, updated];
      });
    };

    const onUnghim = (updated: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.messageID === updated.messageID ? { ...m, pinnedInfo: null } : m))
      );
      setPinnedMessages((prev) => prev.filter((m) => m.messageID !== updated.messageID));
    };

    const onMessageDeletedLocal = (data: { messageID: string; chatID: string; userID: string }) => {
      // Chỉ xóa message khỏi UI của user hiện tại
      if (data.userID === userID && data.chatID === chatID) {
        setMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
        setPinnedMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
      }
    };

    const onStatusUpdate = ({ messageID, status }: { messageID?: string; status: string }) => {
      if (messageID) {
        setMessages((prev) => prev.map((m) => (m.messageID === messageID ? { ...m, status } : m)));
      }
    };

    const onUpdateUser = (updatedUser: Partial<User> & { userID: string }) => {
      setMemberInfo((prev) =>
        (prev?.userID === updatedUser.userID ? { ...prev, ...updatedUser } : prev)
      );
    };

    const onFriendStatusUpdate = (data: { userID: string; friendStatus: string; ownerID: string }) => {
      console.log('📥 ChatWindow received friend_status_update:', data);
      // Cập nhật friendStatus của memberInfo nếu là người đang chat
      setMemberInfo((prev) => {
        if (!prev) return prev;
        // Nếu mình là người bị tác động (data.userID === currentUser)
        if (data.userID === user?.userID && prev.userID === data.ownerID) {
          return { ...prev, friendStatus: data.friendStatus === 'blocked' ? 'blocked_by_other' : data.friendStatus };
        }
        // Nếu mình là người thực hiện (data.ownerID === currentUser)
        if (data.ownerID === user?.userID && prev.userID === data.userID) {
          return { ...prev, friendStatus: data.friendStatus };
        }
        return prev;
      });
    };

    socket.on('new_message', onNewMessage);
    socket.on('unsend_notification', onUnsend);
    socket.on('message_deleted_local', onMessageDeletedLocal);
    socket.on('ghim_notification', onGhim);
    socket.on('unghim_notification', onUnghim);
    socket.on(`status_update_${chatID}`, onStatusUpdate);
    socket.on('updatee_user', onUpdateUser);
    socket.on('friend_status_update', onFriendStatusUpdate);

    const onTypingStart = ({
      chatID: evtChatID,
      userID: uid,
      userName,
    }: {
      chatID: string;
      userID: string;
      userName: string;
    }) => {
      if (uid === userID || evtChatID !== chatID) return;
      setTypingUsers((prev) =>
        prev.find((u) => u.userID === uid) ? prev : [...prev, { userID: uid, userName }]
      );
    };
    const onTypingStop = ({
      chatID: evtChatID,
      userID: uid,
    }: {
      chatID: string;
      userID: string;
    }) => {
      if (evtChatID !== chatID) return;
      setTypingUsers((prev) => prev.filter((u) => u.userID !== uid));
    };

    const onMessageSeen = (data: {
      chatID: string;
      messageID: string;
      userID: string;
      userName: string;
      avatar?: string | null;
      readAt: string;
    }) => {
      if (data.chatID !== chatID) return;
      setSeenMap((prev) => {
        const existing = prev[data.messageID] || [];
        if (existing.find((r) => r.userID === data.userID)) return prev;
        return {
          ...prev,
          [data.messageID]: [
            ...existing,
            {
              userID: data.userID,
              userName: data.userName,
              avatar: data.avatar,
              readAt: data.readAt,
            },
          ],
        };
      });
    };
    const onBulkSeen = (data: {
      chatID: string;
      userID: string;
      userName: string;
      avatar?: string | null;
      readAt: string;
      messageIDs: string[];
    }) => {
      if (data.chatID !== chatID) return;
      setSeenMap((prev) => {
        const next = { ...prev };
        data.messageIDs.forEach((mid) => {
          const existing = next[mid] || [];
          if (!existing.find((r) => r.userID === data.userID)) {
            next[mid] = [
              ...existing,
              {
                userID: data.userID,
                userName: data.userName,
                avatar: data.avatar,
                readAt: data.readAt,
              },
            ];
          }
        });
        return next;
      });
    };

    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);
    socket.on('message_seen', onMessageSeen);
    socket.on('bulk_seen', onBulkSeen);

    // Bot typing indicator
    const onBotTyping = ({ chatID: evtChatID, userID: uid, isTyping }: { chatID: string; userID: string; isTyping: boolean }) => {
      if (uid === 'bot' && evtChatID === chatID) {
        setIsBotTyping(isTyping);
      }
    };
    socket.on('typing', onBotTyping);

    const onReminderEvent = (data: ReminderEvent) => {
      if (data.chatID !== chatID) return;
      setReminderEvents((prev) => {
        if (data.type === 'deleted') {
          // Cập nhật event created tương ứng thành deleted
          const updated = prev.map(e =>
            e.reminderID === data.reminderID ? { ...e, type: 'deleted' as const } : e
          );
          if (!prev.find(e => e.reminderID === data.reminderID)) {
            return [...prev, data];
          }
          return updated;
        }
        if (prev.find((e) => e.eventID === data.eventID)) return prev;
        return [...prev, data];
      });
    };
    socket.on('reminder_event', onReminderEvent);

    const onCallSystemMessage = (data: {
      chatID: string;
      type: 'call-missed' | 'call-rejected' | 'call-ended';
      from: string;
      duration?: number;
      messageID?: string;
    }) => {
      console.log('call-system-message received (ignored, using new_message instead):', data);
    };
    socket.on('call-system-message', onCallSystemMessage);

    // Ẩn banner khi đối phương chấp nhận kết bạn
    const onFriendAccepted = (data: { userID: string; friendID: string }) => {
      const otherID = selectedChat.members.find((m) => m.userID !== userID)?.userID;
      if (data.userID === otherID || data.friendID === otherID) {
        setIsStranger(false);
        setFriendRequestSent(false);
      }
    };
    socket.on('friend_request_accepted', onFriendAccepted);

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up socket listeners for chat:', chatID);
      socket.off('new_message', onNewMessage);
      socket.off(chatID, onNewMessage);
      socket.off('unsend_notification', onUnsend);
      socket.off('message_deleted_local', onMessageDeletedLocal);
      socket.off('ghim_notification', onGhim);
      socket.off('unghim_notification', onUnghim);
      socket.off(`status_update_${chatID}`, onStatusUpdate);
      socket.off('updatee_user', onUpdateUser);
      socket.off('friend_status_update', onFriendStatusUpdate);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_seen', onMessageSeen);
      socket.off('bulk_seen', onBulkSeen);
      socket.off('typing', onBotTyping);
      socket.off('reminder_event', onReminderEvent);
      socket.off('call-system-message', onCallSystemMessage);
      socket.off('friend_request_accepted', onFriendAccepted);
      setTypingUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.chatID, user?.userID]);

  // Cleanup loop debug log


  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore || !selectedChat) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`${API}/messages/id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ chatID: selectedChat.chatID, page: nextPage, limit: 50 }),
      });
      const data = await res.json();

      const messageArray = Array.isArray(data) ? data : (data.messages || []);
      if (messageArray && Array.isArray(messageArray)) {

        const previousScrollHeight = scrollRef.current?.scrollHeight || 0;

        setMessages(prev => {
          const seen = new Set(prev.map(m => m.messageID || m.tempID));
          const filtered = messageArray.filter((m: Message) => {
            const k = m.messageID || m.tempID;
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
          return [...filtered, ...prev];
        });

        setPage(nextPage);
        setHasMore(Array.isArray(data) ? false : (data.page * 50 < data.total));

        // Giữ vị trí cuộn
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - previousScrollHeight;
          }
        }, 0);
      }
    } catch (e) {
      console.error('Error loading more messages:', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0) {
      loadMoreMessages();
    }
  };

  useEffect(() => {
    // Chỉ cuộn xuống end nếu đang ở trang 1 
    // Tránh bị đẩy xuống cuối khi load trang cũ
    if (page === 1) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, page]);

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

  const buildMsg = (extra: Partial<Message>): Message =>
    ({
      tempID: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      chatID: selectedChat!.chatID,
      senderID: user!.userID,
      timestamp: new Date().toISOString(),
      status: 'sent',
      senderInfo: { name: user!.name, avatar: user!.anhDaiDien || null },
      replyTo: replyTo
        ? {
          messageID: replyTo.messageID,
          senderID: replyTo.senderID,
          content: replyTo.content,
          type: replyTo.type,
          media_url: replyTo.media_url,
        }
        : null,
      ...extra,
    }) as Message;

  const renderHighlightedInputText = (text: string) => {
    if (!text) {
      return (
        <span className="text-gray-400 opacity-70">
          Nhập @, tin nhắn tới {memberInfo?.name || "bạn bè"}
        </span>
      );
    }

    const specialTags = ['GIF', 'STICKER', 'Bot'];

    // Sắp xếp tên theo độ dài giảm dần
    const mentionNames = memberInfo ? [memberInfo.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')] : [];
    const allPatterns = [...specialTags, ...mentionNames].join('|');

    const regex = new RegExp(`(@(?:${allPatterns}))`, 'gi');
    const parts = text.split(regex);
    const elements: JSX.Element[] = parts.map((part, index) => {
      if (!part) return <span key={index}></span>;
      if (part.startsWith('@')) {
        const candidate = part.substring(1).toLowerCase();
        const isValid = specialTags.some(t => t.toLowerCase() === candidate) ||
          (memberInfo && memberInfo.name.toLowerCase() === candidate);
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

    // Ghost Placeholder: Nếu chỉ mới gõ @Bot, @STICKER, @GIF thì hiện gợi ý mờ phía sau
    const lowerText = text.toLowerCase().trim();
    if (lowerText === '@bot') {
      elements.push(
        <span key="ghost-bot" className="text-gray-400 opacity-60 italic ml-1 pointer-events-none">
          Bạn có yêu cầu gì...
        </span>
      );
    } else if (lowerText === '@sticker') {
      elements.push(
        <span key="ghost-sticker" className="text-gray-400 opacity-60 italic ml-1 pointer-events-none">
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

    if (suggestedText) {
      elements.push(
        <span key="ghost-suggestion" className="text-gray-300 pointer-events-none opacity-50">
          {suggestedText}
        </span>
      );
    }

    return <span className="text-sm pointer-events-none">{elements}</span>;
  };

  // Logic fetch GIF từ Giphy
  useEffect(() => {
    const lower = inputText.toLowerCase();
    if (lower.startsWith('@gif')) {
      const query = lower.substring(4).trim();
      const fetchGifs = async () => {
        setIsLoadingGifs(true);
        try {
          // Nếu không có từ khóa, lấy trending GIF
          const url = query
            ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=10&rating=g`
            : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=10&rating=g`;

          const res = await fetch(url);
          const data = await res.json();
          setSuggestedGifs(data.data || []);
        } catch (err) {
          console.error('Fetch GIF error:', err);
        } finally {
          setIsLoadingGifs(false);
        }
      };

      const timer = setTimeout(fetchGifs, 500);
      return () => clearTimeout(timer);
    } else {
      setSuggestedGifs([]);
    }
  }, [inputText]);

  const sendText = () => {
    if (!inputText.trim() || !selectedChat || !user) return;

    // Nếu đang gõ lệnh media nhưng chưa chọn content thì không gửi text rỗng
    if (inputText.trim() === '@GIF' || inputText.trim() === '@STICKER') {
      return;
    }
    const msg = buildMsg({ content: inputText, type: 'text', media_url: [], mentions: mentions });
    socket.emit('send_message', msg);
    setMessages((prev) => [...prev, msg]);
    setInputText('');
    setReplyTo(null);
    setSuggestedText('');
    setMentions([]); // Reset mentions after send
  };

  const handleMentionSelect = (user: { userID: string; name: string }) => {
    const textBefore = inputText.substring(0, inputText.lastIndexOf('@'));
    const newText = textBefore + `@${user.name} `;
    setInputText(newText);
    setMentions(prev => [...prev, user.userID]);
    setShowMentionDropdown(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (value: string) => {
    setInputText(value);

    // Logic gợi ý Ghost Text cho lệnh
    const lower = value.toLowerCase();
    const commonTags = ['@GIF', '@STICKER', '@Bot'];

    if (value.startsWith('@') && value.length > 1) {
      const match = commonTags.find(t => t.toLowerCase().startsWith(lower) && t.toLowerCase() !== lower);
      if (match) {
        setSuggestedText(match.substring(value.length));
      } else {
        setSuggestedText('');
      }
    } else {
      setSuggestedText('');
    }

    // Logic xử lý MentionDropdown
    const lastAtPos = value.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const textAfterAt = value.substring(lastAtPos + 1);
      // Nếu sau dấu @ có khoảng trắng hoặc xuống dòng thì ẩn dropdown
      if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
        setShowMentionDropdown(false);
      } else {
        setMentionQuery(textAfterAt);
        setShowMentionDropdown(true);

        if (inputRef.current) {
          const coords = getCaretCoordinates(inputRef.current);
          setDropdownCoords({
            top: coords.y,
            left: coords.x
          });
        }
      }
    } else {
      setShowMentionDropdown(false);
    }

    if (!selectedChat || !user) return;
    socket.emit('typing_start', {
      chatID: selectedChat.chatID,
      userID: user.userID,
      userName: user.name,
    });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socket.emit('typing_stop', {
        chatID: selectedChat.chatID,
        userID: user.userID,
        userName: user.name,
      });
    }, 2000);
  };

  const sendEmoji = (emojiData: EmojiClickData) => {
    // Thêm emoji vào input thay vì gửi ngay
    setInputText((prev) => prev + emojiData.emoji);
    setShowEmoji(false);
    // Focus vào input sau khi thêm emoji
    inputRef.current?.focus();
  };

  const sendSticker = async (stickerUrl: string) => {
    if (!selectedChat || !user) return;
    const msg = buildMsg({ content: '', type: 'sticker', media_url: [stickerUrl] });
    socket.emit('send_message', msg);
    setMessages((prev) => [...prev, msg]);
    setShowEmoji(false);
    setReplyTo(null);
    setInputText(''); // Clear input after sending from suggestion bar
  };

  const sendGif = async (gifUrl: string) => {
    if (!selectedChat || !user) return;
    const msg = buildMsg({ content: '', type: 'gif', media_url: [gifUrl] });
    socket.emit('send_message', msg);
    setMessages((prev) => [...prev, msg]);
    setShowEmoji(false);
    setReplyTo(null);
    setInputText(''); // Clear input after sending from suggestion bar
  };

  const sendFiles = async () => {
    if (!files.length || !selectedChat || !user) return;
    setIsUploading(true);

    const groups: Record<string, File[]> = { image: [], video: [], file: [] };
    files.forEach((f) => {
      if (f.type.startsWith('image/')) groups.image.push(f);
      else if (f.type.startsWith('video/')) groups.video.push(f);
      else groups.file.push(f);
    });

    try {
      for (const [type, fileList] of Object.entries(groups)) {
        if (!fileList.length) continue;
        const form = new FormData();
        fileList.forEach((f) => form.append('files', f));

        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });
        const data = await res.json();

        if (type === 'image' || type === 'video') {
          // Tạo groupId cho batch ảnh (2+ ảnh)
          const groupId = type === 'image' && data.urls.length > 1
            ? `group_${Date.now()}_${user!.userID}`
            : undefined;
          // Gửi từng ảnh/video riêng biệt
          for (let i = 0; i < data.urls.length; i++) {
            const msg = buildMsg({ content: '', type, media_url: [data.urls[i]], groupId });
            socket.emit('send_message', msg);
            setMessages((prev) => [...prev, msg]);
          }
        } else {
          fileList.forEach((f, i) => {
            const msg = buildMsg({ content: f.name, type: 'file', media_url: [data.urls[i]] });
            socket.emit('send_message', msg);
            setMessages((prev) => [...prev, msg]);
          });
        }
      }
      setFiles([]);
      setReplyTo(null);
    } catch {
      alert('Lỗi upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const validateFileSize = (files: File[]): { valid: boolean; message: string } => {
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB

    for (const file of files) {
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isDocument = !isAudio && !isImage && !isVideo;

      let maxSize = MAX_FILE_SIZE;
      let fileTypeName = 'File';

      if (isAudio) {
        maxSize = MAX_AUDIO_SIZE;
        fileTypeName = 'File ghi âm';
      } else if (isDocument) {
        maxSize = MAX_DOCUMENT_SIZE;
        fileTypeName = 'File tài liệu';
      } else if (isImage) {
        fileTypeName = 'Hình ảnh';
      } else if (isVideo) {
        fileTypeName = 'Video';
      }

      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
        return {
          valid: false,
          message: `${fileTypeName} "${file.name}" có kích thước ${fileSizeMB}MB vượt quá giới hạn ${maxSizeMB}MB cho phép.`,
        };
      }
    }

    return { valid: true, message: '' };
  };

  const sendFilesDirectly = async (fileList: File[]) => {
    if (!fileList.length || !selectedChat || !user) return;

    // Validate file sizes
    const validation = validateFileSize(fileList);
    if (!validation.valid) {
      setFileSizeErrorMessage(validation.message);
      setShowFileSizeError(true);
      return;
    }

    setIsUploading(true);

    const groups: Record<string, File[]> = { image: [], video: [], file: [] };
    fileList.forEach((f) => {
      if (f.type.startsWith('image/')) groups.image.push(f);
      else if (f.type.startsWith('video/')) groups.video.push(f);
      else groups.file.push(f);
    });

    console.log('Uploading files:', {
      total: fileList.length,
      images: groups.image.length,
      videos: groups.video.length,
      files: groups.file.length,
    });

    try {
      for (const [type, files] of Object.entries(groups)) {
        if (!files.length) continue;

        console.log(
          `Uploading ${type}:`,
          files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
        );

        const form = new FormData();
        files.forEach((f) => form.append('files', f));

        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: authHeaders(),
          body: form,
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Upload error:', errorText);
          throw new Error(`Upload failed: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log('Upload success:', data);

        // ⭐ Tạo groupId cho batch ảnh
        const groupId = type === 'image' && data.urls.length > 1
          ? `group_${Date.now()}_${user.userID}`
          : undefined;

        // Gửi từng ảnh/video/file riêng biệt với delay nhỏ để tránh race condition
        if (type === 'image' || type === 'video') {
          // Mỗi ảnh/video là một tin nhắn riêng
          for (let i = 0; i < data.urls.length; i++) {
            const url = data.urls[i];
            const msg = buildMsg({
              content: '',
              type,
              media_url: [url],
              groupId //  Thêm groupId cho ảnh
            });

            // Thêm vào state trước
            setMessages((prev) => {
              // Kiểm tra xem đã có message với tempID này chưa
              if (prev.find(m => m.tempID === msg.tempID)) {
                return prev;
              }
              return [...prev, msg];
            });

            // Sau đó emit socket
            socket.emit('send_message', msg);

            // Delay nhỏ giữa các lần gửi để tránh race condition
            if (i < data.urls.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } else {
          // File thông thường
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const msg = buildMsg({ content: f.name, type: 'file', media_url: [data.urls[i]] });

            // Thêm vào state trước
            setMessages((prev) => {
              // Kiểm tra xem đã có message với tempID này chưa
              if (prev.find(m => m.tempID === msg.tempID)) {
                return prev;
              }
              return [...prev, msg];
            });

            // Sau đó emit socket
            socket.emit('send_message', msg);

            // Delay nhỏ giữa các lần gửi
            if (i < files.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      }
      setFiles([]);
      setReplyTo(null);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Lỗi upload file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleUnsend = (msg: Message) => {
    console.log('🎯 handleUnsend called:', {
      messageID: msg.messageID,
      senderID: msg.senderID,
      userID: user?.userID,
      match: msg.senderID === user?.userID
    });

    if (!msg.messageID || msg.senderID !== user?.userID) {
      console.log('❌ Cannot unsend: validation failed');
      return;
    }

    // ⭐ Tìm tất cả messages trong cùng group (nếu có)
    let messagesToUnsend: Message[] = [msg];
    if (msg.type === 'image' && msg.groupId) {
      messagesToUnsend = messages.filter(m => m.groupId === msg.groupId && m.senderID === user.userID);
      console.log(`📸 Unsending ${messagesToUnsend.length} images from group ${msg.groupId}`);
    }

    console.log('🔄 Unsending message(s):', messagesToUnsend.map(m => m.messageID));

    // Cập nhật UI ngay lập tức (optimistic update)
    setMessages((prev) =>
      prev.map((m) =>
        messagesToUnsend.some(unsend => unsend.messageID === m.messageID)
          ? { ...m, type: 'unsend', content: '', media_url: [] }
          : m
      )
    );

    // Gửi socket event cho từng message (backend sẽ tự động xử lý group)
    // Chỉ cần gửi 1 lần cho message đầu tiên, backend sẽ xử lý toàn bộ group
    socket.emit('unsend_message', {
      messageID: msg.messageID,
      chatID: selectedChat!.chatID,
      senderID: user!.userID,
    });

    console.log('📤 Emitted unsend_message event');

    setActionMsgId(null);
  };

  const handlePin = (msg: Message) => {
    if (!msg.messageID) return;
    if (msg.pinnedInfo) {
      // Unpin message
      socket.emit('unghim_message', {
        messageID: msg.messageID,
        chatID: selectedChat!.chatID,
        senderID: user?.userID
      });
    } else {
      // Check if already have 3 pinned messages
      if (pinnedMessages.length >= 3) {
        toast.error('Chỉ có thể ghim tối đa 3 tin nhắn');
        setActionMsgId(null);
        return;
      }
      // Pin message
      socket.emit('ghim_message', {
        messageID: msg.messageID,
        chatID: selectedChat!.chatID,
        senderID: user!.userID,
      });
    }
    setActionMsgId(null);
  };

  const handleMoveToTop = (msg: Message) => {
    if (!msg.messageID) return;
    // Unpin and re-pin to move to top
    socket.emit('unghim_message', {
      messageID: msg.messageID,
      chatID: selectedChat!.chatID,
      senderID: user?.userID
    });
    setTimeout(() => {
      socket.emit('ghim_message', {
        messageID: msg.messageID,
        chatID: selectedChat!.chatID,
        senderID: user!.userID,
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
    socket.emit('unghim_message', {
      messageID: msg.messageID,
      chatID: selectedChat!.chatID,
      senderID: user?.userID
    });
    setPinnedMenuId(null);
    toast.success('Đã bỏ ghim');
  };

  const handleForward = (msg: Message) => {
    if (msg.content) setInputText(msg.content);
    setActionMsgId(null);
    inputRef.current?.focus();
  };

  const handleDeleteLocal = (msg: Message) => {
    if (!msg.messageID || !user?.userID) return;

    // ⭐ Tìm tất cả messages trong cùng group (nếu có)
    let messagesToDelete: Message[] = [msg];
    if (msg.type === 'image' && msg.groupId) {
      messagesToDelete = messages.filter(m => m.groupId === msg.groupId);
      console.log(`📸 Deleting ${messagesToDelete.length} images from group ${msg.groupId}`);
    }

    // Xóa tin nhắn khỏi UI ngay lập tức (optimistic update)
    setMessages((prev) => prev.filter((m) => !messagesToDelete.some(del => del.messageID === m.messageID)));
    setPinnedMessages((prev) => prev.filter((m) => !messagesToDelete.some(del => del.messageID === m.messageID)));

    // Gửi socket event để lưu vào database cho từng message
    messagesToDelete.forEach((message) => {
      socket.emit('delete_message_local', {
        messageID: message.messageID,
        userID: user.userID,
        chatID: selectedChat!.chatID,
      });
    });

    setActionMsgId(null);
  };

  const handleForwardMessage = (msg: Message) => {
    setForwardingMessage(msg);
    setActionMsgId(null);
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
      alert('Không thể truy cập microphone');
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
    if (!audioBlob || !selectedChat || !user) return;
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
      console.log('Upload response:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      const msg = buildMsg({ content: '', type: 'audio', media_url: [data.url] });
      console.log('Sending audio message:', msg);
      socket.emit('send_message', msg);
      setMessages((prev) => [...prev, msg]);
      setAudioBlob(null);
      setRecordingTime(0);
      setReplyTo(null);
    } catch (err) {
      console.error('Error sending audio:', err);
      alert('Lỗi gửi audio: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSearch = async (overrides?: { sender?: string; from?: string; to?: string }) => {
    const keyword = searchKeyword;
    const sender = overrides?.sender ?? searchSenderFilter;
    const from = overrides?.from ?? searchFromDate;
    const to = overrides?.to ?? searchToDate;
    if (!keyword.trim() && !sender && !from && !to) {
      setSearchResults([]);
      return;
    }
    if (!selectedChat) return;
    try {
      const params = new URLSearchParams({ chatID: selectedChat.chatID });
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (sender) params.set('senderID', sender);
      if (from) params.set('fromDate', from);
      if (to) params.set('toDate', to);
      const res = await fetch(`${API}/messages/search?${params}`, { headers: authHeaders() });
      const data = await res.json();
      const results: typeof searchResults = (data as Message[]).map((m) => ({
        type: 'message',
        content: m.content,
        timestamp: m.timestamp,
        messageID: m.messageID,
        senderInfo: (m as any).senderInfo,
      }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  const handleScrollToMessage = (messageID: string) => {
    const el = msgRefsMap.current.get(messageID);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(messageID);
      setTimeout(() => setHighlightedMsgId(null), 2500);
    }
    setShowSearch(false);
  };

  const renderMessageContent = (msg: Message, msgKey: string, isMine: boolean) => {
    if (msg.type === 'unsend') {
      return <span className="italic text-gray-400 text-sm">Tin nhắn đã bị thu hồi</span>;
    }
    if (msg.type === 'notification') {
      if (msg.content?.startsWith('##FRIENDSHIP##')) {
        const parts = msg.content.split('|');
        const senderID = parts[1];
        const receiverID = parts[2];
        const senderName = parts[3];
        const receiverName = parts[4];
        const otherName = user?.userID === senderID ? receiverName : senderName;
        return <span className="text-xs text-gray-500 italic">Bạn và {otherName} đã trở thành bạn bè</span>;
      }
      if (msg.content?.startsWith('##POLL_')) {
        const parts = msg.content.split('|');
        const type = parts[0];
        const question = parts[2];
        const personName = parts[3];
        const isMe = msg.senderID === user?.userID;
        const displayName = isMe ? 'Bạn' : personName;
        let actionText = 'đã tham gia bình chọn:';
        if (type === '##POLL_CREATED##') actionText = 'đã tạo bình chọn:';
        else if (type === '##POLL_CLOSED##') actionText = 'đã khóa bình chọn:';
        return <span className="text-xs text-gray-500 italic">{displayName} {actionText} {question}</span>;
      }
      if (msg.content?.startsWith('POLL_NOTIF|')) {
        const parts = msg.content.split('|');
        const [_, action, pollID, pollName, userName] = parts;
        const isMe = msg.senderID === user?.userID;
        const displayName = isMe ? 'Bạn' : userName;

        let actionText = 'đã tham gia bình chọn:';
        if (action === 'CREATE') actionText = 'đã tạo bình chọn:';
        if (action === 'LEAVE') actionText = 'đã bỏ bình chọn:';
        if (action === 'CHANGE') actionText = 'đã đổi lựa chọn:';
        if (action === 'LOCK') actionText = 'đã khóa bình chọn:';
        if (action === 'SHARE') actionText = 'đã chia sẻ bình chọn:';

        return <span className="text-xs text-gray-500 italic">{displayName} {actionText} {pollName}</span>;
      }
      return <span className="text-xs text-gray-500 italic">{msg.content}</span>;
    }
    if (msg.type === 'call-missed') {
      return (
        <div className="min-w-[200px] bg-blue-50 rounded-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-gray-800 font-semibold text-sm mb-2">
              {isMine ? 'Cuộc gọi nhỡ đi' : 'Cuộc gọi nhỡ đến'}
            </p>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="relative">
                <FaPhone className="text-base text-gray-500" />
                <span className="absolute -top-1 -right-2 text-red-500 text-[10px] font-bold">↗</span>
              </div>
              <span>Cuộc gọi nhỡ</span>
            </div>
          </div>
          <div className="border-t border-blue-100 px-4 py-2">
            <button
              className="text-[#0068ff] font-semibold text-sm w-full text-center"
              onClick={() => onStartVideoCall?.('voice')}
            >
              Gọi lại
            </button>
          </div>
        </div>
      );
    }
    if (msg.type === 'call-rejected') {
      return (
        <div className="min-w-[200px] bg-blue-50 rounded-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-gray-800 font-semibold text-sm mb-2">
              {isMine ? 'Cuộc gọi thoại đi' : 'Cuộc gọi thoại đến'}
            </p>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="relative">
                <FaPhone className="text-base text-gray-500" />
                <span className="absolute -top-1 -right-2 text-green-500 text-[10px] font-bold">↗</span>
              </div>
              <span>Cuộc gọi bị từ chối</span>
            </div>
          </div>
          <div className="border-t border-blue-100 px-4 py-2">
            <button
              className="text-[#0068ff] font-semibold text-sm w-full text-center"
              onClick={() => onStartVideoCall?.('voice')}
            >
              Gọi lại
            </button>
          </div>
        </div>
      );
    }
    if (msg.type === 'call-ended') {
      const formatCallDuration = (content: string) => {
        // content dạng "MM:SS" hoặc "HH:MM:SS"
        if (!content) return '';
        const parts = content.split(':').map(Number);
        if (parts.length === 2) {
          const [mins, secs] = parts;
          return `${mins} phút ${secs} giây`;
        }
        if (parts.length === 3) {
          const [hours, mins, secs] = parts;
          return hours > 0 ? `${hours} giờ ${mins} phút ${secs} giây` : `${mins} phút ${secs} giây`;
        }
        return content;
      };
      return (
        <div className="min-w-[200px] bg-blue-50 rounded-2xl overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-gray-800 font-semibold text-sm mb-2">
              {isMine ? 'Cuộc gọi thoại đi' : 'Cuộc gọi thoại đến'}
            </p>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="relative">
                <FaPhone className="text-base text-gray-500" />
                <span className="absolute -top-1 -right-2 text-green-500 text-[10px] font-bold">↗</span>
              </div>
              <span>{msg.content ? formatCallDuration(msg.content) : 'Cuộc gọi kết thúc'}</span>
            </div>
          </div>
          <div className="border-t border-blue-100 px-4 py-2">
            <button
              className="text-[#0068ff] font-semibold text-sm w-full text-center"
              onClick={() => onStartVideoCall?.('voice')}
            >
              Gọi lại
            </button>
          </div>
        </div>
      );
    }
    if (msg.type === 'image' && msg.media_url?.length) {
      const url = fixImageUrl(typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '');
      if (!url) return null;
      const fixedUrls = (msg.media_url as string[]).map(fixImageUrl);

      return (
        <img
          src={url}
          alt="img"
          className="max-w-[400px] max-h-[400px] w-auto h-auto object-contain cursor-pointer rounded-lg hover:opacity-90 transition-opacity"
          onClick={() => openImageViewer(url, fixedUrls, msg.timestamp)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }
    if (msg.type === 'sticker' && msg.media_url?.length) {
      const url = typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '';
      return (
        <img
          src={url}
          alt="sticker"
          className="w-[150px] h-[150px] object-contain cursor-pointer"
          onClick={() => window.open(url, '_blank')}
        />
      );
    }
    if (msg.type === 'gif' && msg.media_url?.length) {
      const url = typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '';
      return (
        <img
          src={url}
          alt="gif"
          className="max-w-[300px] max-h-[300px] w-auto h-auto object-contain cursor-pointer rounded-lg"
          onClick={() => window.open(url, '_blank')}
        />
      );
    }
    if (msg.type === 'video' && msg.media_url?.length) {
      return (
        <video
          src={typeof msg.media_url[0] === 'string' ? msg.media_url[0] : ''}
          controls
          className="max-w-[280px] rounded-lg"
        />
      );
    }
    if (msg.type === 'audio' && msg.media_url?.length) {
      const src = typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '';
      console.log('Rendering audio message:', {
        src,
        type: msg.type,
        isMine: msg.senderID === user?.userID,
      });
      return <AudioPlayer src={src} isMine={msg.senderID === user?.userID} />;
    }
    if (msg.type === 'file' && msg.media_url?.length) {
      const url = typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '';
      const fileName = msg.content || 'file';
      return (
        <FileDisplay fileName={fileName} fileUrl={url} isMine={isMine} />
      );
    }
    const content = msg.content || '';
    const specialTags = ['GIF', 'STICKER', 'Bot'];
    const regex = new RegExp(`(@(?:${specialTags.join('|')}))`, 'gi');
    const parts = content.split(regex);

    if (parts.length > 1) {
      return (
        <span className="text-sm whitespace-pre-wrap break-words">
          {parts.map((part, index) => {
            if (part.startsWith('@')) {
              const candidate = part.substring(1).toLowerCase();
              if (specialTags.some(t => t.toLowerCase() === candidate)) {
                return <b key={index} className="text-[#0068ff] font-bold">{part}</b>;
              }
            }
            return <span key={index}>{part}</span>;
          })}
        </span>
      );
    }

    return <span className="text-sm whitespace-pre-wrap break-words">{msg.content}</span>;
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gray-100">
        <div className="flex-1 flex flex-col justify-center items-center gap-4 bg-linear-to-br from-blue-50 to-gray-50">
          <div className="w-20 h-20 bg-linear-to-br from-[#0068ff] to-[#0077c2] rounded-full flex items-center justify-center text-white text-4xl shadow-[0_4px_16px_rgba(14,157,232,0.35)]">
            <FaComments />
          </div>
          <h2 className="text-xl font-bold text-gray-900 m-0">
            Chào mừng, {user?.name}!
          </h2>
          <p className="text-sm text-gray-400 m-0">
            Chọn một cuộc trò chuyện để bắt đầu nhắn tin
          </p>
        </div>
      </div>
    );
  }

  const chatName =
    selectedChat.type === 'private' ? memberInfo?.name || selectedChat.name : selectedChat.name;
  const chatAvatar =
    selectedChat.type === 'private'
      ? memberInfo?.anhDaiDien ||
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' + memberInfo?.userID
      : selectedChat.avatar ||
      'https://api.dicebear.com/7.x/identicon/svg?seed=' + selectedChat.chatID;

  type TimelineItem =
    | { kind: 'message'; data: Message; key: string; ts: number }
    | { kind: 'messageGroup'; data: import('../utils/messageGrouping').MessageGroup; key: string; ts: number }
    | { kind: 'reminder'; data: (typeof reminderEvents)[0]; key: string; ts: number };

  // ⭐ Group consecutive image messages
  const groupedMessages = groupMessages(messages as any);

  const timeline: TimelineItem[] = [
    ...groupedMessages.map((item) => {
      if (isMessageGroup(item)) {
        // Message group
        return {
          kind: 'messageGroup' as const,
          data: item,
          key: `group_${item.groupId}`,
          ts: item.timestamp.getTime(),
        };
      } else {
        // Single message
        return {
          kind: 'message' as const,
          data: item as Message,
          key: `msg_${item.messageID || item.tempID || item._id || Math.random().toString()}`,
          ts: new Date(item.timestamp).getTime(),
        };
      }
    }),
    ...reminderEvents.map((e) => ({
      kind: 'reminder' as const,
      data: e,
      key: `reminder_${e.eventID}`,
      ts: new Date(e.createdAt).getTime(),
    })),
  ].sort((a, b) => a.ts - b.ts) as TimelineItem[];

  return (
    <>
      <div
        className="flex-1 flex flex-col h-screen bg-gray-100"
        onClick={() => {
          setActionMsgId(null);
          setShowEmoji(false);
        }}
      >
        <div className="flex-1 flex w-full h-full overflow-hidden">
          <div className="flex-1 h-full bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center px-4 py-3 bg-white/85 backdrop-blur-xl border-b border-gray-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] flex-shrink-0 sticky top-0 z-30">
              <div className="relative flex-shrink-0 mr-3">
                <img
                  src={chatAvatar}
                  alt="avatar"
                  className="w-[42px] h-[42px] rounded-full object-cover border-2 border-[#0068ff]/10 cursor-pointer hover:ring-2 hover:ring-[#0068ff] transition-all"
                  onClick={async () => {
                    if (selectedChat.type === 'private' && memberInfo && memberInfo.userID !== 'bot') {
                      try {
                        const [userRes, statusRes] = await Promise.all([
                          fetch(`${API}/usersID`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userID: memberInfo.userID }),
                          }),
                          fetch(`${API}/contacts/friend-status/${memberInfo.userID}`, {
                            headers: { ...authHeaders() },
                          }),
                        ]);
                        const userData = await userRes.json();
                        const statusData = await statusRes.json();
                        userData.friendStatus = statusData.friendStatus || 'none';
                        setSelectedUserForProfile(userData);
                        setShowOtherProfile(true);
                      } catch (err) {
                        console.error('Failed to fetch user:', err);
                      }
                    }
                  }}
                />
                {memberInfo?.friendStatus === 'blocked' && (
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                    <FaBan className="text-red-500 text-[14px]" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold m-0 mb-0.5 text-gray-900">
                    {chatName}
                  </h2>
                  {isStranger && (
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      Người lạ
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 m-0 flex items-center gap-2">
                  {memberInfo?.trangThai === 'online' ? (
                    <span className="text-green-500">● Đang hoạt động</span>
                  ) : (
                    <span>● Ngoại tuyến</span>
                  )}
                  {isStranger && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <FaUserFriends className="text-[10px]" />
                      {loadingMutual ? 'Đang tải nhóm chung...' :
                        mutualGroups.length > 0 ? `${mutualGroups.length} nhóm chung` : 'Không có nhóm chung'
                      }
                    </span>
                  )}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* 📞 VOICE CALL */}
                <button
                  disabled={isStranger || memberInfo?.friendStatus === 'blocked' || memberInfo?.friendStatus === 'blocked_by_other'}
                  title={isStranger ? 'Không thể gọi cho người lạ' : memberInfo?.friendStatus === 'blocked' ? 'Hãy bỏ chặn để gọi' : memberInfo?.friendStatus === 'blocked_by_other' ? 'Người này đã chặn bạn' : 'Gọi thoại'}
                  onClick={() => !isStranger && memberInfo?.friendStatus !== 'blocked' && memberInfo?.friendStatus !== 'blocked_by_other' && onStartVideoCall?.('voice')}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${isStranger || memberInfo?.friendStatus === 'blocked' || memberInfo?.friendStatus === 'blocked_by_other' ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'}`}
                >
                  <FaPhone />
                </button>

                {/* 🎥 VIDEO CALL */}
                <button
                  disabled={isStranger || memberInfo?.friendStatus === 'blocked' || memberInfo?.friendStatus === 'blocked_by_other'}
                  title={isStranger ? 'Không thể gọi cho người lạ' : memberInfo?.friendStatus === 'blocked' ? 'Hãy bỏ chặn để gọi' : memberInfo?.friendStatus === 'blocked_by_other' ? 'Người này đã chặn bạn' : 'Gọi video'}
                  onClick={() => !isStranger && memberInfo?.friendStatus !== 'blocked' && memberInfo?.friendStatus !== 'blocked_by_other' && onStartVideoCall?.('video')}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${isStranger || memberInfo?.friendStatus === 'blocked' || memberInfo?.friendStatus === 'blocked_by_other' ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'}`}
                >
                  <FaVideo />
                </button>

                {/* 🔍 SEARCH */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearch((v) => !v);
                    setShowInfo(false);
                  }}
                  title="Tìm kiếm"
                  className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${showSearch
                    ? 'bg-blue-50 text-[#0068ff]'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-[#0068ff]'
                    }`}
                >
                  <FaSearch />
                </button>

                {/* Nút thông tin hội thoại (Ẩn cho AI Bot) */}
                {memberInfo?.userID !== 'bot' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInfo((v) => !v);
                      setShowSearch(false);
                    }}
                    title="Thông tin hội thoại"
                    className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${showInfo ? 'bg-blue-50 text-[#0068ff]' : 'text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'}`}
                  >
                    <FaInfoCircle />
                  </button>
                )}
              </div>
            </div>

            {/* Stranger banner (Zalo Style) */}
            {isStranger && memberInfo && (memberInfo.friendStatus !== 'accepted' && memberInfo.friendStatus !== 'self') && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0 animate-in fade-in slide-in-from-top-1">
                <FaUserFriends className="text-blue-500 text-base shrink-0" />

                {memberInfo.friendStatus === 'pending_sent' ? (
                  <>
                    <span className="flex-1 text-[13px] text-gray-600 font-medium">
                      Đã gửi lời mời kết bạn tới người này
                    </span>
                    <button
                      onClick={() => handleRecallFriendRequest(memberInfo.userID)}
                      className="px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-[12px] font-bold rounded-lg transition-all shadow-sm"
                    >
                      Thu hồi lời mời
                    </button>
                  </>
                ) : memberInfo.friendStatus === 'pending_received' ? (
                  <>
                    <span className="flex-1 text-[13px] text-gray-600 font-medium">
                      <b className="text-gray-900">{memberInfo.name}</b> đã gửi cho bạn lời mời kết bạn
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectFriendRequest(memberInfo.userID)}
                        className="px-3 py-1.5 bg-white border border-red-500 text-red-600 hover:bg-red-50 text-[12px] font-bold rounded-lg transition-all shadow-sm"
                      >
                        Từ chối
                      </button>
                      <button
                        onClick={() => handleAcceptFriendRequest(memberInfo.userID)}
                        className="px-3 py-1.5 bg-[#0068ff] text-white hover:brightness-110 text-[12px] font-bold rounded-lg transition-all shadow-sm"
                      >
                        Chấp nhận
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[13px] text-gray-600 font-medium">Gửi yêu cầu kết bạn tới người này để trò chuyện thuận tiện hơn</span>
                    <button
                      disabled={isSendingFriendRequest}
                      onClick={async () => {
                        if (!memberInfo?.sdt) return;
                        setIsSendingFriendRequest(true);
                        try {
                          const res = await axiosInstance.post('/contacts/send-friend-request', {
                            recipientPhone: memberInfo.sdt,
                            message: 'Mình kết bạn nhé!'
                          });
                          if (res.status === 201 || res.status === 200) {
                            setMemberInfo({ ...memberInfo, friendStatus: 'pending_sent' });
                            socket.emit('friend_request_sent', { from: user?.userID, to: memberInfo.userID });
                          }
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Lỗi khi gửi lời mời');
                        } finally {
                          setIsSendingFriendRequest(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-[#e5efff] text-[#0068ff] hover:bg-[#d0e3ff] text-[12px] font-bold rounded-lg transition-all shadow-sm disabled:opacity-50"
                    >
                      {isSendingFriendRequest ? 'Đang gửi...' : 'Gửi kết bạn'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Pinned messages bar */}
            {pinnedMessages.length > 0 && (
              <div className="relative bg-white border-b border-gray-200 flex-shrink-0">
                {/* Main pinned message display */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    const lastPinned = pinnedMessages[pinnedMessages.length - 1];
                    if (lastPinned?.messageID) {
                      setHighlightedMsgId(lastPinned.messageID);
                      msgRefsMap.current.get(lastPinned.messageID)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                      });
                    }
                  }}
                >
                  <BsPinAngleFill className="text-[#0068ff] text-[15px] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-800 mb-0.5">
                      {pinnedMessages[pinnedMessages.length - 1]?.senderInfo?.name || 'Tin nhắn'}
                    </div>
                    <div className="text-[12px] text-gray-500 truncate">
                      {pinnedMessages[pinnedMessages.length - 1]?.content || '[Media]'}
                    </div>
                  </div>
                  {pinnedMessages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPinnedList(!showPinnedList);
                      }}
                      className="px-3 py-1 bg-gray-50 hover:bg-[#3d566e] rounded-lg text-[12px] text-gray-700 font-medium transition-colors flex items-center gap-1"
                    >
                      +{pinnedMessages.length - 1} ghim
                      <svg
                        className={`w-3 h-3 transition-transform ${showPinnedList ? 'rotate-180' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                  <button className="text-gray-400 hover:text-gray-700 transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </div>

                {/* Dropdown list of all pinned messages */}
                {showPinnedList && pinnedMessages.length > 1 && (
                  <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-10 max-h-[300px] overflow-y-auto">
                    <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-gray-700">
                        Danh sách ghim ({pinnedMessages.length})
                      </span>
                      <button
                        onClick={() => setShowPinnedList(false)}
                        className="text-gray-400 hover:text-gray-700"
                      >
                        Thu gọn
                      </button>
                    </div>
                    {pinnedMessages.slice().reverse().map((msg, idx) => (
                      <div
                        key={msg.messageID}
                        className="relative flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-200/50"
                      >
                        <BsPinAngleFill className="text-[#0068ff] text-[13px] flex-shrink-0 mt-0.5" />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            if (msg.messageID) {
                              setHighlightedMsgId(msg.messageID);
                              msgRefsMap.current.get(msg.messageID)?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                              });
                              setShowPinnedList(false);
                            }
                          }}
                        >
                          <div className="text-[13px] font-semibold text-gray-800 mb-0.5">{msg.senderInfo?.name || 'Tin nhắn'}</div>
                          <div className="text-[12px] text-gray-500">
                            {msg.type === 'text' || msg.type === 'emoji' ? (
                              <span className="line-clamp-2">{msg.content}</span>
                            ) : msg.type === 'image' ? (
                              <span className="flex items-center gap-1">
                                <FaImage className="text-[10px]" /> Hình ảnh
                              </span>
                            ) : msg.type === 'video' ? (
                              <span className="flex items-center gap-1">
                                <FaVideo className="text-[10px]" /> Video
                              </span>
                            ) : msg.type === 'file' ? (
                              <span className="flex items-center gap-1">
                                <FaPaperclip className="text-[10px]" /> {msg.content || 'File'}
                              </span>
                            ) : (
                              '[Media]'
                            )}
                          </div>
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPinnedMenuId(pinnedMenuId === msg.messageID ? null : msg.messageID || null);
                            }}
                            className="text-gray-400 hover:text-gray-700 transition-colors p-1"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>

                          {/* Menu dropdown - show above if last item */}
                          {pinnedMenuId === msg.messageID && (
                            <div
                              className={`absolute right-0 ${idx >= pinnedMessages.length - 1 ? 'bottom-full mb-1' : 'top-full mt-1'} bg-[#1e2a38] rounded-lg shadow-xl border border-gray-600 py-1 min-w-[180px] z-20`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => handleMoveToTop(msg)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-white transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                </svg>
                                Đưa lên đầu
                              </button>
                              {(msg.type === 'text' || msg.type === 'emoji') && (
                                <button
                                  onClick={() => handleCopyPinned(msg)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-white transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </button>
                              )}
                              <button
                                onClick={() => handleUnpinFromMenu(msg)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-400 hover:bg-white transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Bỏ ghim
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 px-4 py-3 overflow-y-auto flex flex-col gap-1 bg-[#eef0f3] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded">
              {isLoadingMore && (
                <div className="flex justify-center my-3">
                  <div className="w-5 h-5 border-2 border-[#0068ff] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {timeline.map((item) => {
                // ── Reminder event ──────────────────────────────────────────
                if (item.kind === 'reminder') {
                  const evt = item.data;
                  return (
                    <div key={item.key} className="flex flex-col items-center gap-2 my-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 rounded-full text-[12px] text-gray-500 shadow-sm">
                        <span className="text-red-400">🔔</span>
                        {evt.type === 'created' ? (
                          <span>
                            <strong className="text-gray-700">
                              {evt.userID === user?.userID ? 'Bạn' : evt.userName}
                            </strong>{' '}
                            tạo nhắc hẹn mới{' '}
                            <strong className="text-gray-700">
                              {evt.reminderData.title}
                            </strong>
                            {' - '}
                            {(() => {
                              const d = new Date(evt.reminderData.datetime);
                              const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                              return `${days[d.getDay()]}, ${d.getDate()} Tháng ${d.getMonth() + 1} lúc ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                            })()}
                            {' . '}
                            <button
                              onClick={() => setShowReminder(true)}
                              className="text-[#0068ff] hover:underline font-medium"
                            >
                              Xem
                            </button>
                          </span>
                        ) : (
                          <span>
                            <strong className="text-gray-700">
                              {evt.userID === user?.userID ? 'Bạn' : evt.userName}
                            </strong>{' '}
                            xóa nhắc hẹn{' '}
                            <strong className="text-gray-700">
                              {evt.reminderData.title}
                            </strong>
                            {' . '}
                            <button
                              onClick={() => setShowReminder(true)}
                              className="text-[#0068ff] hover:underline font-medium"
                            >
                              Tạo mới
                            </button>
                          </span>
                        )}
                      </div>
                      {evt.type === 'created' && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 w-[280px] flex flex-col items-center gap-2 shadow-sm">
                          <span className="text-2xl">🔔</span>
                          <p className="text-[15px] font-bold text-gray-900 text-center m-0">
                            {evt.reminderData.title}
                          </p>
                          <p className="text-[12px] text-gray-500 flex items-center gap-1 m-0">
                            🕐{' '}
                            {(() => {
                              const d = new Date(evt.reminderData.datetime);
                              const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                              return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} lúc ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                            })()}
                          </p>
                          <button
                            onClick={() => setShowReminder(true)}
                            className="w-full mt-1 py-2 border-2 border-[#0068ff] text-[#0068ff] rounded-xl text-[13px] font-bold hover:bg-blue-50 transition-colors"
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      )}
                      {evt.type === 'deleted' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 w-[280px] flex flex-col items-center gap-2">
                          <span className="text-2xl opacity-30">🔕</span>
                          <p className="text-[13px] text-gray-400 m-0">Nhắc hẹn đã bị xóa</p>
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Message Group (Multiple Images) ────────────────────────
                if (item.kind === 'messageGroup') {
                  const group = item.data;
                  const isMine = group.senderID === user?.userID;
                  const firstMsg = group.messages[0];

                  return (
                    <div
                      key={item.key}
                      id={`msg-${firstMsg.messageID}`}
                      ref={(el) => {
                        // ⭐ Thêm ref cho tất cả messages trong group
                        if (el) {
                          (group.messages as Message[]).forEach((msg) => {
                            if (msg.messageID) {
                              msgRefsMap.current.set(msg.messageID, el);
                            }
                          });
                        }
                      }}
                      className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 ${
                        // ⭐ Highlight nếu bất kỳ message nào trong group được highlight
                        (group.messages as Message[]).some((msg) => msg.messageID === highlightedMsgId)
                          ? 'bg-yellow-200/70 rounded-xl px-1 -mx-1'
                          : ''
                        }`}
                    >
                      {/* Avatar */}
                      {!isMine && (
                        <img
                          src={
                            firstMsg.senderInfo?.avatar ||
                            'https://api.dicebear.com/7.x/avataaars/svg?seed=' + group.senderID
                          }
                          alt="av"
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                          onClick={async () => {
                            if (group.senderID === 'bot') return;
                            try {
                              const [userRes, statusRes] = await Promise.all([
                                fetch(`${API}/usersID`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userID: group.senderID }),
                                }),
                                fetch(`${API}/contacts/friend-status/${group.senderID}`, {
                                  headers: { ...authHeaders() },
                                }),
                              ]);
                              const userData = await userRes.json();
                              const statusData = await statusRes.json();
                              userData.friendStatus = statusData.friendStatus || 'none';
                              setSelectedUserForProfile(userData);
                              setShowOtherProfile(true);
                            } catch (err) {
                              console.error('Failed to fetch user:', err);
                            }
                          }}
                        />
                      )}

                      <div className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
                        {/* Sender name (group chat) */}
                        {!isMine && selectedChat.type === 'group' && (
                          <span className="text-[11px] text-gray-500 mb-0.5 ml-1">
                            {firstMsg.senderInfo?.name || 'Unknown'}
                          </span>
                        )}

                        {/* Image Grid */}
                        <div
                          className="relative group"
                        >
                          <ImageGrid
                            messages={group.messages as any}
                            onImageClick={(url, allUrls) => {
                              const ts = group.messages[0]?.timestamp?.toString() || new Date().toISOString();
                              openImageViewer(url, allUrls, ts);
                            }}
                          />

                          {/* Action buttons - hiện cho cả người gửi và người nhận */}
                          <div className="absolute bottom-2 left-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {/* Forward button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setForwardingMessage(firstMsg as any);
                              }}
                              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center shadow-lg transition-colors"
                              title="Chuyển tiếp"
                            >
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>

                            {/* Menu button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const windowHeight = window.innerHeight;
                                const spaceBelow = windowHeight - rect.bottom;
                                const spaceAbove = rect.top;

                                if (spaceBelow > 200 || spaceBelow > spaceAbove) {
                                  setMenuPosition('bottom');
                                } else {
                                  setMenuPosition('top');
                                }

                                setActionMsgId(item.key);
                              }}
                              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center shadow-lg transition-colors"
                              title="Tùy chọn"
                            >
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                              </svg>
                            </button>
                          </div>

                          {/* Timestamp */}
                          <span className="text-[10px] text-gray-400 mt-1 block">
                            {new Date(group.timestamp).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          {/* Context Menu for Image Group */}
                          {actionMsgId === item.key && (
                            <div
                              className={`absolute z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] ${isMine ? 'right-0' : 'left-0'} ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={() => {
                                  setReplyTo(firstMsg as any);
                                  setActionMsgId(null);
                                  inputRef.current?.focus();
                                }}
                              >
                                <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
                                </svg>
                                Trả lời
                              </button>
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={() => {
                                  handlePin(firstMsg as any);
                                  setActionMsgId(null);
                                }}
                              >
                                <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                                </svg>
                                {firstMsg.pinnedInfo ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                              </button>

                              {/* Xóa phía tôi - có thể xóa tin nhắn của bất kỳ ai */}
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 transition-colors"
                                onClick={() => {
                                  handleDeleteLocal(firstMsg as any);
                                  setActionMsgId(null);
                                }}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Xóa phía tôi
                              </button>

                              {/* Thu hồi - chỉ có thể thu hồi tin nhắn của mình */}
                              {isMine && (
                                <button
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                  onClick={() => {
                                    handleUnsend(firstMsg as any);
                                    setActionMsgId(null);
                                  }}
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  Thu hồi
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── Message ─────────────────────────────────────────────────
                const msg = item.data;
                const isMine = msg.senderID === user?.userID;
                const isNotif = msg.type === 'notification';
                const isCallMsg = ['call-ended', 'call-missed', 'call-rejected'].includes(msg.type);
                const msgKey = item.key;

                if (isNotif) {
                  const content = msg.content || '';
                  if (content.startsWith('##FRIENDSHIP##')) {
                    const parts = content.split('|');
                    const id1 = parts[1];
                    const id2 = parts[2];
                    const name1 = parts[3];
                    const name2 = parts[4];
                    const isNew = parts[5] === 'new';

                    const isSelf1 = id1 === user?.userID;
                    const friendID = isSelf1 ? id2 : id1;
                    const friendName = isSelf1 ? name2 : name1;

                    return (
                      <div key={msgKey} className="flex justify-center my-1">
                        <span className="text-xs text-gray-500 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-sm transition-all hover:bg-white/20">
                          Bạn và{' '}
                          <button
                            className="font-bold text-blue-500 hover:text-blue-600 transition-colors mx-0.5"
                            onClick={async () => {
                              try {
                                const [userRes, statusRes] = await Promise.all([
                                  fetch(`${API}/usersID`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userID: friendID }),
                                  }),
                                  fetch(`${API}/contacts/friend-status/${friendID}`, {
                                    headers: { ...authHeaders() },
                                  }),
                                ]);
                                const userData = await userRes.json();
                                const statusData = await statusRes.json();
                                userData.friendStatus = statusData.friendStatus || 'none';
                                setSelectedUserForProfile(userData);
                                setShowOtherProfile(true);
                              } catch (err) {
                                console.error('Failed to fetch friend profile:', err);
                              }
                            }}
                          >
                            {friendName}
                          </button>
                          đã trở thành bạn bè.{' '}
                          {isNew && <span className="opacity-80">Hãy bắt đầu cuộc trò chuyện.</span>}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={msgKey} className="flex justify-center my-1">
                      <span className="text-xs text-gray-500 bg-white/70 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={msgKey}
                    id={`msg-${msg.messageID}`}
                    ref={(el) => {
                      if (el && msg.messageID) msgRefsMap.current.set(msg.messageID, el);
                    }}
                    className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 ${highlightedMsgId === msg.messageID ? 'bg-yellow-200/50 rounded-xl px-1 -mx-1' : ''}`}
                  >
                    {/* Avatar */}
                    {!isMine && (
                      <img
                        src={
                          msg.senderInfo?.avatar ||
                          'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.senderID
                        }
                        alt="av"
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                        onClick={async () => {
                          if (msg.senderID === 'bot') return;
                          try {
                            const [userRes, statusRes] = await Promise.all([
                              fetch(`${API}/usersID`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userID: msg.senderID }),
                              }),
                              fetch(`${API}/contacts/friend-status/${msg.senderID}`, {
                                headers: { ...authHeaders() },
                              }),
                            ]);
                            const userData = await userRes.json();
                            const statusData = await statusRes.json();
                            userData.friendStatus = statusData.friendStatus || 'none';
                            setSelectedUserForProfile(userData);
                            setShowOtherProfile(true);
                          } catch (err) {
                            console.error('Failed to fetch user:', err);
                          }
                        }}
                      />
                    )}

                    <div
                      className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      {/* Sender name (group) */}
                      {!isMine && selectedChat.type === 'group' && !isCallMsg && (
                        <span className="text-[11px] text-gray-500 mb-0.5 ml-1">
                          {msg.senderInfo?.name}
                        </span>
                      )}

                      {/* Reply preview */}
                      {msg.replyTo && !isCallMsg && (
                        <div style={{ display: 'none' }}></div>
                      )}

                      {/* Bubble */}
                      <div className="relative">
                        <div
                          className={`${msg.type === 'image' ||
                            msg.type === 'video' ||
                            msg.type === 'sticker' ||
                            msg.type === 'gif' ||
                            isCallMsg
                            ? '' // Không có background cho ảnh/video/sticker/gif/call
                            : `rounded-2xl shadow-sm overflow-hidden ${isMine
                              ? 'bg-[#e3f2ff] text-gray-800 rounded-br-sm border border-[#d1e9ff]'
                              : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                            }`
                            } ${msg.type === 'unsend' ? 'opacity-60' : ''} cursor-pointer select-text`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // Calculate if menu should show above or below
                            const rect = e.currentTarget.getBoundingClientRect();
                            const windowHeight = window.innerHeight;
                            const spaceBelow = windowHeight - rect.bottom;
                            const spaceAbove = rect.top;

                            // If more space below or near bottom, show below; otherwise show above
                            if (spaceBelow > 200 || spaceBelow > spaceAbove) {
                              setMenuPosition('bottom');
                            } else {
                              setMenuPosition('top');
                            }

                            setActionMsgId(msgKey);
                          }}
                        >
                          {/* Reply preview bên trong bubble */}
                          {msg.replyTo && !isCallMsg && (
                            <div
                              className={`px-3 pt-2 pb-1 cursor-pointer ${isMine ? 'bg-[#dceeff]' : 'bg-gray-50'
                                }`}
                              onClick={() => {
                                if (msg.replyTo?.messageID) {
                                  setHighlightedMsgId(msg.replyTo.messageID);
                                  msgRefsMap.current.get(msg.replyTo.messageID)?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                  });
                                }
                              }}
                            >
                              <div className={`border-l-[3px] pl-2 ${isMine ? 'border-[#0068ff]/30' : 'border-[#0068ff]'}`}>
                                <div className={`text-[12px] font-semibold mb-0.5 ${isMine ? 'text-gray-700' : 'text-gray-800'}`}>
                                  {msg.replyTo.senderID === user?.userID ? 'Bạn' : (messages.find(m => m.messageID === msg.replyTo?.messageID)?.senderInfo?.name || 'Người dùng')}
                                </div>
                                <div className={`text-[12px] truncate ${isMine ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {msg.replyTo.type === 'text' || msg.replyTo.type === 'emoji' ? (
                                    msg.replyTo.content
                                  ) : msg.replyTo.type === 'image' ? (
                                    <span className="flex items-center gap-1"><FaImage className="text-[10px]" /> Hình ảnh</span>
                                  ) : msg.replyTo.type === 'video' ? (
                                    <span className="flex items-center gap-1"><FaVideo className="text-[10px]" /> Video</span>
                                  ) : msg.replyTo.type === 'file' ? (
                                    <span className="flex items-center gap-1"><FaPaperclip className="text-[10px]" /> File</span>
                                  ) : '[Media]'}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className={`${msg.type === 'image' || msg.type === 'video' || msg.type === 'sticker' || msg.type === 'gif' || isCallMsg
                            ? ''
                            : msg.type === 'file' ? '' : 'px-3 py-2'
                            }`}>
                            {renderMessageContent(msg, msgKey, isMine)}
                          </div>
                        </div>

                        {/* Pinned indicator */}
                        {msg.pinnedInfo && !isCallMsg && (
                          <BsPin
                            className={`absolute -top-1.5 ${isMine ? '-left-4' : '-right-4'} text-yellow-500 text-xs`}
                          />
                        )}

                        {/* Action menu */}
                        {actionMsgId === msgKey && (
                          <div
                            className={`absolute z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] ${isMine ? 'right-0' : 'left-0'} ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => {
                                setReplyTo(msg);
                                setActionMsgId(null);
                                inputRef.current?.focus();
                              }}
                            >
                              <FaReply className="text-gray-400 text-xs" /> Trả lời
                            </button>
                            <button
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => handleForwardMessage(msg)}
                            >
                              <FaThumbsUp className="text-gray-400 text-xs" /> Chuyển tiếp
                            </button>
                            <button
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => handlePin(msg)}
                            >
                              <BsPin className="text-gray-400 text-xs" />
                              {msg.pinnedInfo ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                            </button>

                            {/* Xóa phía tôi - có thể xóa tin nhắn của bất kỳ ai */}
                            {msg.type !== 'unsend' && (
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 transition-colors"
                                onClick={() => handleDeleteLocal(msg)}
                              >
                                <FaTrash className="text-xs" /> Xóa phía tôi
                              </button>
                            )}

                            {/* Thu hồi - chỉ có thể thu hồi tin nhắn của mình */}
                            {isMine && msg.type !== 'unsend' && (
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                onClick={() => handleUnsend(msg)}
                              >
                                <FaTrash className="text-xs" /> Thu hồi
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Time + status + read receipts */}
                      <div
                        className={`flex items-center gap-1 mt-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <span className="text-[10px] text-gray-400">
                          {formatTime(msg.timestamp)}
                        </span>
                        {isMine && (
                          <span className="text-[10px] text-gray-400">
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                        {isMine && msg.messageID && seenMap[msg.messageID]?.length > 0 && (
                          <div className={`flex items-center gap-0.5 ${isMine ? 'mr-1' : 'ml-1'}`}>
                            {seenMap[msg.messageID]
                              .filter((r) => r.userID !== user?.userID)
                              .slice(0, 3)
                              .map((r) => (
                                <img
                                  key={r.userID}
                                  src={
                                    r.avatar ||
                                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.userID}`
                                  }
                                  alt={r.userName}
                                  title={`${r.userName} đã xem lúc ${new Date(r.readAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                                  className="w-3.5 h-3.5 rounded-full object-cover border border-white"
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator - người dùng thường */}
              {typingUsers.length > 0 && (
                <div className="flex items-end gap-2 flex-row">
                  <div className="flex flex-col items-start max-w-[65%]">
                    <span className="text-[11px] text-gray-400 mb-0.5 ml-1">
                      {typingUsers.map((u) => u.userName).join(', ')} đang nhập...
                    </span>
                    <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Bot typing indicator */}
              {isBotTyping && (
                <div className="flex mb-3 justify-start">
                  <div className="relative flex-shrink-0 mr-2">
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold">
                      T
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 mb-1 font-semibold px-1">
                      AI Bot đang nhập...
                    </span>
                    <div className="bg-white px-4 py-2.5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.08)] flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Reply bar */}
            {replyTo && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-100 flex-shrink-0">
                <FaReply className="text-[#0068ff] text-sm flex-shrink-0" />
                <div className="flex-1 text-xs text-gray-600 truncate">
                  <span className="font-medium text-[#0068ff]">Trả lời </span>
                  {replyTo.content || '[Media]'}
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="text-xs" />
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
                  onClick={sendFiles}
                  disabled={isUploading}
                  className="ml-auto px-3 py-1.5 bg-[#0068ff] text-white text-xs rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            )}

            {/* Input area */}
            <div className="flex-shrink-0">
              {memberInfo?.friendStatus === 'blocked' ? (
                <div className="flex items-center justify-center p-5 bg-blue-50/50 border-t border-blue-100 gap-3 animate-fade-in">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <FaInfoCircle className="text-[#0068ff] text-lg" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[14px] text-gray-600 m-0 font-medium">
                      Bạn đã chặn người dùng này
                    </p>
                    <button
                      onClick={() => setShowUnblockConfirm(true)}
                      className="text-[#0068ff] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer text-[13px] text-left"
                    >
                      Bỏ chặn để tiếp tục trò chuyện
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          const fileArray = Array.from(e.target.files);
                          setFiles(fileArray);
                          // Tự động gửi sau khi chọn ảnh/video
                          setTimeout(() => {
                            if (fileArray.length > 0) {
                              sendFilesDirectly(fileArray);
                            }
                          }, 100);
                        }
                      }}
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Gửi file"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0068ff] hover:bg-gray-100 transition-colors"
                    >
                      <FaPaperclip />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          const fileArray = Array.from(e.target.files);
                          setFiles(fileArray);
                          // Tự động gửi sau khi chọn file
                          setTimeout(() => {
                            if (fileArray.length > 0) {
                              sendFilesDirectly(fileArray);
                            }
                          }, 100);
                        }
                      }}
                    />

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
                        setShowReminder(true);
                      }}
                      title="Nhắc hẹn"
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors ${showReminder ? 'text-[#0068ff] bg-blue-50' : 'text-gray-500 hover:text-[#0068ff] hover:bg-gray-100'}`}
                    >
                      <FaBell />
                    </button>
                  </div>

                  {/* Emoji picker modal */}
                  {showEmoji && (
                    <StickerEmojiPicker
                      onEmojiClick={sendEmoji}
                      onStickerClick={sendSticker}
                      onGifClick={sendGif}
                      onClose={() => setShowEmoji(false)}
                    />
                  )}

                  {/* Recording bar — waveform animation */}
                  {isRecording && (
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
                  {audioBlob && !isRecording && (
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
                        {isUploading ? '...' : 'Gửi'}
                      </button>
                    </div>
                  )}

                  {/* Thanh Suggestion cho @Bot */}
                  {inputText.toLowerCase().includes('@bot') && (
                    <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden w-full text-sm bg-white">
                      {['Gợi ý quà tặng', 'Dịch tin nhắn', 'Tóm tắt nội dung'].map((sug, i) => (
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

                  {/* Thanh Suggestion cho @STICKER */}
                  {inputText.toLowerCase().startsWith('@sticker') && (
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden w-full bg-white/50 backdrop-blur-sm">
                      {(() => {
                        const query = inputText.substring(8).trim().toLowerCase();
                        const filtered = query
                          ? STICKER_DATA.filter(s => s.name.includes(query) || s.tags.some(t => t.includes(query)))
                          : STICKER_DATA;

                        if (filtered.length === 0) {
                          return <span className="text-xs text-gray-500 mx-auto italic py-1">Vui lòng thử lại với từ khóa khác</span>;
                        }

                        return filtered.map((sticker, i) => (
                          <button
                            key={i}
                            onClick={() => sendSticker(sticker.url)}
                            className="w-[60px] h-[60px] shrink-0 bg-gray-50 rounded-xl p-1.5 hover:bg-blue-50 hover:scale-110 transition-all border border-gray-100/50 shadow-sm"
                            title={sticker.name}
                          >
                            <img src={sticker.url} alt={sticker.name} className="w-full h-full object-contain" />
                          </button>
                        ));
                      })()}
                    </div>
                  )}

                  {/* Thanh Suggestion cho @GIF */}
                  {inputText.toLowerCase().startsWith('@gif') && (
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden w-full bg-white/50 backdrop-blur-sm h-[90px]">
                      {isLoadingGifs ? (
                        <div className="flex items-center gap-2 text-gray-400 italic text-xs py-2 mx-auto">
                          <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                          Đang tìm GIF...
                        </div>
                      ) : suggestedGifs.length === 0 ? (
                        <span className="text-xs text-gray-500 mx-auto italic py-1">Không tìm thấy GIF phù hợp</span>
                      ) : (
                        suggestedGifs.map((gif, i) => (
                          <button
                            key={gif.id}
                            onClick={() => sendGif(gif.images.original.url)}
                            className="w-[100px] h-[70px] shrink-0 bg-gray-50 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-400 hover:scale-105 transition-all shadow-sm"
                          >
                            <img src={gif.images.fixed_height.url} alt="gif" className="w-full h-full object-cover" />
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Text input row */}
                  <div className="flex items-center px-3 pb-2.5 pt-1 bg-white gap-2 relative">
                    <div className="flex-1 relative min-h-[40px] flex items-center bg-gray-50 rounded-[22px] border border-gray-200 focus-within:border-[#0068ff] focus-within:bg-white focus-within:shadow-[0_0_0_2px_rgba(0,104,255,0.1)] transition-all overflow-hidden">
                      <textarea
                        ref={inputRef}
                        rows={1}
                        value={inputText}
                        onChange={(e) => {
                          handleInputChange(e.target.value);
                          // Auto-resize
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (showMentionDropdown && mentionDropdownRef.current) {
                            if (mentionDropdownRef.current.handleKeyDown(e)) return;
                          }
                          if (e.key === 'Tab' && suggestedText) {
                            e.preventDefault();
                            handleInputChange(inputText + suggestedText);
                          }
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendText();
                            e.currentTarget.style.height = '40px';
                          }
                        }}
                        placeholder=""
                        className="w-full px-4 py-2 outline-none text-sm bg-transparent resize-none overflow-y-auto text-transparent caret-gray-900 z-10 block"
                        style={{
                          lineHeight: '1.5',
                          minHeight: '40px'
                        }}
                      />

                      {/* Ghost Placeholder & Highlight Overlay */}
                      <div
                        ref={overlayRef}
                        className="absolute inset-0 px-4 py-2 text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-gray-900 z-0"
                        style={{ lineHeight: '1.5' }}
                      >
                        {renderHighlightedInputText(inputText)}
                      </div>
                    </div>

                    <button
                      onClick={sendText}
                      disabled={!inputText.trim()}
                      className="w-9 h-9 flex items-center justify-center bg-[#0068ff] text-gray-900 rounded-full hover:bg-[#0077c2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 text-sm"
                    >
                      <FaPaperPlane />
                    </button>

                    <MentionDropdown
                      ref={mentionDropdownRef}
                      isOpen={showMentionDropdown}
                      members={[]} // Không mention người khác trong chat 1-1 theo yêu cầu
                      query={mentionQuery}
                      onSelect={(item) => {
                        if (typeof item === 'string') {
                          // Handle special tags (@GIF, @STICKER, @Bot) - Sửa capitalization cho Bot
                          const tagMap: Record<string, string> = { 'gif': '@GIF', 'sticker': '@STICKER', 'bot': '@Bot' };
                          const tag = tagMap[item.toLowerCase()] || `@${item}`;
                          const textBefore = inputText.substring(0, inputText.lastIndexOf('@'));
                          handleInputChange(textBefore + tag + ' ');
                        } else {
                          handleMentionSelect(item);
                        }
                        setShowMentionDropdown(false);
                      }}
                      onClose={() => setShowMentionDropdown(false)}
                      coords={{ x: dropdownCoords.left, y: dropdownCoords.top }}
                      existingMentionIDs={mentions}
                      disableAll={true} // Ẩn @All trong chat 1-1
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Search panel */}
          {showSearch && (
            <div
              className="w-[300px] border-l border-gray-100 bg-white flex flex-col shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <h3 className="text-[14px] font-semibold text-gray-800 flex-1">Tìm kiếm trong trò chuyện</h3>
                <button
                  onClick={() => { setShowSearch(false); setSearchResults([]); setSearchKeyword(''); setSearchSenderFilter(''); setSearchFromDate(''); setSearchToDate(''); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
              {/* Search input */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                <FaSearch className="text-gray-400 text-xs shrink-0" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Tìm kiếm..."
                  autoFocus
                  className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
                />
                {searchKeyword && (
                  <button onClick={() => { setSearchKeyword(''); handleSearch({ sender: searchSenderFilter, from: searchFromDate, to: searchToDate }); }} className="text-gray-400 hover:text-gray-600 text-xs">Xóa</button>
                )}
              </div>
              {/* Filters */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-wrap">
                <span className="text-[11px] text-gray-500">Lọc theo:</span>
                {/* Sender filter - chỉ hiện cho group */}
                {selectedChat?.type === 'group' && (() => {
                  const chatMembers = selectedChat?.members || [];
                  return (
                    <div className="relative">
                      <button
                        onClick={() => { setShowSearchSenderDrop(v => !v); setShowSearchDateDrop(false); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-colors ${searchSenderFilter ? 'border-[#0068ff] bg-blue-50 text-[#0068ff]' : 'border-gray-200 text-gray-500 hover:border-[#0068ff]'}`}
                      >
                        <FaSearch className="text-[9px]" /> Người gửi ▾
                      </button>
                      {showSearchSenderDrop && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] max-h-[200px] overflow-y-auto py-1">
                          <div className="px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 text-gray-500" onClick={() => { setSearchSenderFilter(''); setShowSearchSenderDrop(false); handleSearch({ sender: '', from: searchFromDate, to: searchToDate }); }}>Tất cả</div>
                          {chatMembers.map((m: any) => (
                            <div key={m.userID} className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${searchSenderFilter === m.userID ? 'text-[#0068ff] bg-blue-50' : 'text-gray-700'}`}
                              onClick={() => { setSearchSenderFilter(m.userID); setShowSearchSenderDrop(false); handleSearch({ sender: m.userID, from: searchFromDate, to: searchToDate }); }}>
                              {m.userID}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Date filter */}
                <div className="relative">
                  <button
                    onClick={() => { setShowSearchDateDrop(v => !v); setShowSearchSenderDrop(false); }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-colors ${(searchFromDate || searchToDate) ? 'border-[#0068ff] bg-blue-50 text-[#0068ff]' : 'border-gray-200 text-gray-500 hover:border-[#0068ff]'}`}
                  >
                    📅 Ngày gửi ▾
                  </button>
                  {showSearchDateDrop && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 min-w-[200px]">
                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Từ ngày</label>
                          <input type="date" value={searchFromDate} onChange={e => { setSearchFromDate(e.target.value); handleSearch({ sender: searchSenderFilter, from: e.target.value, to: searchToDate }); }} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#0068ff]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-1">Đến ngày</label>
                          <input type="date" value={searchToDate} onChange={e => { setSearchToDate(e.target.value); handleSearch({ sender: searchSenderFilter, from: searchFromDate, to: e.target.value }); }} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#0068ff]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {(searchSenderFilter || searchFromDate || searchToDate) && (
                  <button onClick={() => { setSearchSenderFilter(''); setSearchFromDate(''); setSearchToDate(''); handleSearch({ sender: '', from: '', to: '' }); }} className="text-[10px] text-red-400 hover:text-red-600">Xóa lọc</button>
                )}
              </div>
              {/* Results */}
              <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center mt-8">
                    {(searchKeyword || searchSenderFilter || searchFromDate || searchToDate) ? 'Không tìm thấy kết quả' : 'Nhập từ khóa để tìm kiếm'}
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold text-gray-500 px-0.5">Tin nhắn</p>
                    {searchResults.map((r, i) => (
                      <div
                        key={i}
                        className={`flex gap-2.5 p-2.5 rounded-xl text-sm cursor-pointer border transition-colors ${r.messageID ? 'bg-gray-50 border-gray-100 hover:bg-blue-50 hover:border-[#0068ff]/30' : 'bg-gray-50 border-transparent'}`}
                        onClick={() => r.messageID && handleScrollToMessage(r.messageID)}
                      >
                        {(r as any).senderInfo?.avatar
                          ? <img src={(r as any).senderInfo.avatar} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                          : <div className="w-8 h-8 rounded-full bg-[#0068ff] text-white flex items-center justify-center text-xs font-bold shrink-0">{(r as any).senderInfo?.name?.[0] || '?'}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[12px] font-semibold text-gray-700">{(r as any).senderInfo?.name || ''}</span>
                            <span className="text-[10px] text-gray-400">{new Date(r.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
                          </div>
                          {r.type === 'message' && (
                            <p className="text-gray-600 text-[12px] leading-snug line-clamp-2">
                              {r.content
                                ?.split(new RegExp(`(${searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
                                .map((part, j) =>
                                  part.toLowerCase() === searchKeyword.toLowerCase() ? (
                                    <mark key={j} className="bg-blue-200/60 text-blue-900 rounded px-0.5">{part}</mark>
                                  ) : part
                                )}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Info panel */}
          {showInfo && (
            <ChatInfoPanel
              chat={selectedChat}
              user={user}
              memberInfo={memberInfo}
              messages={messages}
              onClose={() => setShowInfo(false)}
              onStatusChange={(status) => {
                setMemberInfo(prev => prev ? { ...prev, friendStatus: status as any } : null);
              }}
              onHistoryDeleted={() => {
                setMessages([]);
                setShowInfo(false);
              }}
            />
          )}
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminder && selectedChat && user && (
        <ReminderModal
          chatID={selectedChat.chatID}
          userID={user.userID}
          userName={user.name}
          onClose={() => setShowReminder(false)}
          onCreated={(r) => {
            // Reload reminder events from API
            loadReminderEvents(selectedChat.chatID).then((events) => {
              setReminderEvents(events);
            });
            setShowReminder(false);
          }}
          onDeleted={(r) => {
            // Reload reminder events from API
            loadReminderEvents(selectedChat.chatID).then((events) => {
              setReminderEvents(events);
            });
          }}
        />
      )}

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
          user={user}
        />
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && viewerImages.length > 0 && (
        <ImageViewerModal
          images={viewerImages}
          initialIndex={imageViewerIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Other Profile Modal */}
      {showOtherProfile && selectedUserForProfile && (
        <OtherProfileModal
          user={selectedUserForProfile}
          currentUser={user}
          onClose={() => {
            setShowOtherProfile(false);
            setSelectedUserForProfile(null);
          }}
          onStatusChange={(status) => {
            if (memberInfo) {
              setMemberInfo({ ...memberInfo, friendStatus: status });
            }
          }}
          onRecall={() => selectedUserForProfile && handleRecallFriendRequest((selectedUserForProfile as any).userID)}
          onAccept={() => selectedUserForProfile && handleAcceptFriendRequest((selectedUserForProfile as any).userID)}
          onReject={() => selectedUserForProfile && handleRejectFriendRequest((selectedUserForProfile as any).userID)}
          onAddFriend={async () => {
            if (!selectedUserForProfile?.sdt || isSendingFriendRequest) return;
            setIsSendingFriendRequest(true);
            try {
              const res = await axiosInstance.post('/contacts/send-friend-request', {
                recipientPhone: selectedUserForProfile.sdt,
                message: 'Mình kết bạn nhé!'
              });
              if (res.status === 201 || res.status === 200) {
                toast.success('Đã gửi lời mời kết bạn');
                setSelectedUserForProfile({ ...selectedUserForProfile, friendStatus: 'pending_sent' });
                socket.emit('friend_request_sent', { from: user?.userID, to: selectedUserForProfile.userID });
              }
            } catch (err: unknown) {
              const error = err as any;
              toast.error(error.response?.data?.message || 'Lỗi khi gửi lời mời');
            } finally {
              setIsSendingFriendRequest(false);
            }
          }}
        />
      )}

      {/* File Size Error Modal */}
      {showFileSizeError && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowFileSizeError(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-center text-gray-900 mb-3">
              File vượt quá giới hạn
            </h3>

            {/* Message */}
            <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed">
              {fileSizeErrorMessage}
            </p>

            {/* Size limits info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Giới hạn kích thước file:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  Hình ảnh & Video: 100MB
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  File tài liệu: 20MB
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                  File ghi âm: 10MB
                </li>
              </ul>
            </div>

            {/* Button */}
            <button
              onClick={() => setShowFileSizeError(false)}
              className="w-full py-3 bg-[#0068ff] hover:bg-[#0077c2] text-gray-900 font-medium rounded-lg transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        show={showUnblockConfirm}
        title="Xác nhận bỏ chặn"
        message={`Bạn có muốn bỏ chặn liên lạc với ${memberInfo?.name}?`}
        onConfirm={async () => {
          if (!memberInfo?.userID || !user?.userID) return;
          setShowUnblockConfirm(false);
          try {
            await axiosInstance.post('/contacts/unblock', { targetUserID: String(memberInfo.userID) });
            toast.success('Đã bỏ chặn');
            // Backend sẽ emit friend_status_update, không cần emit từ client
            setMemberInfo(prev => prev ? { ...prev, friendStatus: 'none' } : null);
          } catch (err) {
            toast.error('Lỗi khi bỏ chặn');
          }
        }}
        onCancel={() => setShowUnblockConfirm(false)}
      />
    </>
  );
};

export default ChatWindow;
