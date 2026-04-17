import { useState, useEffect, useRef } from 'react';
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
import {
  loadReminderEvents,
  type ReminderEvent,
} from '../hooks/useReminderChecker';

// Không cần tạo socket mới nữa, đã import từ utils/socket.ts
const API = 'http://localhost:5000/api';

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
    <div
      className="flex items-center gap-3 px-3 py-2.5 min-w-[280px] max-w-[400px]"
      onClick={(e) => e.stopPropagation()}
    >
      {getFileIcon(fileName)}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-[14px] truncate mb-0.5 ${isMine ? 'text-gray-900' : 'text-gray-900'}`}>{fileName}</p>
        <div className={`text-[12px] ${isMine ? 'text-gray-500' : 'text-gray-500'}`}>
          <span>{fileSize ? formatFileSize(fileSize) : 'Đang tải...'}</span>
        </div>
      </div>
      <button
        onClick={handleDownload}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isMine ? 'bg-blue-100 hover:bg-blue-200 text-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
        title="Tải xuống"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
      </button>
    </div>
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

const ChatWindow = ({ selectedChat, user, onStartVideoCall }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
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
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showReminder, setShowReminder] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [isBlockingOrUnblocking, setIsBlockingOrUnblocking] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [chatImages, setChatImages] = useState<{ url: string; timestamp: string; messageID?: string }[]>([]);

  const [reminderEvents, setReminderEvents] = useState<ReminderEvent[]>([]);

  const [typingUsers, setTypingUsers] = useState<{ userID: string; userName: string }[]>([]);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [seenMap, setSeenMap] = useState<
    Record<string, { userID: string; userName: string; avatar?: string | null; readAt: string }[]>
  >({});

  const [showOtherProfile, setShowOtherProfile] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<unknown | null>(null);

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

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    // Load all images from chat
    const images = (selectedChat.lastMessage || [])
      .filter((m) => m.type === 'image' && m.media_url?.length)
      .map((m) => ({
        url: typeof m.media_url![0] === 'string' ? m.media_url![0] : '',
        timestamp: m.timestamp,
        messageID: m.messageID,
      }));
    setChatImages(images);

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

        // Check stranger status
        fetch(`${API}/contacts/friend-status/${otherId}`, {
          headers: { ...authHeaders() },
        })
          .then((r) => r.json())
          .then((d) => {
            setIsStranger(d.friendStatus === 'none');
            setMemberInfo(prev => prev?.userID === otherId ? { ...prev, friendStatus: d.friendStatus } : prev);
          })
          .catch(() => setIsStranger(false));
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

    // Setup socket listeners
    const onNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (
          prev.find((m) => m.messageID === msg.messageID || (msg.tempID && m.tempID === msg.tempID))
        ) {
          return prev.map((m) => (m.tempID === msg.tempID ? { ...m, ...msg } : m));
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

    socket.on('new_message', onNewMessage);
    socket.on(chatID, onNewMessage);
    socket.on('unsend_notification', onUnsend);
    socket.on('message_deleted_local', onMessageDeletedLocal);
    socket.on('ghim_notification', onGhim);
    socket.on('unghim_notification', onUnghim);
    socket.on(`status_update_${chatID}`, onStatusUpdate);
    socket.on('friend_status_update', onUpdateUser);

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

    const onReminderEvent = (data: ReminderEvent) => {
      if (data.chatID !== chatID) return;
      // Just update state, data is already saved in database via API
      setReminderEvents((prev) => {
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
      socket.off('friend_status_update', onUpdateUser);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_seen', onMessageSeen);
      socket.off('bulk_seen', onBulkSeen);
      socket.off('reminder_event', onReminderEvent);
      socket.off('call-system-message', onCallSystemMessage);
      socket.off('friend_request_accepted', onFriendAccepted);
      setTypingUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.chatID, user?.userID]);

  // Cleanup loop debug log


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

  const sendText = () => {
    if (!inputText.trim() || !selectedChat || !user) return;
    socket.emit('typing_stop', {
      chatID: selectedChat.chatID,
      userID: user.userID,
      userName: user.name,
    });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    const msg = buildMsg({ content: inputText, type: 'text', media_url: [] });
    socket.emit('send_message', msg);
    setMessages((prev) => [...prev, msg]);
    setInputText('');
    setReplyTo(null);
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
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
  };

  const sendGif = async (gifUrl: string) => {
    if (!selectedChat || !user) return;
    const msg = buildMsg({ content: '', type: 'gif', media_url: [gifUrl] });
    socket.emit('send_message', msg);
    setMessages((prev) => [...prev, msg]);
    setShowEmoji(false);
    setReplyTo(null);
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
          const msg = buildMsg({ content: '', type, media_url: data.urls });
          socket.emit('send_message', msg);
          setMessages((prev) => [...prev, msg]);
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

        // Gửi từng ảnh/video/file riêng biệt với delay nhỏ để tránh race condition
        if (type === 'image' || type === 'video') {
          // Mỗi ảnh/video là một tin nhắn riêng
          for (let i = 0; i < data.urls.length; i++) {
            const url = data.urls[i];
            const msg = buildMsg({ content: '', type, media_url: [url] });

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

    console.log('🔄 Unsending message:', { messageID: msg.messageID, chatID: selectedChat!.chatID });

    // Cập nhật UI ngay lập tức (optimistic update)
    setMessages((prev) =>
      prev.map((m) =>
        m.messageID === msg.messageID
          ? { ...m, type: 'unsend', content: '', media_url: [] }
          : m
      )
    );

    // Gửi socket event
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

    // Xóa tin nhắn khỏi UI ngay lập tức (optimistic update)
    setMessages((prev) => prev.filter((m) => m.messageID !== msg.messageID));
    setPinnedMessages((prev) => prev.filter((m) => m.messageID !== msg.messageID));

    // Gửi socket event để lưu vào database
    socket.emit('delete_message_local', {
      messageID: msg.messageID,
      userID: user.userID,
      chatID: selectedChat!.chatID,
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

  const handleSearch = async () => {
    if (!searchKeyword.trim() || !selectedChat) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(
        `${API}/messages/search?chatID=${selectedChat.chatID}&keyword=${encodeURIComponent(searchKeyword.trim())}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      const results: typeof searchResults = (data as Message[]).map((m) => ({
        type: 'message',
        content: m.content,
        timestamp: m.timestamp,
        messageID: m.messageID,
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
      const url = typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '';
      const imageIndex = chatImages.findIndex((img) => img.url === url);

      return (
        <img
          src={url}
          alt="img"
          className="max-w-[400px] max-h-[400px] w-auto h-auto object-contain cursor-pointer rounded-lg hover:opacity-90 transition-opacity"
          onClick={() => {
            if (imageIndex !== -1) {
              setImageViewerIndex(imageIndex);
              setShowImageViewer(true);
            }
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
    | { kind: 'reminder'; data: (typeof reminderEvents)[0]; key: string; ts: number };

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({
      kind: 'message' as const,
      data: m,
      key: `msg_${m.messageID || m.tempID || m._id || Math.random().toString()}`,
      ts: new Date(m.timestamp).getTime(),
    })),
    ...reminderEvents.map((e) => ({
      kind: 'reminder' as const,
      data: e,
      key: `reminder_${e.eventID}`,
      ts: new Date(e.createdAt).getTime(),
    })),
  ].sort((a, b) => a.ts - b.ts);

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
                    if (selectedChat.type === 'private' && memberInfo) {
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
                      <FaUserFriends className="text-[10px]" /> Không có nhóm chung
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

                {/* Nút thông tin hội thoại */}
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
              </div>
            </div>

            {/* Stranger banner */}
            {isStranger && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <FaUserFriends className="text-gray-400 text-base shrink-0" />
                {friendRequestSent ? (
                  <span className="flex-1 text-[13px] text-gray-500">
                    Bạn đã gửi yêu cầu kết bạn và đang chờ người này đồng ý
                  </span>
                ) : (
                  <>
                    <span className="flex-1 text-[13px] text-gray-500">Gửi yêu cầu kết bạn tới người này</span>
                    <button
                      disabled={isSendingFriendRequest}
                      onClick={async () => {
                        if (!memberInfo?.sdt) return;
                        setIsSendingFriendRequest(true);
                        try {
                          const res = await fetch(`${API}/contacts/send-friend-request`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authHeaders() },
                            body: JSON.stringify({ recipientPhone: memberInfo.sdt }),
                          });
                          if (res.ok) {
                            setFriendRequestSent(true);
                          } else {
                            const d = await res.json();
                            toast.error(d.message || 'Không thể gửi lời mời');
                          }
                        } catch {
                          toast.error('Lỗi kết nối');
                        } finally {
                          setIsSendingFriendRequest(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#0068ff] text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50"
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
            <div className="flex-1 px-4 py-3 overflow-y-auto flex flex-col gap-1 bg-[#eef0f3] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded">
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
                    className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 ${highlightedMsgId === msg.messageID ? 'bg-blue-200/50 rounded-xl px-1 -mx-1' : ''}`}
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

              {/* Typing indicator */}
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
                <div className="flex items-center justify-center p-4 bg-white border-t border-gray-100 gap-2.5">
                  <FaInfoCircle className="text-[#0068ff] text-[17px] shrink-0" />
                  <p className="text-[14px] text-gray-500 m-0">
                    Bỏ chặn để gửi tin nhắn tới người này.{" "}
                    <button
                      onClick={() => setShowUnblockConfirm(true)}
                      className="text-[#0068ff] font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer text-[14px]"
                    >
                      Bỏ chặn
                    </button>
                  </p>
                </div>
              ) : memberInfo?.friendStatus === 'blocked_by_other' ? (
                <div className="flex items-center justify-center p-6 bg-white border-t border-gray-100 gap-3">
                  <FaBan className="text-gray-400 text-[15px] shrink-0" />
                  <p className="text-[14px] text-gray-400 m-0 italic font-medium">
                    Xin lỗi! Bạn hiện không thể gửi tin nhắn tới người này.
                  </p>
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

                  {/* Text input row */}
                  <div className="flex items-center px-3 pb-2.5 pt-1 bg-white gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendText();
                        }
                      }}
                      placeholder="Nhập tin nhắn..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-[22px] outline-none text-sm bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#0068ff] focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,104,255,0.1)] transition-all"
                    />
                    <button
                      onClick={sendText}
                      disabled={!inputText.trim()}
                      className="w-9 h-9 flex items-center justify-center bg-[#0068ff] text-gray-900 rounded-full hover:bg-[#0077c2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 text-sm"
                    >
                      <FaPaperPlane />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Search panel */}
          {showSearch && (
            <div
              className="w-[280px] border-l border-gray-100 bg-white flex flex-col shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <h3 className="text-[14px] font-semibold text-gray-800 flex-1">
                  Tìm kiếm tin nhắn
                </h3>
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchResults([]);
                    setSearchKeyword('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="px-3 py-2 border-b border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Nhập từ khóa..."
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#0068ff] bg-gray-50 text-gray-800"
                  />
                  <button
                    onClick={handleSearch}
                    className="px-3 py-1.5 bg-[#0068ff] text-gray-900 rounded-lg text-sm hover:bg-[#0077c2] transition-colors"
                  >
                    Tìm
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center mt-8">
                    {searchKeyword ? 'Không tìm thấy kết quả' : 'Nhập từ khóa để tìm kiếm'}
                  </p>
                ) : (
                  searchResults.map((r, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl text-sm cursor-pointer border transition-colors ${r.messageID ? 'bg-gray-50 border-gray-100 hover:bg-blue-50 hover:border-[#0068ff]/30' : 'bg-gray-50 border-transparent'}`}
                      onClick={() => r.messageID && handleScrollToMessage(r.messageID)}
                    >
                      {r.type === 'message' && (
                        <p className="text-gray-700 text-[13px] leading-snug line-clamp-2">
                          {r.content
                            ?.split(new RegExp(`(${searchKeyword})`, 'gi'))
                            .map((part, j) =>
                              part.toLowerCase() === searchKeyword.toLowerCase() ? (
                                <mark
                                  key={j}
                                  className="bg-blue-200/50 text-gray-900 rounded px-0.5"
                                >
                                  {part}
                                </mark>
                              ) : (
                                part
                              )
                            )}
                        </p>
                      )}
                      {r.type === 'file' && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {r.name}
                        </a>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                        🕐 {new Date(r.timestamp).toLocaleString('vi-VN')}
                        {r.messageID && (
                          <span className="text-[#0068ff] ml-auto text-[10px]">Nhấn để xem</span>
                        )}
                      </p>
                    </div>
                  ))
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
      {showImageViewer && chatImages.length > 0 && (
        <ImageViewerModal
          images={chatImages}
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
            if (socket) {
              socket.emit('friend_status_update', {
                userID: String(memberInfo.userID),
                friendStatus: 'none',
                ownerID: String(user.userID)
              });
            }
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
