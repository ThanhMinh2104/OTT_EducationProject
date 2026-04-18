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
} from 'react-icons/fa';
import { BsPin, BsPinAngleFill } from 'react-icons/bs';
import { EmojiClickData } from 'emoji-picker-react';
import StickerEmojiPicker from './StickerEmojiPicker';
import ForwardMessageModal from './ForwardMessageModal';
import ImageViewerModal from './ImageViewerModal';
import ImageGrid from './ImageGrid';
import { getToken } from '../utils/auth';
import { AddMembersModal } from './AddMembersModal';
import GroupInfoPanel from './GroupInfoPanel';
import GroupManagementModal from './GroupManagementModal';
import EditGroupInfoModal from './EditGroupInfoModal';
import { groupMessages, isMessageGroup, MessageGroup } from '../utils/messageGrouping';

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
      <text x="22" y="34" textAnchor="middle" fill="white" fontSize={config.label.length > 2 ? "11" : "16"} fontWeight="bold" fontFamily="Arial, sans-serif">
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
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

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

      <span className={`text-xs font-medium shrink-0 ${isMine ? 'text-gray-600' : 'text-gray-700'}`}>
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

export const GroupChatWindow: React.FC<GroupChatWindowProps> = ({
  groupID,
  userID,
  onShowGroupInfo,
}) => {
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
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [chatImages, setChatImages] = useState<{ url: string; timestamp: string; messageID?: string }[]>([]);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showGroupInfoPanel, setShowGroupInfoPanel] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showEditGroupInfoModal, setShowEditGroupInfoModal] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
        settings: groupData.settings
      });
      
      setGroupInfo({
        groupID: groupData.groupID,
        name: groupData.name,
        avatar: groupData.avatar,
        description: groupData.description,
        ownerID: groupData.ownerID,
        members: groupData.members || [],
        memberCount: groupData.members?.length || 0,
        settings: groupData.settings, // ✅ THÊM SETTINGS VÀO ĐÂY!
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
      setMessages(messagesRes.data.messages || []);
      
      // Load pinned messages
      setPinnedMessages(
        (messagesRes.data.messages || []).filter((m: Message) => m.pinnedInfo && m.pinnedInfo.pinnedBy)
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

  const handleNewMessage = useCallback((message: Message) => {
    if (message.groupID === groupID) {
      setMessages((prev) => [...prev, message]);
    }
  }, [groupID]);

  const handleTypingStart = useCallback((data: { groupID: string; userID: string; userName: string }) => {
    if (data.groupID === groupID && data.userID !== userID) {
      setTypingUsers((prev) => new Map(prev).set(data.userID, data.userName));
    }
  }, [groupID, userID]);

  const handleTypingStop = useCallback((data: { groupID: string; userID: string }) => {
    if (data.groupID === groupID) {
      setTypingUsers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(data.userID);
        return newMap;
      });
    }
  }, [groupID]);

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

  const handleMessageDeletedLocal = useCallback((data: { messageID: string; userID: string }) => {
    // Chỉ xóa message khỏi UI của user hiện tại
    if (data.userID === userID) {
      setMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
      setPinnedMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
    }
  }, [userID]);

  const handleReactionUpdated = useCallback((data: { messageID: string; reactions: Array<{ userID: string; emoji: string }> }) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.messageID === data.messageID ? { ...msg, reactions: data.reactions } : msg
      )
    );
  }, []);

  const handlePinNotification = useCallback((data: any) => {
    console.log('📌 Pin notification received:', data);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.messageID === data.messageID ? { ...msg, pinnedInfo: data.pinnedInfo } : msg
      )
    );
    setPinnedMessages((prev) => {
      const exists = prev.find((m) => m.messageID === data.messageID);
      if (exists) return prev;
      return [...prev, data];
    });
  }, []);

  const handleUnpinNotification = useCallback((data: any) => {
    console.log('📌 Unpin notification received:', data);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.messageID === data.messageID ? { ...msg, pinnedInfo: null } : msg
      )
    );
    setPinnedMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
  }, []);

  useEffect(() => {
    fetchGroupData();
    
    // Monitor socket connection
    const handleConnect = () => {
      console.log('✅ Socket connected');
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
      socket.emit('leave_group', { groupID, userID });
    };
  }, [groupID, userID, fetchGroupData, handleNewMessage, handleTypingStart, handleTypingStop, handleMessageDeleted, handleUnsendNotification, handleMessageDeletedLocal, handleReactionUpdated, handlePinNotification, handleUnpinNotification]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    if (!socketConnected) {
      toast.error('Không có kết nối socket. Vui lòng tải lại trang.');
      return;
    }

    console.log('🚀 Sending group message:', {
      groupID,
      userID,
      content: inputText,
      socketConnected: socket.connected,
      socketRooms: Array.from((socket as any).rooms || []),
    });

    const message = {
      groupID,
      senderID: userID,
      content: inputText,
      type: 'text',
      media_url: [],
      replyTo: replyTo
        ? {
            messageID: replyTo.messageID,
            senderID: replyTo.senderID,
            content: replyTo.content,
            type: replyTo.type,
          }
        : undefined,
    };

    socket.emit('send_group_message', message, (response: any) => {
      if (response?.error) {
        console.error('❌ Send message error:', response.error);
        toast.error(response.error);
      } else {
        console.log('✅ Message sent successfully');
      }
    });
    
    console.log('✅ Message emitted via socket');
    
    setInputText('');
    setReplyTo(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('group_typing_stop', { groupID, userID });
  };

  const sendEmoji = (emojiData: EmojiClickData) => {
    setInputText((prev) => prev + emojiData.emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const sendSticker = async (stickerUrl: string) => {
    const message = {
      groupID,
      senderID: userID,
      content: '',
      type: 'sticker',
      media_url: [stickerUrl],
    };
    socket.emit('send_group_message', message);
    setShowEmoji(false);
    setReplyTo(null);
  };

  const sendGif = async (gifUrl: string) => {
    const message = {
      groupID,
      senderID: userID,
      content: '',
      type: 'gif',
      media_url: [gifUrl],
    };
    socket.emit('send_group_message', message);
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
        const groupId = type === 'image' && data.urls.length > 1 
          ? `img_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          : undefined;

        if (type === 'image' || type === 'video') {
          for (let i = 0; i < data.urls.length; i++) {
            const url = data.urls[i];
            const message = {
              groupID,
              senderID: userID,
              content: '',
              type,
              media_url: [url],
              groupId, // Thêm groupId để gom nhóm ảnh
            };
            socket.emit('send_group_message', message);
            if (i < data.urls.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } else {
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const message = {
              groupID,
              senderID: userID,
              content: f.name,
              type: 'file',
              media_url: [data.urls[i]],
            };
            socket.emit('send_group_message', message);
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

      const message = {
        groupID,
        senderID: userID,
        content: '',
        type: 'audio',
        media_url: [data.url],
      };
      socket.emit('send_group_message', message);
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
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handlePin = (msg: Message) => {
    if (!msg.messageID) return;
    
    if (msg.pinnedInfo) {
      // Unpin message
      console.log('📌 Unpinning message:', msg.messageID);
      socket.emit('unghim_group_message', { 
        messageID: msg.messageID, 
        groupID,
        senderID: userID
      });
    } else {
      // Check if already have 3 pinned messages
      if (pinnedMessages.length >= 3) {
        toast.error('Chỉ có thể ghim tối đa 3 tin nhắn');
        setActionMsgId(null);
        return;
      }
      
      // Pin message
      console.log('📌 Pinning message:', msg.messageID);
      socket.emit('ghim_group_message', {
        messageID: msg.messageID,
        groupID,
        senderID: userID
      });
    }
    
    setActionMsgId(null);
  };

  const handleUnsend = (msg: Message) => {
    console.log('🎯 handleUnsend called:', {
      messageID: msg.messageID,
      senderID: msg.senderID,
      userID: userID,
      match: msg.senderID === userID
    });

    if (!msg.messageID || msg.senderID !== userID) {
      console.log('❌ Cannot unsend: validation failed');
      toast.error('Bạn chỉ có thể thu hồi tin nhắn của mình');
      return;
    }

    // Tìm tất cả messages trong cùng group (nếu có)
    let messagesToUnsend: Message[] = [msg];
    if (msg.type === 'image' && msg.groupId) {
      messagesToUnsend = messages.filter(m => m.groupId === msg.groupId && m.senderID === userID);
      console.log(`📸 Unsending ${messagesToUnsend.length} images from group ${msg.groupId}`);
    }

    console.log('🔄 Unsending message(s):', messagesToUnsend.map(m => m.messageID));

    // Cập nhật UI ngay lập tức (optimistic update)
    setMessages((prev) =>
      prev.map((m) =>
        messagesToUnsend.some(unsend => unsend.messageID === m.messageID)
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
      messagesToDelete = messages.filter(m => m.groupId === msg.groupId);
      console.log(`📸 Deleting ${messagesToDelete.length} images from group ${msg.groupId}`);
    }

    // Xóa tin nhắn khỏi UI ngay lập tức (optimistic update)
    setMessages((prev) => prev.filter((m) => !messagesToDelete.some(del => del.messageID === m.messageID)));
    setPinnedMessages((prev) => prev.filter((m) => !messagesToDelete.some(del => del.messageID === m.messageID)));

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

  const handleInputChange = (value: string) => {
    setInputText(value);
    
    socket.emit('group_typing_start', {
      groupID,
      userID,
      userName: groupInfo?.members?.find((m) => m.userID === userID)?.name || 'User',
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('group_typing_stop', { groupID, userID });
    }, 2000);
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
      await axiosInstance.put(`/groups/${groupID}/members/${targetUserID}/role`, { role: 'member' });
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
        const response = await axiosInstance.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const message = {
          groupID,
          senderID: userID,
          content: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          media_url: [response.data.url],
        };

        socket.emit('send_group_message', message);
      } catch (error) {
        console.error('Error uploading file:', error);
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

  const groupAvatar = groupInfo?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupID}`;
  const typingUsersList = Array.from(typingUsers.values());

  // Kiểm tra quyền chỉnh sửa thông tin nhóm
  const currentMember = members.find(m => m.userID === userID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  const canEditGroupInfo = isOwner || isAdmin || 
    (groupInfo?.settings?.memberPermissions?.changeNameAvatar ?? true);

  // Kiểm tra quyền gửi tin nhắn
  const canSendMessages = isOwner || isAdmin || 
    (groupInfo?.settings?.memberPermissions?.sendMessages ?? true);

  console.log('🔐 Send message permission check:', {
    userID,
    role: currentMember?.role,
    isOwner,
    isAdmin,
    sendMessagesPermission: groupInfo?.settings?.memberPermissions?.sendMessages,
    canSendMessages
  });

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
                  toast('Tính năng gọi thoại nhóm đang phát triển');
                }}
                title="Gọi thoại"
                className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]"
              >
                <FaPhone />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast('Tính năng gọi video nhóm đang phát triển');
                }}
                title="Gọi video"
                className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]"
              >
                <FaVideo />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast('Tính năng tìm kiếm đang phát triển');
                }}
                title="Tìm kiếm"
                className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]"
              >
                <FaSearch />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMembersSidebar(!showMembersSidebar);
                }}
                title="Danh sách thành viên"
                className={`cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${
                  showMembersSidebar
                    ? 'bg-blue-50 text-[#0068ff]'
                    : 'text-gray-500 hover:bg-blue-50 hover:text-[#0068ff]'
                }`}
              >
                <FaUserFriends />
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

          {/* Pinned Messages Bar */}
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
                    setTimeout(() => setHighlightedMsgId(null), 2500);
                  }
                }}
              >
                <BsPinAngleFill className="text-[#0068ff] text-lg shrink-0" />
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
                    className="px-3 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg text-[12px] text-gray-700 font-medium transition-colors flex items-center gap-1"
                  >
                    +{pinnedMessages.length - 1} ghim
                    <svg
                      className={`w-3 h-3 transition-transform ${showPinnedList ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
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
                      <FaTimes />
                    </button>
                  </div>
                  {pinnedMessages.slice().reverse().map((msg) => (
                    <div
                      key={msg.messageID}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => {
                        if (msg.messageID) {
                          setHighlightedMsgId(msg.messageID);
                          msgRefsMap.current.get(msg.messageID)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                          });
                          setTimeout(() => setHighlightedMsgId(null), 2500);
                          setShowPinnedList(false);
                        }
                      }}
                    >
                      <img
                        src={msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`}
                        alt="avatar"
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-gray-800 mb-0.5">
                          {msg.senderInfo?.name}
                        </div>
                        <div className="text-[12px] text-gray-600 truncate">
                          {msg.content || '[Media]'}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePin(msg);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Bỏ ghim"
                      >
                        <FaTimes className="text-sm" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
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
                        (group.messages as any).some((msg: Message) => msg.messageID === highlightedMsgId) 
                          ? 'bg-blue-200/50 rounded-xl px-2 py-1 -mx-2 -my-1' 
                          : ''
                      }`}
                    >
                      {!isMine && (
                        <div className="relative flex-shrink-0 mr-2">
                          <img
                            src={firstMsg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.senderID}`}
                            alt="avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        </div>
                      )}

                      <div className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
                        {!isMine && (
                          <span className="text-xs text-gray-500 mb-1 font-semibold px-1">
                            {firstMsg.senderInfo?.name}
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
                              onClick={() => setReplyTo(firstMsg as any)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                              title="Trả lời"
                            >
                              <FaReply className="text-xs" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMsgId(actionMsgId === firstMsg.messageID ? null : (firstMsg.messageID || null));
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
                                onClick={() => handleForwardMessage(firstMsg as any)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <FaForward className="text-xs" />
                                Chuyển tiếp
                              </button>
                              <button
                                onClick={() => handlePin(firstMsg as any)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <BsPin className="text-xs" />
                                {firstMsg.pinnedInfo ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                              </button>
                              {isMine && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleDeleteLocal(firstMsg as any);
                                      setActionMsgId(null);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-orange-500 hover:bg-orange-50 transition-colors"
                                  >
                                    <FaTrash className="text-xs" />
                                    Xóa phía tôi
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleUnsend(firstMsg as any);
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
                const msg = item as any as Message;
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
                    className={`flex mb-3 ${isMine ? 'justify-end' : 'justify-start'} transition-all duration-300 ${
                      highlightedMsgId === msg.messageID ? 'bg-blue-200/50 rounded-xl px-2 py-1 -mx-2 -my-1' : ''
                    }`}
                  >
                    {!isMine && (
                      <div className="relative flex-shrink-0 mr-2">
                        <img
                          src={msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`}
                          alt="avatar"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      </div>
                    )}

                    <div className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
                      {!isMine && (
                        <span className="text-xs text-gray-500 mb-1 font-semibold px-1">
                          {msg.senderInfo?.name}
                        </span>
                      )}

                      <div className="relative group">
                        <div
                          className={`${
                            msg.type === 'notification'
                              ? 'bg-transparent'
                              : msg.type === 'sticker' || msg.type === 'gif'
                                ? ''
                                : isMine
                                  ? 'bg-[#e3f2ff] text-gray-800 border border-[#d1e9ff]'
                                  : 'bg-white text-gray-800 border border-gray-100'
                          } ${
                            msg.type === 'image' || msg.type === 'video' || msg.type === 'sticker' || msg.type === 'gif'
                              ? 'p-0 rounded-2xl overflow-hidden'
                              : msg.type === 'file'
                                ? 'rounded-2xl'
                                : 'px-4 py-2.5 rounded-2xl'
                          } ${msg.type !== 'notification' && msg.type !== 'sticker' && msg.type !== 'gif' ? 'shadow-sm' : ''} ${isMine && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'sticker' && msg.type !== 'gif' ? 'rounded-br-sm' : ''} ${!isMine && msg.type !== 'image' && msg.type !== 'video' && msg.type !== 'sticker' && msg.type !== 'gif' ? 'rounded-bl-sm' : ''}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                        {msg.replyTo && (
                          <div 
                            className={`text-xs mb-2 pb-2 border-b cursor-pointer hover:bg-gray-50/50 -mx-2 px-2 py-1 rounded transition-colors ${isMine ? 'border-blue-400/30' : 'border-gray-200'}`}
                            onClick={() => {
                              if (msg.replyTo?.messageID) {
                                setHighlightedMsgId(msg.replyTo.messageID);
                                msgRefsMap.current.get(msg.replyTo.messageID)?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'center',
                                });
                                setTimeout(() => setHighlightedMsgId(null), 2500);
                              }
                            }}
                          >
                            <span className={`font-semibold ${isMine ? 'text-blue-600' : 'text-gray-700'}`}>
                              Trả lời {msg.replyTo.senderID === userID ? 'chính mình' : 'tin nhắn'}
                            </span>
                            <div className={`mt-0.5 ${isMine ? 'text-gray-600' : 'text-gray-500'}`}>
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
                                  <FaPaperclip className="text-[10px]" /> {msg.replyTo.content || 'File'}
                                </span>
                              ) : msg.replyTo.type === 'sticker' ? (
                                <span>Sticker</span>
                              ) : (
                                <span>{msg.replyTo.content}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {msg.type === 'notification' ? (
                          <span className="text-xs text-gray-500 italic">{msg.content}</span>
                        ) : msg.type === 'image' && msg.media_url?.length ? (
                          <img
                            src={msg.media_url[0]}
                            alt="img"
                            className="max-w-[400px] max-h-[400px] w-auto h-auto object-contain cursor-pointer rounded-lg hover:opacity-90 transition-opacity"
                            onClick={() => {
                              const imageIndex = chatImages.findIndex((img) => img.url === msg.media_url[0]);
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
                          <video src={msg.media_url[0]} controls className="max-w-[280px] rounded-lg" />
                        ) : msg.type === 'audio' && msg.media_url?.length ? (
                          <AudioPlayer src={msg.media_url[0]} isMine={isMine} />
                        ) : msg.type === 'file' && msg.media_url?.length ? (
                          <FileDisplay fileName={msg.content || 'file'} fileUrl={msg.media_url[0]} isMine={isMine} />
                        ) : (
                          <span className="text-sm whitespace-pre-wrap break-words">{msg.content}</span>
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
                                isMine ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'
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
                                onClick={() => setReplyTo(msg)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 text-gray-600"
                                title="Trả lời"
                              >
                                <FaReply className="text-xs" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMsgId(actionMsgId === msg.messageID ? null : msg.messageID);
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
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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

            {/* Text input */}
            {canSendMessages && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Nhập tin nhắn..."
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0068ff]/20 transition-all"
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isUploading}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[#0068ff] text-white hover:bg-[#0077c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Gửi"
                >
                  <FaPaperPlane className="text-sm" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Group Info Panel */}
        {showGroupInfoPanel && groupInfo && (
          <GroupInfoPanel
            groupInfo={groupInfo}
            currentUserID={userID}
            messages={messages as any}
            onClose={() => setShowGroupInfoPanel(false)}
            onAddMembers={() => {
              setShowAddMembersModal(true);
              setShowGroupInfoPanel(false);
            }}
            onManageGroup={() => {
              setShowManagementModal(true);
              setShowGroupInfoPanel(false);
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

            {/* Nút thêm thành viên */}
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

            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">Danh sách thành viên ({members.length})</p>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {members.map((member) => {
                const currentUserMember = members.find(m => m.userID === userID);
                const currentUserRole = currentUserMember?.role;
                const canManage = currentUserRole === 'owner' || 
                  (currentUserRole === 'admin' && member.role === 'member');
                
                return (
                  <div
                    key={member.userID}
                    className="relative flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <img
                      src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userID}`}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 m-0 truncate">{member.name}</p>
                      <p
                        className={`text-xs m-0 ${
                          member.role === 'owner'
                            ? 'text-red-500 font-semibold'
                            : member.role === 'admin'
                              ? 'text-orange-500 font-semibold'
                              : 'text-gray-500'
                        }`}
                      >
                        {member.role === 'owner' ? 'Trưởng nhóm' : member.role === 'admin' ? 'Phó nhóm' : 'Thành viên'}
                      </p>
                    </div>
                    
                    {/* Context menu button - chỉ hiện với member có thể quản lý và không phải chính mình */}
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

                    {/* Context Menu */}
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
      </div>

      {/* Forward Message Modal */}
      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage as any}
          onClose={() => setForwardingMessage(null)}
          user={{ userID, name: groupInfo?.members?.find(m => m.userID === userID)?.name || 'User' } as any}
        />
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && (
        <ImageViewerModal
          images={chatImages}
          initialIndex={imageViewerIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Add Members Modal */}
      {showAddMembersModal && (
        <AddMembersModal
          groupID={groupID}
          onClose={() => setShowAddMembersModal(false)}
          onSuccess={() => {
            fetchGroupData();
            toast.success('Đã thêm thành viên vào nhóm');
          }}
        />
      )}

      {/* Group Management Modal */}
      {showManagementModal && groupInfo && (
        <GroupManagementModal
          groupInfo={groupInfo}
          currentUserID={userID}
          onClose={() => {
            setShowManagementModal(false);
            fetchGroupData(); // Fetch lại data khi đóng modal
          }}
          onUpdate={() => {
            fetchGroupData();
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
        />
      )}

      {/* Edit Group Info Modal */}
      {showEditGroupInfoModal && groupInfo && (
        <EditGroupInfoModal
          groupID={groupInfo.groupID}
          currentName={groupInfo.name}
          currentAvatar={groupInfo.avatar}
          onClose={() => setShowEditGroupInfoModal(false)}
          onSuccess={() => {
            fetchGroupData();
            toast.success('Đã cập nhật thông tin nhóm');
          }}
        />
      )}
    </div>
  );
};
