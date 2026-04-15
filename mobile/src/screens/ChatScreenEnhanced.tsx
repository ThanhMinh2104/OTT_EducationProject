import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image,
  TextInput, Modal, Alert, ActivityIndicator, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';
import StickerEmojiPicker from '../components/StickerEmojiPicker';
import AudioPlayer from '../components/AudioPlayer';
import CallScreen from './CallScreen';
import IncomingCallModal from '../components/IncomingCallModal';
import { downloadAndOpenFile } from '../utils/fileDownload';
import ImageViewer from '../components/ImageViewer';
import VideoViewer from '../components/VideoViewer';
import ChatInfoPanel from '../components/ChatInfoPanel';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, any>;
  onChatOpen?: () => void;
  onChatClose?: () => void;
  initialChat?: Chat | null;
  onChatOpened?: () => void;
};

interface Message {
  messageID?: string;
  tempID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
  status?: string;
  senderInfo?: { name: string; avatar?: string | null };
  replyTo?: { messageID?: string; senderID?: string; content?: string; type?: string } | null;
}

interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: { userID: string; role: string }[];
  lastMessage: Message[];
  unreadCount?: number;
}

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

const getLastMsgPreview = (chat: Chat, userID: string): string => {
  const msgs = [...(chat.lastMessage || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const last = msgs[msgs.length - 1];
  if (!last) return 'Chưa có tin nhắn';
  const isMine = last.senderID === userID;
  const prefix = isMine ? 'Bạn: ' : '';
  switch (last.type) {
    case 'image': return prefix + '[Hình ảnh]';
    case 'video': return prefix + '[Video]';
    case 'audio': return prefix + '[Tin nhắn thoại]';
    case 'file': return prefix + '[File]';
    case 'sticker': return prefix + '[Sticker]';
    case 'gif': return prefix + '[GIF]';
    case 'unsend': return isMine ? 'Bạn đã thu hồi tin nhắn' : 'Tin nhắn đã bị thu hồi';
    default: return prefix + (last.content || '');
  }
};

const getTime = (chat: Chat): string => {
  const msgs = [...(chat.lastMessage || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const last = msgs[msgs.length - 1];
  if (!last?.timestamp) return '';
  const d = new Date(last.timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// Helper lấy extension file
const getFileExt = (name: string) => (name.split('.').pop() || '').toUpperCase();
const getFileColor = (name: string) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['doc', 'docx'].includes(ext)) return '#4285f4';
  if (['xls', 'xlsx'].includes(ext)) return '#34a853';
  if (['ppt', 'pptx'].includes(ext)) return '#ea4335';
  if (ext === 'pdf') return '#ea4335';
  if (['zip', 'rar', '7z'].includes(ext)) return '#ff9500';
  return '#8e8e93';
};

const ChatScreenEnhanced = ({ navigation, onChatOpen, onChatClose, initialChat, onChatOpened }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [memberCache, setMemberCache] = useState<Record<string, User>>({});
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ userID: string; userName: string }[]>([]);
  const [searchText, setSearchText] = useState('');

  // Image/Video viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState('');

  // Chat info panel state
  const [showChatInfo, setShowChatInfo] = useState(false);

  // Audio recording states
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call states
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [incomingCall, setIncomingCall] = useState<{
    offer: RTCSessionDescriptionInit;
    from: string;
    callerInfo: { name: string; avatar?: string | null };
    callType: 'voice' | 'video';
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load user & chats
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) { navigation.replace('Login'); return; }
      const u = JSON.parse(stored);
      setUser(u);
      socket.emit('join_user', u.userID);
      socket.emit('getChat', u.userID);
    })();

    socket.on('ChatByUserID', (data: Chat[]) => {
      const sorted = [...data].sort((a, b) => {
        const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
        const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
        return new Date(bT).getTime() - new Date(aT).getTime();
      });
      setChats(sorted);
      // Prefetch member info cho private chats
      sorted.forEach(async (c) => {
        if (c.type === 'private') {
          const stored = await AsyncStorage.getItem('user');
          if (!stored) return;
          const me = JSON.parse(stored);
          const otherId = c.members.find((m) => m.userID !== me.userID)?.userID;
          if (otherId) fetchMember(otherId);
        }
      });
    });

    // Incoming call listener (global, không phụ thuộc chat)
    socket.on('call-made', (data: any) => {
      setIncomingCall({
        offer: data.offer,
        from: data.from,
        callerInfo: data.callerInfo,
        callType: data.callType || 'video',
      });
    });

    socket.on('call-cancelled', () => {
      setIncomingCall(null);
    });

    return () => {
      socket.off('ChatByUserID');
      socket.off('call-made');
      socket.off('call-cancelled');
    };
  }, [navigation]);

  // Xử lý khi nhận initialChat từ ContactsPanel
  useEffect(() => {
    if (initialChat && user) {
      handleSelectChat(initialChat);
      onChatOpened?.();
    }
  }, [initialChat, user]);

  const fetchMember = async (memberID: string) => {
    if (memberCache[memberID]) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/usersID`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userID: memberID }),
      });
      const data = await res.json();
      setMemberCache((prev) => ({ ...prev, [memberID]: data }));
    } catch { /* ignore */ }
  };

  // Lấy tên hiển thị đúng cho chat (tên đối phương thay vì "A & B")
  const getChatDisplayName = (chat: Chat): string => {
    if (chat.type === 'group') return chat.name;
    const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
    return memberCache[otherId || '']?.name || chat.name;
  };

  // Lấy avatar đúng cho chat
  const getChatAvatar = (chat: Chat): string => {
    if (chat.type === 'group')
      return chat.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.chatID}`;
    const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
    return (
      memberCache[otherId || '']?.anhDaiDien ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`
    );
  };

  // Chat-specific socket listeners
  useEffect(() => {
    if (!selectedChat || !user) return;
    const chatID = selectedChat.chatID;

    socket.emit('join_chat', chatID);
    socket.emit('read_messages', { chatID, userID: user.userID });

    const onNewMessage = (msg: Message) => {
      if (msg.chatID !== chatID) {
        // Update chat list preview
        setChats(prev => prev.map(c => {
          if (c.chatID !== msg.chatID) return c;
          const msgs = c.lastMessage || [];
          const exists = msgs.find(m => m.messageID === msg.messageID || m.tempID === msg.tempID);
          const newMsgs = exists
            ? msgs.map(m => m.tempID === msg.tempID ? { ...m, ...msg } : m)
            : [...msgs, msg];
          return { ...c, lastMessage: newMsgs };
        }));
        return;
      }
      setMessages(prev => {
        const exists = prev.find(m => m.messageID === msg.messageID || (msg.tempID && m.tempID === msg.tempID));
        if (exists) return prev.map(m => m.tempID === msg.tempID ? { ...m, ...msg } : m);
        return [...prev, msg];
      });
      if (msg.senderID !== user.userID) {
        socket.emit('read_messages', { chatID, userID: user.userID });
      }
    };

    const onUnsend = (updated: Message) => {
      setMessages(prev => prev.map(m => m.messageID === updated.messageID ? { ...m, ...updated } : m));
    };

    const onDeletedLocal = (data: { messageID: string; chatID: string; userID: string }) => {
      if (data.userID === user.userID && data.chatID === chatID) {
        setMessages(prev => prev.filter(m => m.messageID !== data.messageID));
      }
    };

    const onTypingStart = ({ chatID: cid, userID: uid, userName }: any) => {
      if (uid === user.userID || cid !== chatID) return;
      setTypingUsers(prev => prev.find(u => u.userID === uid) ? prev : [...prev, { userID: uid, userName }]);
    };

    const onTypingStop = ({ chatID: cid, userID: uid }: any) => {
      if (cid !== chatID) return;
      setTypingUsers(prev => prev.filter(u => u.userID !== uid));
    };

    socket.on('new_message', onNewMessage);
    socket.on(chatID, onNewMessage);
    socket.on('unsend_notification', onUnsend);
    socket.on('message_deleted_local', onDeletedLocal);
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off(chatID, onNewMessage);
      socket.off('unsend_notification', onUnsend);
      socket.off('message_deleted_local', onDeletedLocal);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
      setTypingUsers([]);
    };
  }, [selectedChat?.chatID, user?.userID]);

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    setMessages(chat.lastMessage || []);
    setReplyTo(null);
    setInputText('');
    onChatOpen?.(); // ẩn tab bar

    // Fetch member info nếu chưa có
    if (chat.type === 'private' && user) {
      const otherId = chat.members.find((m) => m.userID !== user.userID)?.userID;
      if (otherId) fetchMember(otherId);
    }

    // Load full messages from API
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/messages/id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatID: chat.chatID }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        // Deduplicate theo messageID
        const seen = new Set<string>();
        const deduped = data.filter((m: Message) => {
          const key = m.messageID || m.tempID || '';
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setMessages(deduped);
      }
    } catch { /* fallback to lastMessage */ }
  };

  const buildMsg = (extra: Partial<Message>): Message => ({
    tempID: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    chatID: selectedChat!.chatID,
    senderID: user!.userID,
    timestamp: new Date().toISOString(),
    status: 'sent',
    senderInfo: { name: user!.name, avatar: user!.anhDaiDien || null },
    replyTo: replyTo ? { messageID: replyTo.messageID, senderID: replyTo.senderID, content: replyTo.content, type: replyTo.type } : null,
    ...extra,
  } as Message);

  const sendMessage = () => {
    if (!inputText.trim() || !selectedChat || !user) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    socket.emit('typing_stop', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    const msg = buildMsg({ content: inputText, type: 'text', media_url: [] });
    socket.emit('send_message', msg);
    setMessages(prev => [...prev, msg]);
    setInputText('');
    setReplyTo(null);
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
    if (!selectedChat || !user) return;
    socket.emit('typing_start', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    }, 2000);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(result.assets.map(a => ({ uri: a.uri, type: 'image', name: a.fileName || 'image.jpg' })));
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(result.assets.map(a => ({ uri: a.uri, type: 'video', name: a.fileName || `video_${Date.now()}.mp4` })));
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(result.assets.map(a => ({ uri: a.uri, type: 'file', name: a.name })));
    }
  };

  const uploadFiles = async (files: { uri: string; type: string; name?: string }[]) => {
    if (!selectedChat || !user) return;
    setIsUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', {
          uri: file.uri,
          name: file.name || `file_${Date.now()}`,
          type: file.type === 'image' 
            ? 'image/jpeg' 
            : file.type === 'video'
            ? 'video/mp4'
            : 'application/octet-stream',
        } as any);
      });
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.urls?.length > 0) {
        const msgType = files[0].type === 'image' 
          ? 'image' 
          : files[0].type === 'video'
          ? 'video'
          : 'file';
        const msg = buildMsg({
          content: msgType === 'file' ? files[0].name || '' : '',
          type: msgType,
          media_url: data.urls,
        });
        socket.emit('send_message', msg);
        setMessages(prev => [...prev, msg]);
        setReplyTo(null);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể tải file lên');
    } finally {
      setIsUploading(false);
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Lỗi', 'Cần quyền truy cập microphone để ghi âm');
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error('Start recording error:', err);
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm');
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      // URI sẽ có sẵn trong audioRecorder.uri
      setAudioUri(audioRecorder.uri);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      Alert.alert('Lỗi', 'Không thể dừng ghi âm');
    }
  };

  const cancelRecording = async () => {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
      setAudioUri(null);
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    } catch (err) {
      console.error('Cancel recording error:', err);
    }
  };

  const sendAudio = async () => {
    if (!audioUri || !selectedChat || !user) return;
    setIsUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      
      // Thử nhiều MIME types để tương thích với backend
      // Backend chấp nhận: audio/mpeg, audio/wav, audio/webm, audio/ogg, audio/mp4, audio/m4a, audio/x-m4a
      formData.append('file', {
        uri: audioUri,
        name: `voice-message-${Date.now()}.m4a`,
        type: 'audio/m4a', // Thử audio/m4a trước
      } as any);

      console.log('Uploading audio:', { uri: audioUri, type: 'audio/m4a', token: token ? 'exists' : 'missing' });

      const res = await fetch(`${API_URL}/api/upload/audio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await res.json();
      console.log('Upload response:', { status: res.status, data });

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Upload failed');
      }

      // Backend trả về { url, fileName, fileSize, mimeType }
      if (!data.url) {
        throw new Error('No audio URL in response');
      }

      const msg = buildMsg({
        content: '',
        type: 'audio',
        media_url: [data.url],
      });
      
      console.log('Sending audio message:', msg);
      socket.emit('send_message', msg);
      setMessages((prev) => [...prev, msg]);
      setAudioUri(null);
      setRecordingTime(0);
      setReplyTo(null);
    } catch (err) {
      console.error('Send audio error:', err);
      Alert.alert('Lỗi', `Không thể gửi audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleEmojiSelect = (emoji: string) => setInputText(prev => prev + emoji);

  const handleStickerSelect = (url: string) => {
    if (!selectedChat || !user) return;
    const msg = buildMsg({ content: '', type: 'sticker', media_url: [url] });
    socket.emit('send_message', msg);
    setMessages(prev => [...prev, msg]);
    setShowEmoji(false);
    setReplyTo(null);
  };

  const handleGifSelect = (url: string) => {
    if (!selectedChat || !user) return;
    const msg = buildMsg({ content: '', type: 'gif', media_url: [url] });
    socket.emit('send_message', msg);
    setMessages(prev => [...prev, msg]);
    setShowEmoji(false);
    setReplyTo(null);
  };

  const handleDeleteLocal = (msg: Message) => {
    if (!msg.messageID || !user?.userID || !selectedChat) return;
    socket.emit('delete_message_local', { messageID: msg.messageID, userID: user.userID, chatID: selectedChat.chatID });
    setShowMenu(false);
  };

  const handleUnsend = (msg: Message) => {
    if (!msg.messageID || msg.senderID !== user?.userID) return;
    socket.emit('unsend_message', { messageID: msg.messageID, chatID: selectedChat!.chatID, senderID: user.userID });
    setShowMenu(false);
  };

  const handleForwardMessage = (msg: Message) => {
    if (!msg.messageID) { Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn này'); return; }
    setShowMenu(false);
    navigation.navigate('Forward', { message: msg, chatID: selectedChat!.chatID });
  };

  const startCall = (type: 'voice' | 'video') => {
    setCallType(type);
    setShowCall(true);
  };

  const handleLongPress = (msg: Message) => {
    setSelectedMessage(msg);
    setShowMenu(true);
  };

  const renderMessage = (item: Message) => {
    const isMine = item.senderID === user?.userID;
    const isUnsent = item.type === 'unsend';
    const timeStr = new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const renderBubbleContent = () => {
      if (isUnsent) {
        return (
          <View style={styles.bubbleUnsent}>
            <Text style={styles.unsentText}>Tin nhắn đã bị thu hồi</Text>
          </View>
        );
      }
      if (item.type === 'image' && item.media_url?.length) {
        return (
          <View>
            <View style={styles.imageContainer}>
              {item.media_url.map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setSelectedImages(item.media_url || []);
                    setSelectedImageIndex(idx);
                    setImageViewerVisible(true);
                  }}
                >
                  <Image source={{ uri: url }} style={styles.messageImage} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.messageTime, isMine ? styles.timeOnMedia : styles.timeOnMediaOther]}>
              {timeStr}
            </Text>
          </View>
        );
      }
      if (item.type === 'video' && item.media_url?.[0]) {
        return (
          <TouchableOpacity
            onPress={() => {
              setSelectedVideo(item.media_url![0]);
              setVideoViewerVisible(true);
            }}
          >
            <View style={styles.videoContainer}>
              <Image
                source={{ uri: item.media_url[0] }}
                style={styles.videoThumbnail}
              />
              <View style={styles.videoPlayButton}>
                <Ionicons name="play" size={40} color="#fff" />
              </View>
            </View>
            <Text style={[styles.messageTime, isMine ? styles.timeOnMedia : styles.timeOnMediaOther]}>
              {timeStr}
            </Text>
          </TouchableOpacity>
        );
      }
      if (item.type === 'sticker' && item.media_url?.[0]) {
        return (
          <View>
            <Image source={{ uri: item.media_url[0] }} style={styles.stickerImage} />
            <Text style={[styles.messageTime, styles.timeOnMediaOther]}>{timeStr}</Text>
          </View>
        );
      }
      if (item.type === 'gif' && item.media_url?.[0]) {
        return (
          <View>
            <Image source={{ uri: item.media_url[0] }} style={styles.gifImage} />
            <Text style={[styles.messageTime, isMine ? styles.timeOnMedia : styles.timeOnMediaOther]}>
              {timeStr}
            </Text>
          </View>
        );
      }
      if (item.type === 'audio' && item.media_url?.[0]) {
        return (
          <View style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <AudioPlayer audioUrl={item.media_url[0]} isMine={isMine} />
            <Text style={[styles.messageTime, isMine ? styles.timeMine : styles.timeOther]}>{timeStr}</Text>
          </View>
        );
      }
      if (item.type === 'file' && item.media_url?.[0]) {
        const fileName = item.content || 'File';
        const ext = getFileExt(fileName);
        const color = getFileColor(fileName);
        return (
          <TouchableOpacity
            style={[styles.fileCard, isMine ? styles.fileCardMine : styles.fileCardOther]}
            onPress={() => {
              // Import ở đầu file: import { downloadAndOpenFile } from '../utils/fileDownload';
              downloadAndOpenFile(
                item.media_url![0],
                fileName,
                undefined // mimeType - có thể thêm vào Message interface nếu cần
              );
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.fileExtBadge, { backgroundColor: color }]}>
              <Text style={styles.fileExtText}>{ext || 'FILE'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.fileCardName, isMine ? styles.fileCardNameMine : styles.fileCardNameOther]}
                numberOfLines={2}
              >
                {fileName}
              </Text>
              <Text style={[styles.fileCardSub, isMine ? styles.fileCardSubMine : styles.fileCardSubOther]}>
                Nhấn để tải xuống
              </Text>
            </View>
            <Text style={[styles.messageTime, isMine ? styles.timeMine : styles.timeOther, { marginTop: 4 }]}>
              {timeStr}
            </Text>
          </TouchableOpacity>
        );
      }
      // Text
      return (
        <View style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.replyTo && (
            <View style={[styles.replyInBubble, isMine ? styles.replyInBubbleMine : styles.replyInBubbleOther]}>
              <Text style={[styles.replyInBubbleText, isMine && { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={1}>
                ↩ {item.replyTo.content || '[Media]'}
              </Text>
            </View>
          )}
          <Text style={[styles.messageText, isMine ? styles.textMine : styles.textOther]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isMine ? styles.timeMine : styles.timeOther]}>{timeStr}</Text>
        </View>
      );
    };

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={1}
        style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}
      >
        {/* Avatar bên trái cho tin nhắn người khác */}
        {!isMine && (
          <Image
            source={{
              uri: item.senderInfo?.avatar ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.senderID}`,
            }}
            style={styles.msgAvatar}
          />
        )}
        <View style={[styles.msgContent, isMine ? styles.msgContentMine : styles.msgContentOther]}>
          {renderBubbleContent()}
        </View>
        {/* Spacer bên phải cho tin nhắn người khác */}
        {!isMine && <View style={{ width: 48 }} />}
      </TouchableOpacity>
    );
  };

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // ===== CHAT LIST VIEW =====
  if (!selectedChat) {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm"
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="rgba(255,255,255,0.7)"
            />
          </View>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="person-add-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredChats}
          keyExtractor={item => item.chatID}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => handleSelectChat(item)}
            >
              <Image
                source={{ uri: getChatAvatar(item) }}
                style={styles.chatAvatar}
              />
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName} numberOfLines={1}>{getChatDisplayName(item)}</Text>
                  <Text style={styles.chatTime}>{getTime(item)}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {getLastMsgPreview(item, user?.userID || '')}
                </Text>
              </View>
              {(item.unreadCount ?? 0) > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào</Text>
            </View>
          }
        />

        {/* Incoming Call khi đang ở chat list */}
        {incomingCall && (
          <IncomingCallModal
            visible={!!incomingCall}
            callerInfo={{
              name: incomingCall.callerInfo.name,
              avatar: incomingCall.callerInfo.avatar,
              userID: incomingCall.from,
            }}
            callType={incomingCall.callType}
            onAccept={() => {
              setCallType(incomingCall.callType);
              setShowCall(true);
              setIncomingCall(null);
            }}
            onReject={() => {
              socket.emit('call-cancelled', {
                to: incomingCall.from,
                from: user?.userID,
              });
              setIncomingCall(null);
            }}
          />
        )}

        {/* Call Screen từ chat list */}
        {showCall && user && incomingCall === null && (
          <CallScreen
            visible={showCall}
            callType={callType}
            remoteUserID={incomingCall ? (incomingCall as any).from : ''}
            remoteInfo={{ name: '', avatar: null }}
            chatID={''}
            currentUser={user}
            onClose={() => setShowCall(false)}
          />
        )}
      </View>
    );
  }

  // ===== CHAT WINDOW VIEW =====
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setSelectedChat(null); onChatClose?.(); }} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Image
          source={{ uri: getChatAvatar(selectedChat) }}
          style={styles.headerAvatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.chatTitle} numberOfLines={1}>{getChatDisplayName(selectedChat)}</Text>
          {typingUsers.length > 0 && (
            <Text style={styles.typingText}>
              {typingUsers.map(u => u.userName).join(', ')} đang nhập...
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => startCall('voice')}>
          <Ionicons name="call-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => startCall('video')}>
          <Ionicons name="videocam-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowChatInfo(true)}>
          <Ionicons name="menu-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages.filter((msg, idx, arr) =>
          arr.findIndex(m =>
            (m.messageID && m.messageID === msg.messageID) ||
            (m.tempID && m.tempID === msg.tempID && !msg.messageID)
          ) === idx
        )}
        keyExtractor={(item, index) =>
          item.messageID || item.tempID || `msg-${index}`
        }
        renderItem={({ item }) => renderMessage(item)}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Reply preview bar */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBarLabel}>Đang trả lời</Text>
            <Text style={styles.replyBarContent} numberOfLines={1}>
              {replyTo.content || '[Media]'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={styles.replyBarClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Emoji/Sticker Picker */}
      {showEmoji && (
        <StickerEmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onStickerSelect={handleStickerSelect}
          onGifSelect={handleGifSelect}
        />
      )}

      {/* Recording bar */}
      {audioRecorder.isRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          {/* Waveform animation */}
          <View style={styles.waveformContainer}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  { height: Math.random() * 20 + 10 },
                ]}
              />
            ))}
          </View>
          <Text style={styles.recordingTime}>{formatRecordTime(recordingTime)}</Text>
          <TouchableOpacity onPress={cancelRecording} style={styles.recordingCancelBtn}>
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity onPress={stopRecording} style={styles.recordingStopBtn}>
            <Ionicons name="stop" size={14} color="#fff" />
            <Text style={styles.recordingStopText}>Dừng</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Audio preview */}
      {audioUri && !audioRecorder.isRecording && (
        <View style={styles.audioPreviewBar}>
          <View style={styles.audioPreviewInfo}>
            <Ionicons name="mic" size={20} color="#0068ff" />
            <Text style={styles.audioPreviewText}>Tin nhắn thoại ({formatRecordTime(recordingTime)})</Text>
          </View>
          <TouchableOpacity onPress={cancelRecording} style={styles.audioPreviewCancelBtn}>
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={sendAudio}
            disabled={isUploading}
            style={[styles.audioPreviewSendBtn, isUploading && styles.audioPreviewSendBtnDisabled]}
          >
            <Text style={styles.audioPreviewSendText}>{isUploading ? '...' : 'Gửi'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmoji(!showEmoji)}>
          <MaterialCommunityIcons name="emoticon-outline" size={26} color="#555" />
        </TouchableOpacity>

        {inputText.trim() ? null : (
          <>
            <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={24} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handlePickVideo}>
              <Ionicons name="videocam-outline" size={24} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handlePickFile}>
              <Ionicons name="attach-outline" size={24} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={startRecording}>
              <Ionicons name="mic-outline" size={24} color="#555" />
            </TouchableOpacity>
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Tin nhắn"
          value={inputText}
          onChangeText={handleInputChange}
          placeholderTextColor="#aaa"
          multiline
        />

        {inputText.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              if (!selectedChat || !user) return;
              const msg = buildMsg({ content: '👍', type: 'text', media_url: [] });
              socket.emit('send_message', msg);
              setMessages((prev) => [...prev, msg]);
            }}
          >
            <FontAwesome5 name="thumbs-up" size={22} color="#0068ff" solid />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading overlay */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0091ff" />
          <Text style={styles.loadingText}>Đang tải lên...</Text>
        </View>
      )}

      {/* Long-press Menu */}
      <Modal transparent visible={showMenu} animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuBox}>
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setReplyTo(selectedMessage);
              setShowMenu(false);
            }}>
              <Text style={styles.menuItemText}>↩️ Trả lời</Text>
            </TouchableOpacity>
            {selectedMessage?.senderID === user?.userID && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleUnsend(selectedMessage!)}>
                <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>🔄 Thu hồi</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteLocal(selectedMessage!)}>
              <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>🗑️ Xóa phía tôi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => handleForwardMessage(selectedMessage!)}>
              <Text style={styles.menuItemText}>↗️ Chuyển tiếp</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Call Screen */}
      {selectedChat && user && (
        <CallScreen
          visible={showCall}
          callType={callType}
          remoteUserID={
            selectedChat.type === 'private'
              ? selectedChat.members.find((m) => m.userID !== user.userID)?.userID || ''
              : ''
          }
          remoteInfo={{
            name: getChatDisplayName(selectedChat),
            avatar: getChatAvatar(selectedChat),
          }}
          chatID={selectedChat.chatID}
          currentUser={user}
          onClose={() => setShowCall(false)}
        />
      )}

      {/* Incoming Call */}
      {incomingCall && (
        <IncomingCallModal
          visible={!!incomingCall}
          callerInfo={{
            name: incomingCall.callerInfo.name,
            avatar: incomingCall.callerInfo.avatar,
            userID: incomingCall.from,
          }}
          callType={incomingCall.callType}
          onAccept={() => {
            setCallType(incomingCall.callType);
            setShowCall(true);
            setIncomingCall(null);
          }}
          onReject={() => {
            socket.emit('call-cancelled', {
              to: incomingCall.from,
              from: user?.userID,
              chatID: selectedChat?.chatID,
            });
            setIncomingCall(null);
          }}
        />
      )}

      {/* Image Viewer */}
      <ImageViewer
        visible={imageViewerVisible}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />

      {/* Video Viewer */}
      <VideoViewer
        visible={videoViewerVisible}
        videoUrl={selectedVideo}
        onClose={() => setVideoViewerVisible(false)}
      />

      {/* Chat Info Panel */}
      {selectedChat && (
        <ChatInfoPanel
          visible={showChatInfo}
          chat={selectedChat}
          memberInfo={
            selectedChat.type === 'private'
              ? memberCache[
                  selectedChat.members.find((m) => m.userID !== user?.userID)
                    ?.userID || ''
                ] || null
              : null
          }
          messages={messages}
          onClose={() => setShowChatInfo(false)}
          onHistoryDeleted={() => {
            setMessages([]);
            setShowChatInfo(false);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },

  // List header
  listHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0068ff', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#fff' },

  // Chat list item
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8',
  },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  chatInfo: { flex: 1, minWidth: 0 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatName: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, color: '#aaa' },
  lastMessage: { fontSize: 13, color: '#888' },
  unreadBadge: {
    backgroundColor: '#0068ff', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center', marginLeft: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#aaa' },

  // Chat header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0068ff', paddingHorizontal: 10, paddingVertical: 10, gap: 8,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  typingText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontStyle: 'italic' },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 20 },

  // Messages list background
  messagesList: { paddingVertical: 10, paddingHorizontal: 0 },

  // Message row layout (Zalo style)
  messageRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    marginVertical: 2, paddingHorizontal: 10,
  },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 6, marginBottom: 2 },
  msgContent: { maxWidth: '72%' },
  msgContentMine: { alignItems: 'flex-end' },
  msgContentOther: { alignItems: 'flex-start' },

  // Bubble
  messageBubble: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: '#d6eaff',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  bubbleUnsent: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: '#ddd',
    borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8,
  },
  unsentText: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  messageText: { fontSize: 15, lineHeight: 21 },
  textMine: { color: '#111' },
  textOther: { color: '#111' },

  // Time
  messageTime: { fontSize: 11, marginTop: 3 },
  timeMine: { color: '#888', textAlign: 'right' },
  timeOther: { color: '#aaa' },
  timeOnMedia: { fontSize: 11, color: 'rgba(255,255,255,0.85)', textAlign: 'right', marginTop: 4, paddingHorizontal: 4 },
  timeOnMediaOther: { fontSize: 11, color: '#aaa', marginTop: 4, paddingHorizontal: 4 },

  // Reply inside bubble
  replyInBubble: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    marginBottom: 6, borderLeftWidth: 3,
  },
  replyInBubbleMine: { backgroundColor: 'rgba(0,104,255,0.1)', borderLeftColor: '#0068ff' },
  replyInBubbleOther: { backgroundColor: '#f0f0f0', borderLeftColor: '#aaa' },
  replyInBubbleText: { fontSize: 12, color: '#555' },

  // Media
  imageContainer: { gap: 3 },
  messageImage: { width: 200, height: 200, borderRadius: 12, resizeMode: 'cover' },
  videoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: 250,
    height: 200,
    backgroundColor: '#000',
  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerImage: { width: 130, height: 130, resizeMode: 'contain' },
  gifImage: { width: 200, height: 160, borderRadius: 12, resizeMode: 'cover' },

  // File card (Zalo style)
  fileCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 10, gap: 10,
    minWidth: 220, maxWidth: 280,
  },
  fileCardMine: { backgroundColor: '#d6eaff' },
  fileCardOther: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  fileExtBadge: {
    width: 44, height: 52, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  fileExtText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  fileCardName: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  fileCardNameMine: { color: '#111' },
  fileCardNameOther: { color: '#111' },
  fileCardSub: { fontSize: 11, marginTop: 2 },
  fileCardSubMine: { color: '#0068ff' },
  fileCardSubOther: { color: '#888' },

  // Reply bar
  replyBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#e8f0ff', paddingHorizontal: 14, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#c5d8ff',
  },
  replyBarLabel: { fontSize: 12, color: '#0068ff', fontWeight: '700' },
  replyBarContent: { fontSize: 13, color: '#444' },
  replyBarClose: { fontSize: 18, color: '#aaa', paddingLeft: 12 },

  // Input bar
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 6, gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd',
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, backgroundColor: '#f2f2f2', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 15, color: '#111', maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#0068ff', alignItems: 'center', justifyContent: 'center',
  },

  // Recording bar
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffebee',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffcdd2',
    gap: 12,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f44336',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#f44336',
  },
  recordingTime: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#f44336',
  },
  recordingCancelBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f44336',
    borderRadius: 8,
  },
  recordingStopText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Audio preview bar
  audioPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#e3f2fd',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#bbdefb',
    gap: 12,
  },
  audioPreviewInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioPreviewText: {
    fontSize: 14,
    color: '#0068ff',
    fontWeight: '500',
  },
  audioPreviewCancelBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPreviewSendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0068ff',
    borderRadius: 8,
  },
  audioPreviewSendBtnDisabled: {
    opacity: 0.5,
  },
  audioPreviewSendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Loading
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },

  // Long-press menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  menuBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', paddingBottom: 20,
  },
  menuItem: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  menuItemText: { fontSize: 16, color: '#111', fontWeight: '500' },
});

export default ChatScreenEnhanced;
