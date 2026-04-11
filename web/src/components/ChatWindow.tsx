import { useState, useEffect, useRef } from 'react';
import {
  FaComments, FaPaperPlane, FaSmile, FaPaperclip, FaTimes,
  FaReply, FaTrash, FaThumbsUp, FaDownload, FaInfoCircle,
  FaSearch, FaImage, FaVideo, FaMicrophone,
  FaStop, FaBell,
} from 'react-icons/fa';
import { BsPin, BsPinAngleFill } from 'react-icons/bs';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../utils/auth';
import ReminderModal from './ReminderModal';
import ChatInfoPanel from './ChatInfoPanel';
import { loadReminderEvents, saveReminderEvent, type ReminderEvent } from '../hooks/useReminderChecker';

const socket: Socket = io('http://localhost:5000');
const API = 'http://localhost:5000/api';

interface Member { userID: string; role: string }
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
}
interface Props {
  selectedChat: Chat | null;
  user: User | null;
  onStartVideoCall?: () => void;
}

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatTime = (ts: string) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
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
  const [showInfo, setShowInfo] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: string; content?: string; url?: string; name?: string; timestamp: string; messageID?: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const msgRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showReminder, setShowReminder] = useState(false);

  // Reminder system messages hiển thị trong chat — persist qua localStorage
  const [reminderEvents, setReminderEvents] = useState<ReminderEvent[]>([]);

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<{ userID: string; userName: string }[]>([]);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read receipts: messageID -> list of readers
  const [seenMap, setSeenMap] = useState<Record<string, { userID: string; userName: string; avatar?: string | null; readAt: string }[]>>({});

  // Ghi âm
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages + socket setup khi đổi chat
  useEffect(() => {
    if (!selectedChat || !user) return;

    const chatID = selectedChat.chatID;
    const userID = user.userID;

    // Reset state
    setMessages(selectedChat.lastMessage || []);
    setPinnedMessages((selectedChat.lastMessage || []).filter((m) => m.pinnedInfo));
    setReplyTo(null);
    setFiles([]);
    setInputText('');
    setTypingUsers([]);
    setSeenMap({});
    setReminderEvents(loadReminderEvents(selectedChat.chatID));
    msgRefsMap.current.clear();
    setHighlightedMsgId(null);

    // Join rooms
    socket.emit('join_user', userID);
    socket.emit('join_chat', chatID);
    socket.emit('read_messages', { chatID, userID });

    // Fetch member info cho private chat
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
          .catch(() => {});
      }
    }

    const onNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (prev.find((m) => m.messageID === msg.messageID || (msg.tempID && m.tempID === msg.tempID))) {
          return prev.map((m) => (m.tempID === msg.tempID ? { ...m, ...msg } : m));
        }
        return [...prev, msg];
      });
      if (msg.senderID !== userID) {
        socket.emit('read_messages', { chatID, userID });
      }
    };

    const onUnsend = (updated: Message) => {
      setMessages((prev) => prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m)));
    };

    const onGhim = (updated: Message) => {
      setMessages((prev) => prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m)));
      setPinnedMessages((prev) => {
        const exists = prev.find((m) => m.messageID === updated.messageID);
        return exists ? prev.map((m) => (m.messageID === updated.messageID ? updated : m)) : [...prev, updated];
      });
    };

    const onUnghim = (updated: Message) => {
      setMessages((prev) => prev.map((m) => (m.messageID === updated.messageID ? { ...m, pinnedInfo: null } : m)));
      setPinnedMessages((prev) => prev.filter((m) => m.messageID !== updated.messageID));
    };

    const onStatusUpdate = ({ messageID, status }: { messageID?: string; status: string }) => {
      if (messageID) {
        setMessages((prev) => prev.map((m) => (m.messageID === messageID ? { ...m, status } : m)));
      }
    };

    const onUpdateUser = (updatedUser: User) => {
      setMemberInfo((prev) => (prev?.userID === updatedUser.userID ? updatedUser : prev));
    };

    socket.on('new_message', onNewMessage);
    socket.on(chatID, onNewMessage);
    socket.on('unsend_notification', onUnsend);
    socket.on('ghim_notification', onGhim);
    socket.on('unghim_notification', onUnghim);
    socket.on(`status_update_${chatID}`, onStatusUpdate);
    socket.on('updatee_user', onUpdateUser);

    // Typing events
    const onTypingStart = ({ chatID: evtChatID, userID: uid, userName }: { chatID: string; userID: string; userName: string }) => {
      if (uid === userID || evtChatID !== chatID) return;
      setTypingUsers((prev) => prev.find((u) => u.userID === uid) ? prev : [...prev, { userID: uid, userName }]);
    };
    const onTypingStop = ({ chatID: evtChatID, userID: uid }: { chatID: string; userID: string }) => {
      if (evtChatID !== chatID) return;
      setTypingUsers((prev) => prev.filter((u) => u.userID !== uid));
    };

    // Read receipts
    const onMessageSeen = (data: { chatID: string; messageID: string; userID: string; userName: string; avatar?: string | null; readAt: string }) => {
      if (data.chatID !== chatID) return;
      setSeenMap((prev) => {
        const existing = prev[data.messageID] || [];
        if (existing.find((r) => r.userID === data.userID)) return prev;
        return { ...prev, [data.messageID]: [...existing, { userID: data.userID, userName: data.userName, avatar: data.avatar, readAt: data.readAt }] };
      });
    };
    const onBulkSeen = (data: { chatID: string; userID: string; userName: string; avatar?: string | null; readAt: string; messageIDs: string[] }) => {
      if (data.chatID !== chatID) return;
      setSeenMap((prev) => {
        const next = { ...prev };
        data.messageIDs.forEach((mid) => {
          const existing = next[mid] || [];
          if (!existing.find((r) => r.userID === data.userID)) {
            next[mid] = [...existing, { userID: data.userID, userName: data.userName, avatar: data.avatar, readAt: data.readAt }];
          }
        });
        return next;
      });
    };

    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);
    socket.on('message_seen', onMessageSeen);
    socket.on('bulk_seen', onBulkSeen);

    // Lắng nghe reminder_event từ người khác trong chat
    const onReminderEvent = (data: ReminderEvent) => {
      if (data.chatID !== chatID) return;
      // Lưu vào localStorage của người nhận
      saveReminderEvent(data);
      setReminderEvents((prev) => {
        // Tránh duplicate
        if (prev.find((e) => e.id === data.id)) return prev;
        return [...prev, data];
      });
    };
    socket.on('reminder_event', onReminderEvent);

    // Bulk seen khi mở chat
    if (user) {
      socket.emit('bulk_seen', { chatID, userID, userName: user.name, avatar: user.anhDaiDien || null });
    }

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off(chatID, onNewMessage);
      socket.off('unsend_notification', onUnsend);
      socket.off('ghim_notification', onGhim);
      socket.off('unghim_notification', onUnghim);
      socket.off(`status_update_${chatID}`, onStatusUpdate);
      socket.off('updatee_user', onUpdateUser);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_seen', onMessageSeen);
      socket.off('bulk_seen', onBulkSeen);
      socket.off('reminder_event', onReminderEvent);
      setTypingUsers([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.chatID, user?.userID]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildMsg = (extra: Partial<Message>): Message => ({
    tempID: Date.now().toString(),
    chatID: selectedChat!.chatID,
    senderID: user!.userID,
    timestamp: new Date().toISOString(),
    status: 'sent',
    senderInfo: { name: user!.name, avatar: user!.anhDaiDien || null },
    replyTo: replyTo
      ? { messageID: replyTo.messageID, senderID: replyTo.senderID, content: replyTo.content, type: replyTo.type, media_url: replyTo.media_url }
      : null,
    ...extra,
  } as Message);

  const sendText = () => {
    if (!inputText.trim() || !selectedChat || !user) return;
    // Dừng typing khi gửi
    socket.emit('typing_stop', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
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
    // Emit typing_start, debounce typing_stop
    socket.emit('typing_start', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    }, 2000);
  };

  const sendEmoji = (emojiData: EmojiClickData) => {
    if (!selectedChat || !user) return;
    const msg = buildMsg({ content: emojiData.emoji, type: 'emoji', media_url: [] });
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

  const handleUnsend = (msg: Message) => {
    if (!msg.messageID || msg.senderID !== user?.userID) return;
    socket.emit('unsend_message', { messageID: msg.messageID, chatID: selectedChat!.chatID, senderID: user!.userID });
    setActionMsgId(null);
  };

  const handlePin = (msg: Message) => {
    if (!msg.messageID) return;
    if (msg.pinnedInfo) {
      socket.emit('unghim_message', { messageID: msg.messageID, chatID: selectedChat!.chatID });
    } else {
      socket.emit('ghim_message', { messageID: msg.messageID, chatID: selectedChat!.chatID, senderID: user!.userID });
    }
    setActionMsgId(null);
  };

  const handleForward = (msg: Message) => {
    if (msg.content) setInputText(msg.content);
    setActionMsgId(null);
    inputRef.current?.focus();
  };

  // Ghi âm
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
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
      form.append('files', audioBlob, 'voice-message.webm');
      const res = await fetch(`${API}/upload`, { method: 'POST', headers: authHeaders(), body: form });
      const data = await res.json();
      const msg = buildMsg({ content: '', type: 'audio', media_url: data.urls });
      socket.emit('send_message', msg);
      setMessages((prev) => [...prev, msg]);
      setAudioBlob(null);
      setRecordingTime(0);
      setReplyTo(null);
    } catch { alert('Lỗi gửi audio'); }
    finally { setIsUploading(false); }
  };

  const formatRecordTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSearch = async () => {
    if (!searchKeyword.trim() || !selectedChat) { setSearchResults([]); return; }
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

  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'unsend') {
      return <span className="italic text-gray-400 text-sm">Tin nhắn đã bị thu hồi</span>;
    }
    if (msg.type === 'notification') {
      return <span className="text-xs text-gray-500 italic">{msg.content}</span>;
    }
    if (msg.type === 'image' && msg.media_url?.length) {
      return (
        <div className="flex flex-wrap gap-1 max-w-[280px]">
          {msg.media_url.map((url, i) => (
            <img key={i} src={url} alt="img" className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer" onClick={() => window.open(url, '_blank')} />
          ))}
        </div>
      );
    }
    if (msg.type === 'video' && msg.media_url?.length) {
      return <video src={typeof msg.media_url[0] === 'string' ? msg.media_url[0] : ''} controls className="max-w-[280px] rounded-lg" />;
    }
    if (msg.type === 'audio' && msg.media_url?.length) {
      return <audio src={typeof msg.media_url[0] === 'string' ? msg.media_url[0] : ''} controls className="max-w-[260px]" />;
    }
    if (msg.type === 'file' && msg.media_url?.length) {
      const url = typeof msg.media_url[0] === 'string' ? msg.media_url[0] : '';
      return (
        <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <FaDownload className="text-xs" />
          {msg.content || 'Tải file'}
        </a>
      );
    }
    return <span className="text-sm whitespace-pre-wrap break-words">{msg.content}</span>;
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gray-100 dark:bg-gray-800">
        <div className="flex-1 flex flex-col justify-center items-center gap-4 bg-linear-to-br from-blue-50 to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <div className="w-20 h-20 bg-linear-to-br from-[#0e9de8] to-[#0077c2] rounded-full flex items-center justify-center text-white text-4xl shadow-[0_4px_16px_rgba(14,157,232,0.35)]">
            <FaComments />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0">Chào mừng, {user?.name}!</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 m-0">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
        </div>
      </div>
    );
  }

  const chatName = selectedChat.type === 'private' ? (memberInfo?.name || selectedChat.name) : selectedChat.name;
  const chatAvatar = selectedChat.type === 'private'
    ? (memberInfo?.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + memberInfo?.userID)
    : (selectedChat.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + selectedChat.chatID);

  // Merge messages + reminder events thành timeline chung, sort theo thời gian
  type TimelineItem =
    | { kind: 'message'; data: Message; key: string }
    | { kind: 'reminder'; data: typeof reminderEvents[0]; key: string };

  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({
      kind: 'message' as const,
      data: m,
      key: m.messageID || m.tempID || m._id || Math.random().toString(),
      ts: new Date(m.timestamp).getTime(),
    })),
    ...reminderEvents.map((e) => ({
      kind: 'reminder' as const,
      data: e,
      key: e.id,
      ts: new Date(e.createdAt).getTime(),
    })),
  ].sort((a, b) => a.ts - b.ts);

  return (
    <>
    <div className="flex-1 flex flex-col h-screen bg-gray-100 dark:bg-gray-800" onClick={() => { setActionMsgId(null); setShowEmoji(false); }}>
      <div className="flex-1 flex w-full h-full overflow-hidden">
        <div className="flex-1 h-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-[0_1px_4px_rgba(0,0,0,0.05)] flex-shrink-0">
            <img src={chatAvatar} alt="avatar" className="w-[42px] h-[42px] rounded-full object-cover mr-3 border-2 border-blue-100 dark:border-blue-800" />
            <div className="flex-1">
              <h2 className="text-[15px] font-bold m-0 mb-0.5 text-gray-900 dark:text-gray-100">{chatName}</h2>
              <p className="text-xs text-gray-400 m-0">
                {memberInfo?.trangThai === 'online'
                  ? <span className="text-green-500">● Đang hoạt động</span>
                  : <span>● Ngoại tuyến</span>}
              </p>
            </div>
            {/* Nút tìm kiếm */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowSearch((v) => !v); setShowInfo(false); }}
              title="Tìm kiếm"
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${showSearch ? 'bg-blue-50 text-[#0e9de8]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#0e9de8]'}`}
            >
              <FaSearch />
            </button>
            {/* Nút thông tin hội thoại */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowInfo((v) => !v); setShowSearch(false); }}
              title="Thông tin hội thoại"
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${showInfo ? 'bg-blue-50 text-[#0e9de8]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#0e9de8]'}`}
            >
              <FaInfoCircle />
            </button>
          </div>

          {/* Pinned messages bar */}
          {pinnedMessages.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-100 dark:border-yellow-800 flex-shrink-0">
              <BsPinAngleFill className="text-yellow-500 text-sm flex-shrink-0" />
              <span className="text-xs text-yellow-700 dark:text-yellow-400 truncate flex-1">
                {pinnedMessages[pinnedMessages.length - 1]?.content || '[Media]'}
              </span>
              <span className="text-xs text-yellow-500">{pinnedMessages.length} tin nhắn đã ghim</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 px-4 py-3 overflow-y-auto flex flex-col gap-1 bg-[#e8edf2] dark:bg-gray-800 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded">
            {timeline.map((item) => {
              // ── Reminder event ──────────────────────────────────────────
              if (item.kind === 'reminder') {
                const evt = item.data;
                return (
                  <div key={item.key} className="flex flex-col items-center gap-2 my-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-gray-700/80 rounded-full text-[12px] text-gray-500 dark:text-gray-400 shadow-sm">
                      <span className="text-red-400">🔔</span>
                      {evt.type === 'created' ? (
                        <span>
                          <strong className="text-gray-700 dark:text-gray-200">
                            {evt.userID === user?.userID ? 'Bạn' : evt.userName}
                          </strong> tạo nhắc hẹn mới <strong className="text-gray-700 dark:text-gray-200">{evt.reminder.title}</strong>
                          {' - '}{(() => { const d = new Date(evt.reminder.datetime); const days = ['CN','T2','T3','T4','T5','T6','T7']; return `${days[d.getDay()]}, ${d.getDate()} Tháng ${d.getMonth()+1} lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
                          {' . '}
                          <button onClick={() => setShowReminder(true)} className="text-[#0e9de8] hover:underline font-medium">Xem</button>
                        </span>
                      ) : (
                        <span>
                          <strong className="text-gray-700 dark:text-gray-200">
                            {evt.userID === user?.userID ? 'Bạn' : evt.userName}
                          </strong> xóa nhắc hẹn <strong className="text-gray-700 dark:text-gray-200">{evt.reminder.title}</strong>
                          {' . '}
                          <button onClick={() => setShowReminder(true)} className="text-[#0e9de8] hover:underline font-medium">Tạo mới</button>
                        </span>
                      )}
                    </div>
                    {evt.type === 'created' && (
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 w-[280px] flex flex-col items-center gap-2 shadow-sm">
                        <span className="text-2xl">🔔</span>
                        <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100 text-center m-0">{evt.reminder.title}</p>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 flex items-center gap-1 m-0">
                          🕐 {(() => { const d = new Date(evt.reminder.datetime); const days = ['CN','T2','T3','T4','T5','T6','T7']; return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} lúc ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
                        </p>
                        <button
                          onClick={() => setShowReminder(true)}
                          className="w-full mt-1 py-2 border-2 border-[#0e9de8] text-[#0e9de8] rounded-xl text-[13px] font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
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
              const msgKey = item.key;

              if (isNotif) {
                return (
                  <div key={msgKey} className="flex justify-center my-1">
                    <span className="text-xs text-gray-500 bg-white/70 dark:bg-gray-700/70 px-3 py-1 rounded-full">{msg.content}</span>
                  </div>
                );
              }

              return (
                <div
                  key={msgKey}
                  ref={(el) => {
                    if (el && msg.messageID) msgRefsMap.current.set(msg.messageID, el);
                  }}
                  className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 ${highlightedMsgId === msg.messageID ? 'bg-yellow-100/60 dark:bg-yellow-900/30 rounded-xl px-1 -mx-1' : ''}`}
                >
                  {/* Avatar */}
                  {!isMine && (
                    <img
                      src={msg.senderInfo?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.senderID}
                      alt="av"
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1"
                    />
                  )}

                  <div className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* Sender name (group) */}
                    {!isMine && selectedChat.type === 'group' && (
                      <span className="text-[11px] text-gray-500 mb-0.5 ml-1">{msg.senderInfo?.name}</span>
                    )}

                    {/* Reply preview */}
                    {msg.replyTo?.content && (
                      <div className={`text-xs px-2 py-1 rounded-t-lg border-l-2 border-[#0e9de8] bg-gray-100 dark:bg-gray-700 text-gray-500 max-w-full truncate mb-0.5 ${isMine ? 'self-end' : 'self-start'}`}>
                        <FaReply className="inline mr-1 text-[10px]" />
                        {msg.replyTo.content}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className="relative">
                      <div
                        className={`px-3 py-2 rounded-2xl shadow-sm cursor-pointer select-text ${
                          isMine
                            ? 'bg-[#0e9de8] text-white rounded-br-sm'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
                        } ${msg.type === 'unsend' ? 'opacity-60' : ''}`}
                        onContextMenu={(e) => { e.preventDefault(); setActionMsgId(msgKey); }}
                      >
                        {renderMessageContent(msg)}
                      </div>

                      {/* Pinned indicator */}
                      {msg.pinnedInfo && (
                        <BsPin className={`absolute -top-1.5 ${isMine ? '-left-4' : '-right-4'} text-yellow-500 text-xs`} />
                      )}

                      {/* Action menu */}
                      {actionMsgId === msgKey && (
                        <div
                          className={`absolute z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[160px] ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => { setReplyTo(msg); setActionMsgId(null); inputRef.current?.focus(); }}>
                            <FaReply className="text-gray-400 text-xs" /> Trả lời
                          </button>
                          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleForward(msg)}>
                            <FaThumbsUp className="text-gray-400 text-xs" /> Chuyển tiếp
                          </button>
                          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handlePin(msg)}>
                            <BsPin className="text-gray-400 text-xs" />
                            {msg.pinnedInfo ? 'Bỏ ghim' : 'Ghim tin nhắn'}
                          </button>
                          {isMine && msg.type !== 'unsend' && (
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              onClick={() => handleUnsend(msg)}>
                              <FaTrash className="text-xs" /> Thu hồi
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Time + status + read receipts */}
                    <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                      {isMine && (
                        <span className="text-[10px] text-gray-400">
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                      {/* Read receipt avatars (chỉ hiện ở tin nhắn của mình) */}
                      {isMine && msg.messageID && seenMap[msg.messageID]?.length > 0 && (
                        <div className={`flex items-center gap-0.5 ${isMine ? 'mr-1' : 'ml-1'}`}>
                          {seenMap[msg.messageID]
                            .filter((r) => r.userID !== user?.userID)
                            .slice(0, 3)
                            .map((r) => (
                              <img
                                key={r.userID}
                                src={r.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.userID}`}
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
                  <div className="px-4 py-3 bg-white dark:bg-gray-700 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
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
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800 flex-shrink-0">
              <FaReply className="text-[#0e9de8] text-sm flex-shrink-0" />
              <div className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                <span className="font-medium text-[#0e9de8]">Trả lời </span>
                {replyTo.content || '[Media]'}
              </div>
              <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FaTimes className="text-xs" />
              </button>
            </div>
          )}

          {/* File preview */}
          {files.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-300">
                  {f.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(f)} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <span className="text-[10px] truncate max-w-[80px]">{f.name}</span>
                  )}
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 ml-1">
                    <FaTimes className="text-[10px]" />
                  </button>
                </div>
              ))}
              <button
                onClick={sendFiles}
                disabled={isUploading}
                className="ml-auto px-3 py-1.5 bg-[#0e9de8] text-white text-xs rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Đang gửi...' : 'Gửi'}
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="flex-shrink-0">
            {/* Toolbar icons */}
            <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
              {/* Emoji */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowEmoji((v) => !v); }}
                title="Emoji"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors ${showEmoji ? 'text-[#0e9de8] bg-blue-50' : 'text-gray-500 hover:text-[#0e9de8] hover:bg-gray-100'}`}
              >
                <FaSmile />
              </button>
              {/* Gửi ảnh */}
              <button
                onClick={() => imageInputRef.current?.click()}
                title="Gửi ảnh"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0e9de8] hover:bg-gray-100 transition-colors"
              >
                <FaImage />
              </button>
              <input ref={imageInputRef} type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={(e) => { if (e.target.files) setFiles(Array.from(e.target.files)); }} />
              {/* Gửi file */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Gửi file"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0e9de8] hover:bg-gray-100 transition-colors"
              >
                <FaPaperclip />
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => { if (e.target.files) setFiles(Array.from(e.target.files)); }} />
              {/* Ghi âm */}
              {!isRecording && !audioBlob && (
                <button
                  onClick={startRecording}
                  title="Ghi âm"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0e9de8] hover:bg-gray-100 transition-colors"
                >
                  <FaMicrophone />
                </button>
              )}
              {/* Call video */}
              <button
                onClick={() => onStartVideoCall?.()}
                title="Gọi video"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-base text-gray-500 hover:text-[#0e9de8] hover:bg-gray-100 transition-colors"
              >
                <FaVideo />
              </button>
              {/* Nhắc hẹn */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowReminder(true); }}
                title="Nhắc hẹn"
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors ${showReminder ? 'text-[#0e9de8] bg-blue-50' : 'text-gray-500 hover:text-[#0e9de8] hover:bg-gray-100'}`}
              >
                <FaBell />
              </button>
            </div>

            {/* Emoji picker */}
            {showEmoji && (
              <div className="px-3 pb-1" onClick={(e) => e.stopPropagation()}>
                <EmojiPicker onEmojiClick={sendEmoji} height={320} width="100%" />
              </div>
            )}

            {/* Recording bar */}
            {isRecording && (
              <div className="flex items-center gap-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-100">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-sm text-red-600 font-medium flex-1">Đang ghi âm... {formatRecordTime(recordingTime)}</span>
                <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition-colors" title="Hủy">
                  <FaTimes className="text-sm" />
                </button>
                <button onClick={stopRecording} className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1">
                  <FaStop className="text-[10px]" /> Dừng
                </button>
              </div>
            )}

            {/* Audio preview */}
            {audioBlob && !isRecording && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100">
                <audio src={URL.createObjectURL(audioBlob)} controls className="h-8 flex-1" />
                <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition-colors" title="Hủy">
                  <FaTimes className="text-sm" />
                </button>
                <button onClick={sendAudio} disabled={isUploading}
                  className="px-3 py-1 bg-[#0e9de8] text-white text-xs rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50">
                  {isUploading ? '...' : 'Gửi'}
                </button>
              </div>
            )}

            {/* Text input row */}
            <div className="flex items-center px-3 pb-2.5 pt-1 bg-white dark:bg-gray-900 gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                placeholder="Nhập tin nhắn..."
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-[22px] outline-none text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-[#0e9de8] focus:bg-white dark:focus:bg-gray-700 transition-colors"
              />
              <button
                onClick={sendText}
                disabled={!inputText.trim()}
                className="w-9 h-9 flex items-center justify-center bg-[#0e9de8] text-white rounded-full hover:bg-[#0077c2] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 text-sm"
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="w-[280px] border-l border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100 flex-1">Tìm kiếm tin nhắn</h3>
              <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchKeyword(''); }} className="text-gray-400 hover:text-gray-600 transition-colors"><FaTimes /></button>
            </div>
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Nhập từ khóa..."
                  className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:border-[#0e9de8] bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100"
                />
                <button onClick={handleSearch} className="px-3 py-1.5 bg-[#0e9de8] text-white rounded-lg text-sm hover:bg-[#0077c2] transition-colors">Tìm</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
              {searchResults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center mt-8">{searchKeyword ? 'Không tìm thấy kết quả' : 'Nhập từ khóa để tìm kiếm'}</p>
              ) : (
                searchResults.map((r, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl text-sm cursor-pointer border transition-colors ${r.messageID ? 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-[#0e9de8]/30' : 'bg-gray-50 dark:bg-gray-800 border-transparent'}`}
                    onClick={() => r.messageID && handleScrollToMessage(r.messageID)}
                  >
                    {r.type === 'message' && (
                      <p className="text-gray-700 dark:text-gray-200 text-[13px] leading-snug line-clamp-2">
                        {r.content?.split(new RegExp(`(${searchKeyword})`, 'gi')).map((part, j) =>
                          part.toLowerCase() === searchKeyword.toLowerCase()
                            ? <mark key={j} className="bg-yellow-200 dark:bg-yellow-700 text-gray-900 dark:text-gray-100 rounded px-0.5">{part}</mark>
                            : part
                        )}
                      </p>
                    )}
                    {r.type === 'file' && <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{r.name}</a>}
                    <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                      🕐 {new Date(r.timestamp).toLocaleString('vi-VN')}
                      {r.messageID && <span className="text-[#0e9de8] ml-auto text-[10px]">Nhấn để xem →</span>}
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
            onHistoryDeleted={() => {
              setMessages([]);
              setShowInfo(false);
            }}
          />
        )}
      </div>
    </div>

    {/* Reminder Modal */}
    {showReminder && selectedChat && (
      <ReminderModal
        chatID={selectedChat.chatID}
        onClose={() => setShowReminder(false)}
        onCreated={(r) => {
          const evt: ReminderEvent = {
            id: `created_${r.id}`,
            chatID: r.chatID,
            type: 'created',
            reminder: r,
            userName: user?.name || 'Bạn',
            userID: user?.userID || '',
            createdAt: new Date().toISOString(),
          };
          saveReminderEvent(evt);
          setReminderEvents((prev) => [...prev, evt]);
          socket.emit('reminder_event', evt);
          setShowReminder(false);
        }}
        onDeleted={(r) => {
          const evt: ReminderEvent = {
            id: `deleted_${r.id}_${Date.now()}`,
            chatID: r.chatID,
            type: 'deleted',
            reminder: r,
            userName: user?.name || 'Bạn',
            userID: user?.userID || '',
            createdAt: new Date().toISOString(),
          };
          saveReminderEvent(evt);
          setReminderEvents((prev) => [...prev, evt]);
          socket.emit('reminder_event', evt);
        }}
      />
    )}
    </>
  );
};

export default ChatWindow;
