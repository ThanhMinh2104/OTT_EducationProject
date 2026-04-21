import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image,
  TextInput, Modal, Alert, ActivityIndicator, Linking, ScrollView, Clipboard, Platform,
  InteractionManager, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import ImageGrid from '../components/ImageGrid'; // ⭐ Import ImageGrid
import { groupMessages, isMessageGroup, Message as MessageGroupingMessage } from '../utils/messageGrouping'; // ⭐ Import grouping utilities
import AudioPlayer from '../components/AudioPlayer';
import CallScreen from './CallScreen';
import IncomingCallModal from '../components/IncomingCallModal';
import GroupCallScreen from './GroupCallScreen';
import GroupIncomingCallModal from '../components/GroupIncomingCallModal';
import { downloadAndOpenFile } from '../utils/fileDownload';
import ImageViewer from '../components/ImageViewer';
import VideoViewer from '../components/VideoViewer';
import ChatInfoPanel from '../components/ChatInfoPanel';
import AddFriendModal from '../components/AddFriendModal';
import OtherProfileModal, { OtherUser } from '../components/OtherProfileModal';
import { Swipeable } from 'react-native-gesture-handler';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { EditGroupInfoModal } from '../components/EditGroupInfoModal';

import { StackScreenProps } from '@react-navigation/stack';

type Props = Partial<StackScreenProps<RootStackParamList, any>> & {
  onChatOpen?: () => void;
  onChatClose?: () => void;
  pendingChat?: Chat | null;
  onPendingChatHandled?: () => void;
  initialChat?: Chat | null;
  onChatOpened?: () => void;
};

// ⭐ Sử dụng Message type từ messageGrouping.ts để tránh xung đột
type Message = MessageGroupingMessage;

interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: { userID: string; role: string }[];
  lastMessage: Message[];
  unreadCount?: number;
  isStranger?: boolean;
}

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
  trangThai?: string;
}

const getLastMsgPreview = (chat: Chat, userID: string): string => {
  const msgs = [...(chat.lastMessage || [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const last = msgs[msgs.length - 1];
  if (!last) return 'Chưa có tin nhắn';
  const isMine = last.senderID === userID;
  const prefix = isMine ? 'Bạn: ' : '';

  if (last.content && last.content.startsWith('##FRIENDSHIP##')) {
    return 'Các bạn đã trở thành bạn bè';
  }
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

const ChatScreenEnhanced = ({ navigation, onChatOpen, onChatClose, pendingChat, onPendingChatHandled, initialChat, onChatOpened }: Props) => {
  const insets = useSafeAreaInsets();
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
  const [currentFriendStatus, setCurrentFriendStatus] = useState<string>('none');

  // Image/Video viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState('');

  // Chat info panel state
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);

  // States cho Mention (@)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  // Pinned messages states
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [pinnedMenuId, setPinnedMenuId] = useState<string | null>(null);
  const [showPinnedList, setShowPinnedList] = useState(false);
  // Quyền ghim tin nhắn trong group
  const [canPinMessages, setCanPinMessages] = useState(true);
  // Quyền gửi tin nhắn trong group
  const [canSendMessages, setCanSendMessages] = useState(true);
  // Quyền thay đổi tên và ảnh đại diện nhóm
  const [canEditGroupInfo, setCanEditGroupInfo] = useState(true);

  // Forward message states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [selectedChatsForForward, setSelectedChatsForForward] = useState<string[]>([]);

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

  // Group call states
  const [showGroupCall, setShowGroupCall] = useState(false);
  const [groupCallIsCallee, setGroupCallIsCallee] = useState(false);
  const [groupCallData, setGroupCallData] = useState<{
    groupID: string;
    groupName: string;
    initialParticipants: { userID: string; name: string; avatar?: string }[];
  } | null>(null);
  const [incomingGroupCall, setIncomingGroupCall] = useState<{
    groupID: string;
    callerID: string;
    callerInfo: { name: string; avatar?: string };
    groupName: string;
    allMemberInfos: { userID: string; name: string; avatar?: string }[];
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination States
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Friend Profile States
  const [strangerChats, setStrangerChats] = useState<Chat[]>([]);
  const [showStrangerInbox, setShowStrangerInbox] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addFriendTarget, setAddFriendTarget] = useState<any>(null);
  const [otherProfile, setOtherProfile] = useState<OtherUser | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Xử lý pendingChat từ HomeScreen (khi tạo chat mới từ ContactsScreen)
  useEffect(() => {
    if (pendingChat) {
      console.log('📥 ChatScreenEnhanced: Handling pendingChat:', pendingChat);
      handleSelectChat(pendingChat);
      onPendingChatHandled?.();
    }
  }, [pendingChat]);

  // Load user & chats
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('user');
      if (!stored) {
        if (navigation) navigation.replace('Login');
        return;
      }
      const u = JSON.parse(stored);
      setUser(u);
      socket.emit('join_user', u.userID);
      socket.emit('getChat', u.userID);
    })();

    socket.on('ChatByUserID', (data: Chat[]) => {
      console.log('📥 Received ChatByUserID:', data.length, 'chats');

      // Phân loại chat thành bạn bè và người lạ
      const friendChats = data.filter(c => !c.isStranger);
      const strangers = data.filter(c => c.isStranger);

      const sortByTime = (arr: Chat[]) => [...arr].sort((a, b) => {
        const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
        const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
        return new Date(bT).getTime() - new Date(aT).getTime();
      });

      setChats(sortByTime(friendChats));
      setStrangerChats(sortByTime(strangers));

      console.log(`✅ Loaded ${friendChats.length} friend chats + ${strangers.length} stranger chats`);

      // Fetch member info cho tất cả private chats
      [...friendChats, ...strangers].forEach(async (c) => {
        if (c.type === 'private') {
          const stored = await AsyncStorage.getItem('user');
          if (!stored) return;
          const me = JSON.parse(stored);
          const otherId = c.members.find((m) => m.userID !== me.userID)?.userID;
          if (otherId) fetchMember(otherId);
        }
      });
    });

    // Fetch stranger chats - Đã được load cùng với getChat, không cần fetch riêng nữa
    // const fetchStrangers = async () => {
    //   try {
    //     const token = await AsyncStorage.getItem('token');
    //     const res = await fetch(`${API_URL}/api/chats/strangers`, {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    //       body: JSON.stringify({}),
    //     });
    //     const data = await res.json();
    //     if (Array.isArray(data)) {
    //       const sorted = [...data].sort((a: Chat, b: Chat) => {
    //         const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
    //         const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
    //         return new Date(bT as string).getTime() - new Date(aT as string).getTime();
    //       });
    //       setStrangerChats(sorted);
    //       sorted.forEach(async (c: Chat) => {
    //         if (c.type === 'private') {
    //           const stored = await AsyncStorage.getItem('user');
    //           if (!stored) return;
    //           const me = JSON.parse(stored);
    //           const otherId = c.members.find((m) => m.userID !== me.userID)?.userID;
    //           if (otherId) fetchMember(otherId);
    //         }
    //       });
    //     }
    //   } catch { /* ignore */ }
    // };
    // fetchStrangers();

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

    socket.on('group-call-incoming', (data: any) => {
      if (data.callerID === user?.userID) return;
      setIncomingGroupCall({
        groupID: data.groupID,
        callerID: data.callerID,
        callerInfo: data.callerInfo,
        groupName: data.groupName,
        allMemberInfos: data.allMemberInfos || [],
      });
    });

    // Lắng nghe chat mới được tạo (kể cả từ người lạ)
    socket.on('newChat1-1', (newChat: Chat) => {
      console.log('📥 Received newChat1-1:', newChat);
      console.log('  → isStranger:', newChat.isStranger);
      console.log('  → chatID:', newChat.chatID);

      // Thêm chat mới vào danh sách phù hợp
      if (newChat.isStranger) {
        console.log('  → Adding to strangerChats');
        setStrangerChats(prev => {
          const exists = prev.find(c => c.chatID === newChat.chatID);
          if (exists) return prev;
          return [newChat, ...prev].sort((a, b) => {
            const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
            const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
            return new Date(bT as string).getTime() - new Date(aT as string).getTime();
          });
        });
        setChats(prev => prev.filter(c => c.chatID !== newChat.chatID)); // Xóa khỏi danh sách bạn bè (nếu có)
      } else {
        console.log('  → Adding to chats (friends)');
        setChats(prev => {
          const exists = prev.find(c => c.chatID === newChat.chatID);
          if (exists) return prev;
          return [newChat, ...prev].sort((a, b) => {
            const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
            const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
            return new Date(bT).getTime() - new Date(aT).getTime();
          });
        });
        setStrangerChats(prev => prev.filter(c => c.chatID !== newChat.chatID)); // Xóa khỏi danh sách người lạ (nếu có)
      }

      // Fetch member info nếu là private chat
      if (newChat.type === 'private') {
        const fetchMemberInfo = async () => {
          const stored = await AsyncStorage.getItem('user');
          if (!stored) return;
          const me = JSON.parse(stored);
          const otherId = newChat.members.find((m) => m.userID !== me.userID)?.userID;
          if (otherId) fetchMember(otherId);
        };
        fetchMemberInfo();
      }
    });

    // Lắng nghe sự kiện kết bạn thành công để chuyển chat từ stranger sang friend
    socket.on('friend_request_accepted', async (data: { userID: string; friendID: string }) => {
      console.log('📥 friend_request_accepted:', data);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const me = JSON.parse(stored);

      // Tìm chat với người vừa kết bạn trong strangerChats
      setStrangerChats(prev => {
        const chatWithFriend = prev.find(c => {
          if (c.type !== 'private') return false;
          const otherId = c.members.find(m => m.userID !== me.userID)?.userID;
          return otherId === data.friendID || otherId === data.userID;
        });

        if (chatWithFriend) {
          // Chuyển chat sang danh sách bạn bè
          setChats(prevChats => {
            const exists = prevChats.find(c => c.chatID === chatWithFriend.chatID);
            if (exists) return prevChats;
            return [{ ...chatWithFriend, isStranger: false }, ...prevChats].sort((a, b) => {
              const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
              const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
              return new Date(bT).getTime() - new Date(aT).getTime();
            });
          });

          // Xóa khỏi strangerChats
          return prev.filter(c => c.chatID !== chatWithFriend.chatID);
        }

        return prev;
      });
    });

    // Đồng bộ khi bị chặn / bỏ chặn - chuyển chat giữa friend và stranger
    socket.on('friend_status_update', async (data: { userID: string; friendStatus: string; ownerID: string }) => {
      console.log('📥 friend_status_update:', data);

      const stored = await AsyncStorage.getItem('user');
      if (!stored) return;
      const me = JSON.parse(stored);

      // Nếu bị chặn (blocked), chuyển chat sang stranger
      if (data.friendStatus === 'blocked' && data.userID === me.userID) {
        setChats(prev => {
          const chatWithBlocker = prev.find(c => {
            if (c.type !== 'private') return false;
            const otherId = c.members.find(m => m.userID !== me.userID)?.userID;
            return otherId === data.ownerID;
          });

          if (chatWithBlocker) {
            // Chuyển sang strangerChats
            setStrangerChats(prevStrangers => {
              const exists = prevStrangers.find(c => c.chatID === chatWithBlocker.chatID);
              if (exists) return prevStrangers;
              return [{ ...chatWithBlocker, isStranger: true }, ...prevStrangers].sort((a, b) => {
                const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
                const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
                return new Date(bT as string).getTime() - new Date(aT as string).getTime();
              });
            });

            return prev.filter(c => c.chatID !== chatWithBlocker.chatID);
          }

          return prev;
        });
      }

      // Nếu bỏ chặn (accepted), chuyển chat về friend
      if (data.friendStatus === 'accepted') {
        setStrangerChats(prev => {
          const chatWithFriend = prev.find(c => {
            if (c.type !== 'private') return false;
            const otherId = c.members.find(m => m.userID !== me.userID)?.userID;
            return otherId === data.userID || otherId === data.ownerID;
          });

          if (chatWithFriend) {
            // Chuyển về chats
            setChats(prevChats => {
              const exists = prevChats.find(c => c.chatID === chatWithFriend.chatID);
              if (exists) return prevChats;
              return [{ ...chatWithFriend, isStranger: false }, ...prevChats].sort((a, b) => {
                const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
                const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
                return new Date(bT).getTime() - new Date(aT).getTime();
              });
            });

            return prev.filter(c => c.chatID !== chatWithFriend.chatID);
          }

          return prev;
        });
      }
    });

    return () => {
      socket.off('ChatByUserID');
      socket.off('call-made');
      socket.off('call-cancelled');
      socket.off('newChat1-1');
      socket.off('friend_request_accepted');
      socket.off('friend_status_update');
      socket.off('group-call-incoming');
    };
  }, [navigation]);

  // Xử lý khi nhận initialChat từ ContactsPanel
  useEffect(() => {
    if (initialChat && user) {
      handleSelectChat(initialChat);
      onChatOpened?.();
    }
  }, [initialChat, user]);

  // Socket listener cho Mention
  useEffect(() => {
    if (!user) return;

    const onUserMentioned = (data: any) => {
      console.log('🔔 Mobile Received user_mentioned:', data);
      if (selectedChat?.chatID === data.groupID) {
        Alert.alert('Nhắc tên', `${data.mentionerName} đã nhắc tên bạn trong nhóm`);
      }
    };

    const onGroupMentionAll = (data: any) => {
      console.log('🔔 Mobile Received group_mention_all:', data);
      if (selectedChat?.chatID === data.groupID && data.mentionerID !== user.userID) {
        Alert.alert('Nhắc tên cả nhóm', `${data.mentionerName} đã nhắc tên tất cả mọi người`);
      }
    };

    socket.on('user_mentioned', onUserMentioned);
    socket.on('group_mention_all', onGroupMentionAll);

    return () => {
      socket.off('user_mentioned', onUserMentioned);
      socket.off('group_mention_all', onGroupMentionAll);
    };
  }, [selectedChat?.chatID, user?.userID]);

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

  const [deletingChat, setDeletingChat] = useState<Chat | null>(null);

  const confirmDeleteChat = (chat: Chat) => {
    setDeletingChat(chat);
  };

  const handleDeleteChat = async () => {
    if (!deletingChat) return;
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/api/chats/${deletingChat.chatID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(prev => prev.filter(c => c.chatID !== deletingChat.chatID));
      setStrangerChats(prev => prev.filter(c => c.chatID !== deletingChat.chatID));
    } catch { /* ignore */ }
    finally { setDeletingChat(null); }
  };

  const handleUnfriend = async () => {
    if (!user || selectedChat?.type !== 'private') return;
    const otherId = selectedChat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/contacts/friend/${otherId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setCurrentFriendStatus('none');
        // Update user chats to move it to strangers locally
        setChats(prev => prev.filter(c => c.chatID !== selectedChat.chatID));
        setStrangerChats(prev => {
          const exists = prev.find(c => c.chatID === selectedChat.chatID);
          if (exists) return prev;
          return [{ ...selectedChat, isStranger: true, lastMessage: selectedChat.lastMessage || [] }, ...prev];
        });
        setSelectedChat(prev => prev ? { ...prev, isStranger: true } : prev);
      }
    } catch (err) {
      console.error("Failed to unfriend", err);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user || selectedChat?.type !== 'private') return;
    const otherId = selectedChat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/contacts/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendID: otherId }),
      });

      if (response.ok) {
        setCurrentFriendStatus('pending_sent');
        Alert.alert('Thành công', 'Đã gửi yêu cầu kết bạn');
      }
    } catch (err) {
      console.error("Failed to send friend request", err);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!user || selectedChat?.type !== 'private') return;
    const otherId = selectedChat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/contacts/accept-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senderID: otherId }),
      });

      if (response.ok) {
        setCurrentFriendStatus('accepted');
        setSelectedChat(prev => prev ? { ...prev, isStranger: false } : prev);
        Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn');
      }
    } catch (err) {
      console.error("Failed to accept friend request", err);
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!user || selectedChat?.type !== 'private') return;
    const otherId = selectedChat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/contacts/cancel-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientID: otherId }),
      });

      if (response.ok) {
        setCurrentFriendStatus('none');
        Alert.alert('Thành công', 'Đã thu hồi lời mời kết bạn');
      }
    } catch (err) {
      console.error("Failed to cancel friend request", err);
    }
  };
  const handleUserProfileById = async (targetUserID: string) => {
    if (targetUserID === 'bot') {
      setOtherProfile({
        userID: 'bot',
        name: 'AI Bot',
        sdt: '1900-BOT',
        anhDaiDien: 'https://res.cloudinary.com/dgqppqcbd/image/upload/v1727405200/ai-bot-avatar.png',
        anhBia: 'https://res.cloudinary.com/ddu7vms87/image/upload/v1740316684/p79itfnd9o7atd62269y.jpg',
        ngaysinh: new Date().toISOString(),
        gioTinh: 'AI',
        trangThai: 'online',
        friendStatus: 'none',
      });
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const [userRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/usersID`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userID: targetUserID }),
        }),
        fetch(`${API_URL}/api/contacts/friend-status/${targetUserID}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const userData = await userRes.json();
      const statusData = await statusRes.json();
      setOtherProfile({
        userID: userData.userID,
        name: userData.name,
        sdt: userData.sdt,
        anhDaiDien: userData.anhDaiDien,
        anhBia: userData.anhBia,
        ngaysinh: userData.ngaysinh,
        gioTinh: userData.gioTinh,
        trangThai: userData.trangThai,
        friendStatus: statusData.friendStatus || 'none',
      });
    } catch { /* ignore */ }
  };

  const openOtherProfile = async (chat: Chat) => {
    if (!user || chat.type !== 'private') return;
    const otherId = chat.members.find((m) => m.userID !== user.userID)?.userID;
    if (!otherId) return;
    try {
      const token = await AsyncStorage.getItem('token');
      // Lấy thông tin đầy đủ + friendStatus
      const [userRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/usersID`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userID: otherId }),
        }),
        fetch(`${API_URL}/api/contacts/friend-status/${otherId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const userData = await userRes.json();
      const statusData = await statusRes.json();
      setOtherProfile({
        userID: userData.userID,
        name: userData.name,
        sdt: userData.sdt,
        anhDaiDien: userData.anhDaiDien,
        anhBia: userData.anhBia,
        ngaysinh: userData.ngaysinh,
        gioTinh: userData.gioTinh,
        trangThai: userData.trangThai,
        friendStatus: statusData.friendStatus || 'none',
      });
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
    const isGroup = selectedChat.type === 'group';

    if (isGroup) {
      // Group chat: join_group
      socket.emit('join_group', { groupID: chatID, userID: user.userID });
    } else {
      // Private chat: join_chat
      socket.emit('join_chat', chatID);
      socket.emit('read_messages', { chatID, userID: user.userID });
    }

    const onNewMessage = (msg: Message) => {
      // Luôn cập nhật chat list preview, bất kể chat có đang mở hay không
      const updateChatList = () => {
        setChats(prev => {
          const chatExists = prev.find(c => c.chatID === msg.chatID);

          if (chatExists) {
            // Chat đã tồn tại, cập nhật tin nhắn
            const updated = prev.map(c => {
              if (c.chatID !== msg.chatID) return c;
              const msgs = c.lastMessage || [];
              const exists = msgs.find(m => m.messageID === msg.messageID || m.tempID === msg.tempID);
              const newMsgs = exists
                ? msgs.map(m => (m.messageID === msg.messageID || m.tempID === msg.tempID) ? { ...m, ...msg } : m)
                : [...msgs, msg];
              return {
                ...c,
                lastMessage: newMsgs,
                unreadCount: (!exists && msg.senderID !== user?.userID && msg.chatID !== chatID)
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount
              };
            });
            // Sort by latest message
            return updated.sort((a, b) => {
              const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
              const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
              return new Date(bT).getTime() - new Date(aT).getTime();
            });
          }
          return prev;
        });

        // ✅ Cập nhật cả danh sách người lạ (Stranger Chats)
        setStrangerChats(prev => {
          const chatExists = prev.find(c => c.chatID === msg.chatID);

          if (chatExists) {
            const updated = prev.map(c => {
              if (c.chatID !== msg.chatID) return c;
              const msgs = c.lastMessage || [];
              const exists = msgs.find(m => m.messageID === msg.messageID || m.tempID === msg.tempID);
              const newMsgs = exists
                ? msgs.map(m => (m.messageID === msg.messageID || m.tempID === msg.tempID) ? { ...m, ...msg } : m)
                : [...msgs, msg];
              return {
                ...c,
                lastMessage: newMsgs,
                unreadCount: (!exists && msg.senderID !== user?.userID && msg.chatID !== chatID)
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount
              };
            });
            // Sort by latest message
            return updated.sort((a, b) => {
              const aT = a.lastMessage?.slice(-1)[0]?.timestamp || 0;
              const bT = b.lastMessage?.slice(-1)[0]?.timestamp || 0;
              return new Date(bT).getTime() - new Date(aT).getTime();
            });
          }

          return prev;
        });
      };

      // Cập nhật chat list
      updateChatList();

      // Nếu không phải chat đang mở, không cần cập nhật messages
      if (msg.chatID !== chatID) {
        return;
      }

      // Cập nhật messages trong chat window
      setMessages(prev => {
        // Kiểm tra xem tin nhắn đã tồn tại chưa (theo messageID hoặc tempID)
        const existingIndex = prev.findIndex(m =>
          m.messageID === msg.messageID ||
          (msg.tempID && m.tempID === msg.tempID) ||
          (m.tempID && m.tempID === msg.tempID)
        );

        if (existingIndex !== -1) {
          // Tin nhắn đã tồn tại → update thay vì thêm mới
          return prev.map((m, idx) =>
            idx === existingIndex ? { ...m, ...msg, tempID: undefined } : m
          );
        }

        // Tin nhắn mới → thêm vào cuối
        return [...prev, msg];
      });

      if (msg.senderID !== user.userID) {
        socket.emit('read_messages', { chatID, userID: user.userID });
      }
    };

    // Handler cho group messages
    const onNewGroupMessage = (msg: any) => {
      const normalizedMsg: Message = {
        ...msg,
        chatID: msg.groupID || chatID,
        messageID: msg.messageID,
        tempID: undefined,
      };

      // Cập nhật chat list preview
      setChats(prev => prev.map(c => {
        if (c.chatID !== normalizedMsg.chatID) return c;
        const msgs = c.lastMessage || [];
        const exists = msgs.find(m => m.messageID === normalizedMsg.messageID);
        return exists ? c : { ...c, lastMessage: [...msgs, normalizedMsg] };
      }));

      if (msg.groupID !== chatID && msg.chatID !== chatID) return;

      // Nếu là tin nhắn của chính mình → BỎ QUA hoàn toàn
      // Chúng ta đã cập nhật tin nhắn này thông qua callback của socket.emit('send_group_message')
      // Điều này ngăn chặn triệt để lỗi duplicate do bất đồng bộ (Race condition)
      if (msg.senderID === user.userID) {
        return;
      }

      // Tin nhắn từ người khác → thêm bình thường
      setMessages(prev => {
        const exists = prev.find(m => m.messageID === normalizedMsg.messageID);
        if (exists) return prev;
        return [...prev, normalizedMsg];
      });
    };

    const onUnsend = (updated: Message) => {
      setMessages(prev => prev.map(m => m.messageID === updated.messageID ? { ...m, ...updated } : m));
    };

    const onDeletedLocal = (data: { messageID: string; chatID: string; userID: string }) => {
      if (data.userID === user.userID && data.chatID === chatID) {
        setMessages(prev => prev.filter(m => m.messageID !== data.messageID));
      }
    };

    const onTypingStart = ({ chatID: cid, userID: uid, userName, groupID }: any) => {
      const targetID = groupID || cid;
      if (uid === user.userID || targetID !== chatID) return;
      setTypingUsers(prev => prev.find(u => u.userID === uid) ? prev : [...prev, { userID: uid, userName }]);
    };

    const onTypingStop = ({ chatID: cid, userID: uid, groupID }: any) => {
      const targetID = groupID || cid;
      if (targetID !== chatID) return;
      setTypingUsers(prev => prev.filter(u => u.userID !== uid));
    };

    const onGhimNotification = (updated: Message) => {
      console.log("📌 Received ghim_notification:", updated);
      if (updated.chatID === chatID) {
        setMessages((prev) =>
          prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m))
        );
        setPinnedMessages((prev) => {
          const exists = prev.find((m) => m.messageID === updated.messageID);
          return exists
            ? prev.map((m) => (m.messageID === updated.messageID ? updated : m))
            : [...prev, updated];
        });
      }
    };

    const onUnghimNotification = (updated: Message) => {
      console.log("📌 Received unghim_notification:", updated);
      if (updated.chatID === chatID) {
        setMessages((prev) =>
          prev.map((m) => (m.messageID === updated.messageID ? { ...m, pinnedInfo: undefined } : m))
        );
        setPinnedMessages((prev) => prev.filter((m) => m.messageID !== updated.messageID));
      }
    };

    // Group chat pin/unpin events
    const onGhimGroupNotification = (updated: Message) => {
      console.log("📌 Received ghim_group_notification:", updated);
      if (updated.groupID === chatID || updated.chatID === chatID) {
        setMessages((prev) =>
          prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m))
        );
        setPinnedMessages((prev) => {
          const exists = prev.find((m) => m.messageID === updated.messageID);
          return exists
            ? prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m))
            : [...prev, updated];
        });
      }
    };

    const onUnghimGroupNotification = (updated: Message) => {
      console.log("📌 Received unghim_group_notification:", updated);
      if (updated.groupID === chatID || updated.chatID === chatID) {
        setMessages((prev) =>
          prev.map((m) => (m.messageID === updated.messageID ? { ...m, pinnedInfo: undefined } : m))
        );
        setPinnedMessages((prev) => prev.filter((m) => m.messageID !== updated.messageID));
      }
    };

    // ⭐ Group chat unsend event
    const onUnsendGroupNotification = (data: { messageID: string; groupID: string; senderID: string }) => {
      console.log("🔄 Received unsend_group_notification:", data);
      if (data.groupID === chatID) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageID === data.messageID
              ? { ...m, type: 'notification', content: 'Tin nhắn đã bị thu hồi', media_url: [] }
              : m
          )
        );
      }
    };

    // ⭐ Group chat delete local event
    const onMessageDeletedLocalGroup = (data: { messageID: string; userID: string; groupID: string }) => {
      console.log("🗑️ Received message_deleted_local (group):", data);
      if (data.userID === user.userID && data.groupID === chatID) {
        setMessages((prev) => prev.filter((m) => m.messageID !== data.messageID));
      }
    };

    // Rejoin group khi socket reconnect
    const onReconnect = () => {
      if (isGroup) {
        socket.emit('join_group', { groupID: chatID, userID: user.userID });
      } else {
        socket.emit('join_chat', chatID);
      }
    };

    // Cập nhật real-time khi tên/ảnh nhóm thay đổi
    const onGroupInfoUpdated = (data: { groupID: string; name?: string; avatar?: string }) => {
      if (data.groupID !== chatID) return;
      // Cập nhật selectedChat
      setSelectedChat(prev => {
        if (!prev || prev.chatID !== data.groupID) return prev;
        return {
          ...prev,
          name: data.name ?? prev.name,
          avatar: data.avatar ?? prev.avatar,
        };
      });
      // Cập nhật danh sách chat
      setChats(prev => prev.map(c =>
        c.chatID === data.groupID
          ? { ...c, name: data.name ?? c.name, avatar: data.avatar ?? c.avatar }
          : c
      ));
    };

    socket.on('new_message', onNewMessage);
    // Lắng nghe group messages
    if (isGroup) {
      socket.on('new_group_message', onNewGroupMessage);
      socket.on('group_typing_start', onTypingStart);
      socket.on('group_typing_stop', onTypingStop);
      socket.on('group_info_updated', onGroupInfoUpdated);
      socket.on('unsend_group_notification', onUnsendGroupNotification);  // ⭐ MỚI THÊM
      socket.on('message_deleted_local', onMessageDeletedLocalGroup);  // ⭐ MỚI THÊM
    } else {
      socket.on('typing_start', onTypingStart);
      socket.on('typing_stop', onTypingStop);
      socket.on('unsend_notification', onUnsend);
      socket.on('message_deleted_local', onDeletedLocal);
    }
    socket.on('ghim_notification', onGhimNotification);
    socket.on('unghim_notification', onUnghimNotification);
    socket.on('ghim_group_notification', onGhimGroupNotification);
    socket.on('unghim_group_notification', onUnghimGroupNotification);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('new_message', onNewMessage);
      if (isGroup) {
        socket.off('new_group_message', onNewGroupMessage);
        socket.off('group_typing_start', onTypingStart);
        socket.off('group_typing_stop', onTypingStop);
        socket.off('group_info_updated', onGroupInfoUpdated);
        socket.off('unsend_group_notification', onUnsendGroupNotification);  // ⭐ MỚI THÊM
        socket.off('message_deleted_local', onMessageDeletedLocalGroup);  // ⭐ MỚI THÊM
        socket.emit('leave_group', { groupID: chatID, userID: user.userID });
      } else {
        socket.off('typing_start', onTypingStart);
        socket.off('typing_stop', onTypingStop);
        socket.off('unsend_notification', onUnsend);
        socket.off('message_deleted_local', onDeletedLocal);
      }
      socket.off('ghim_notification', onGhimNotification);
      socket.off('unghim_notification', onUnghimNotification);
      socket.off('ghim_group_notification', onGhimGroupNotification);
      socket.off('unghim_group_notification', onUnghimGroupNotification);
      socket.off('connect', onReconnect);
      setTypingUsers([]);
    };
  }, [selectedChat?.chatID, user?.userID]);

  const handleSelectChat = (chat: Chat) => {
    // Đảm bảo chat có trong danh sách
    const chatInList = chats.find(c => c.chatID === chat.chatID) || strangerChats.find(c => c.chatID === chat.chatID);
    if (!chatInList) {
      if (chat.isStranger) {
        setStrangerChats(prev => [chat, ...prev]);
      } else {
        setChats(prev => [chat, ...prev]);
      }
    }

    // Hiển thị ngay cached messages từ lastMessage (không block UI)
    const cachedMessages = chat.lastMessage || [];
    const normalizedCached = chat.type === 'group'
      ? cachedMessages.map((m: any) => ({ ...m, chatID: m.groupID || chat.chatID }))
      : cachedMessages;
    setSelectedChat(chat);
    setMessages(normalizedCached);
    setPinnedMessages(normalizedCached.filter((m: any) => m.pinnedInfo?.pinnedBy));
    setReplyTo(null);
    setInputText('');
    setPage(1);
    setHasMore(true);
    setIsLoadingMore(false);
    onChatOpen?.();

    // Fetch member info và friend status
    if (user) {
      if (chat.type === 'private') {
        const otherId = chat.members.find((m) => m.userID !== user.userID)?.userID;
        if (otherId) {
          fetchMember(otherId);
          AsyncStorage.getItem('token').then(token => {
            if (!token) return;
            fetch(`${API_URL}/api/contacts/friend-status/${otherId}`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json()).then(data => {
              setCurrentFriendStatus(data.friendStatus || 'none');
            }).catch(() => setCurrentFriendStatus('none'));
          });
        }
      } else if (chat.type === 'group') {
        // Fetch thông tin tất cả thành viên trong nhóm để hiển thị tên khi mention
        chat.members.forEach((m) => {
          if (m.userID !== user.userID) fetchMember(m.userID);
        });
      }
    }

    // Fetch full messages trong background (không block render)
    const fetchFullMessages = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        if (chat.type === 'group') {
          const groupID = chat.chatID;
          const res = await fetch(`${API_URL}/api/groups/${groupID}/messages?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages)) {
            const normalized = data.messages.map((m: any) => ({
              ...m,
              chatID: m.groupID || groupID,
            }));
            // Chỉ update nếu vẫn đang ở chat này
            setSelectedChat(current => {
              if (current?.chatID === chat.chatID) {
                setMessages(normalized);
                setPinnedMessages(normalized.filter((m: any) => m.pinnedInfo?.pinnedBy));
              }
              return current;
            });
          }
        } else {
          const res = await fetch(`${API_URL}/api/messages/id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ chatID: chat.chatID, page: 1, limit: 50 }),
          });
          const data = await res.json();
          const messageArray = Array.isArray(data) ? data : (data.messages || []);
          if (messageArray && Array.isArray(messageArray)) {
            const seen = new Set<string>();
            const deduped = messageArray.filter((m: Message) => {
              const key = m.messageID || m.tempID || '';
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setSelectedChat(current => {
              if (current?.chatID === chat.chatID) {
                setMessages(deduped);
                setPinnedMessages(deduped.filter((m: any) => m.pinnedInfo?.pinnedBy));
                setHasMore(Array.isArray(data) ? false : (data.page * data.limit < data.total));
              }
              return current;
            });
          }
        }
      } catch (err) {
        // Giữ nguyên cached messages nếu fetch thất bại
      }
    };

    // Fetch quyền cho group chat (ghim + gửi tin nhắn)
    const fetchGroupSettings = async () => {
      if (chat.type === 'group') {
        try {
          const token = await AsyncStorage.getItem('token');
          const settingsRes = await fetch(`${API_URL}/api/groups/${chat.chatID}/settings`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            const userStored = await AsyncStorage.getItem('user');
            const me = userStored ? JSON.parse(userStored) : null;
            const myMember = chat.members.find((m: any) => m.userID === me?.userID);
            const isOwnerOrAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
            const perms = settingsData.settings?.memberPermissions;
            // owner/admin luôn có quyền; member thường phụ thuộc setting
            setCanPinMessages(isOwnerOrAdmin || (perms?.pinMessages ?? true));
            setCanSendMessages(isOwnerOrAdmin || (perms?.sendMessages ?? true));
            setCanEditGroupInfo(isOwnerOrAdmin || (perms?.changeNameAvatar ?? true));
          }
        } catch { /* fallback: cho phép tất cả */ }
      } else {
        setCanPinMessages(true);
        setCanSendMessages(true);
        setCanEditGroupInfo(true);
      }
    };

    // Chạy fetch data SAU KHI animation chuyển màn hình hoàn tất
    // Giúp UX khi mở màn hình chat mượt mà hơn, không bị giật/khựng
    InteractionManager.runAfterInteractions(() => {
      fetchFullMessages();
      fetchGroupSettings();
    });
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore || !selectedChat) return;
    try {
      setIsLoadingMore(true);
      const token = await AsyncStorage.getItem('token');
      const nextPage = page + 1;
      let newMessages: Message[] = [];
      let hasMoreData = false;

      if (selectedChat.type === 'group') {
        const res = await fetch(`${API_URL}/api/groups/${selectedChat.chatID}/messages?page=${nextPage}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.messages) {
          newMessages = data.messages.map((m: any) => ({ ...m, chatID: m.groupID || selectedChat.chatID }));
          hasMoreData = (data.page * 50 < data.total);
        }
      } else {
        const res = await fetch(`${API_URL}/api/messages/id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ chatID: selectedChat.chatID, page: nextPage, limit: 50 }),
        });
        const data = await res.json();
        newMessages = Array.isArray(data) ? [] : (data.messages || []);
        hasMoreData = Array.isArray(data) ? false : (data.page * data.limit < data.total);
      }

      if (newMessages.length > 0) {
        setMessages(prev => {
          const seen = new Set(prev.map((m: any) => m.messageID || m.tempID));
          const filtered = newMessages.filter(m => {
            const k = m.messageID || m.tempID;
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
          return [...filtered, ...prev]; // Prepend tin nhắn cũ lên đầu
        });
        setPage(nextPage);
      }
      setHasMore(hasMoreData);
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  };

  const buildMsg = (extra: Partial<Message>): Message => ({
    tempID: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    chatID: selectedChat!.chatID,
    senderID: user!.userID,
    timestamp: new Date().toISOString(),
    status: 'sent',
    senderInfo: { name: user!.name, avatar: user!.anhDaiDien || null },
    replyTo: replyTo ? { messageID: replyTo.messageID, senderID: replyTo.senderID, content: replyTo.content, type: replyTo.type } : null,
    mentions: mentions, // Gửi danh sách tag
    ...extra,
  } as Message);

  const dispatchMessageContent = (
    msgData: { content: string, type: Message['type'], media_url: string[], groupId?: string },
    currentReplyTo?: typeof replyTo
  ) => {
    if (!selectedChat || !user) return;
    const isGroup = selectedChat.type === 'group';
    const chatID = selectedChat.chatID;

    console.log('📤 dispatchMessageContent:', {
      isGroup,
      chatID,
      type: msgData.type,
      hasMediaUrl: msgData.media_url?.length > 0,
      mediaUrl: msgData.media_url?.[0]?.substring(0, 50),
    });

    if (isGroup) {
      const tempID = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tempMsg: Message = {
        messageID: tempID,
        tempID,
        chatID,
        senderID: user.userID,
        content: msgData.content,
        type: msgData.type,
        media_url: msgData.media_url,
        groupId: msgData.groupId,
        timestamp: new Date().toISOString(),
        status: 'sending',
        senderInfo: { name: user.name, avatar: user.anhDaiDien || null },
        replyTo: currentReplyTo
          ? { messageID: currentReplyTo.messageID, senderID: currentReplyTo.senderID, content: currentReplyTo.content, type: currentReplyTo.type }
          : null,
      } as Message;
      setMessages(prev => [...prev, tempMsg]);

      console.log('📡 Emitting send_group_message:', {
        groupID: chatID,
        type: msgData.type,
        mediaUrlCount: msgData.media_url?.length,
      });

      socket.emit('send_group_message', {
        groupID: chatID,
        senderID: user.userID,
        content: msgData.content,
        type: msgData.type,
        media_url: msgData.media_url,
        groupId: msgData.groupId,
        replyTo: currentReplyTo
          ? { messageID: currentReplyTo.messageID, senderID: currentReplyTo.senderID, content: currentReplyTo.content, type: currentReplyTo.type }
          : undefined,
        senderInfo: { name: user.name, avatar: user.anhDaiDien || null },
      }, (ack: any) => {
        console.log('✅ Received callback from send_group_message:', {
          success: ack?.success,
          hasMessage: !!ack?.message,
          error: ack?.error,
        });

        if (ack?.success && ack?.message) {
          const realMsg: Message = {
            ...ack.message,
            chatID: ack.message.groupID || chatID,
            tempID: undefined,
          };
          setMessages(prev => {
            const withoutTemp = prev.filter(m => m.tempID !== tempID);
            const alreadyExists = withoutTemp.find(m => m.messageID === realMsg.messageID);
            return alreadyExists ? withoutTemp : [...withoutTemp, realMsg];
          });
        } else if (!ack?.success) {
          console.error('❌ Message send failed:', ack?.error);
          setMessages(prev => prev.map(m => m.tempID === tempID ? { ...m, status: 'error' } : m));
        }
      });
    } else {
      const msg = buildMsg({ ...msgData, replyTo: currentReplyTo ? currentReplyTo : null });
      socket.emit('send_message', msg);
      setMessages(prev => [...prev, msg]);
    }
  };

  const sendMessage = () => {
    if (!inputText.trim() || !selectedChat || !user) return;
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

    const isGroup = selectedChat.type === 'group';
    const chatID = selectedChat.chatID;

    if (isGroup) {
      socket.emit('group_typing_stop', { groupID: chatID, userID: user.userID });
    } else {
      socket.emit('typing_stop', { chatID, userID: user.userID, userName: user.name });
    }

    const content = inputText.trim();
    const capturedReplyTo = replyTo;
    setInputText('');
    setReplyTo(null);
    setMentions([]); // Reset tag sau khi gửi

    dispatchMessageContent({ content, type: 'text', media_url: [] }, capturedReplyTo);
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
    if (!selectedChat || !user) return;

    // Logic phát hiện Mention cho Mobile
    if (selectedChat.type === 'group') {
      const atIndex = value.lastIndexOf('@');
      // Kiểm tra xem ký tự @ có ở đầu hoặc sau khoảng trắng không
      if (atIndex !== -1 && (atIndex === 0 || value[atIndex - 1] === ' ')) {
        const query = value.substring(atIndex + 1);
        if (!query.includes(' ')) {
          setMentionSearch(query);
          setShowMentionDropdown(true);
        } else {
          setShowMentionDropdown(false);
        }
      } else {
        setShowMentionDropdown(false);
      }
    }

    socket.emit('typing_start', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatID: selectedChat.chatID, userID: user.userID, userName: user.name });
    }, 2000);
  };

  const handleMentionSelect = (member: User | 'all') => {
    const atIndex = inputText.lastIndexOf('@');
    const textBeforeMention = inputText.substring(0, atIndex);

    let mentionText = '';
    if (member === 'all') {
      mentionText = '@all ';
    } else {
      mentionText = `@${member.name} `;
      setMentions(prev => [...new Set([...prev, member.userID])]);
    }

    setInputText(textBeforeMention + mentionText);
    setShowMentionDropdown(false);
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

    console.log('📤 uploadFiles called:', {
      fileCount: files.length,
      chatType: selectedChat.type,
      chatID: selectedChat.chatID,
    });

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

      console.log('⬆️ Uploading files to server...');
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      console.log('✅ Upload response:', {
        status: res.status,
        urlCount: data.urls?.length,
        firstUrl: data.urls?.[0]?.substring(0, 50),
      });

      if (data.urls?.length > 0) {
        const msgType = files[0].type === 'image'
          ? 'image'
          : files[0].type === 'video'
            ? 'video'
            : 'file';

        // ⭐ Tạo groupId cho batch ảnh (2+ ảnh)
        const groupId = msgType === 'image' && data.urls.length > 1
          ? `group_${Date.now()}_${user.userID}`
          : undefined;

        console.log('📨 Sending', data.urls.length, 'messages with type:', msgType);

        // Gửi từng ảnh/video/file riêng biệt
        for (let i = 0; i < data.urls.length; i++) {
          dispatchMessageContent({
            content: msgType === 'file' ? (files[i]?.name || '') : '',
            type: msgType,
            media_url: [data.urls[i]],
            groupId, // ⭐ Thêm groupId
          }, replyTo || undefined);

          // Delay nhỏ giữa các lần gửi
          if (i < data.urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        setReplyTo(null);
      } else {
        console.error('❌ No URLs in upload response');
        Alert.alert('Lỗi', 'Không nhận được URL từ server');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
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

      console.log('Sending audio message...');
      dispatchMessageContent({
        content: '',
        type: 'audio',
        media_url: [data.url],
      }, replyTo || undefined);
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
    dispatchMessageContent({ content: '', type: 'sticker', media_url: [url] }, replyTo || undefined);
    setShowEmoji(false);
    setReplyTo(null);
  };

  const handleGifSelect = (url: string) => {
    if (!selectedChat || !user) return;
    dispatchMessageContent({ content: '', type: 'gif', media_url: [url] }, replyTo || undefined);
    setShowEmoji(false);
    setReplyTo(null);
  };

  const handleDeleteLocal = (msg: Message) => {
    if (!msg.messageID || !user?.userID || !selectedChat) return;

    const isGroup = selectedChat.type === 'group';

    // ⭐ Tìm tất cả messages trong cùng group (nếu có)
    let messagesToDelete: Message[] = [msg];
    if (msg.type === 'image' && msg.groupId) {
      messagesToDelete = messages.filter(m => m.groupId === msg.groupId);
      console.log(`📸 Deleting ${messagesToDelete.length} images from group ${msg.groupId}`);
    }

    // Gửi socket event cho từng message
    messagesToDelete.forEach((message) => {
      if (isGroup) {
        // ⭐ Group chat: emit delete_group_message_local
        socket.emit('delete_group_message_local', {
          messageID: message.messageID,
          userID: user.userID,
          groupID: selectedChat.chatID
        });
      } else {
        // Private chat: emit delete_message_local
        socket.emit('delete_message_local', {
          messageID: message.messageID,
          userID: user.userID,
          chatID: selectedChat.chatID
        });
      }
    });

    setShowMenu(false);
  };

  const handleUnsend = (msg: Message) => {
    if (!msg.messageID || msg.senderID !== user?.userID) return;

    const isGroup = selectedChat?.type === 'group';

    // ⭐ Backend sẽ tự động xử lý toàn bộ group nếu message thuộc group
    // Chỉ cần gửi 1 lần cho message đầu tiên
    console.log('🔄 Unsending message:', msg.messageID, msg.groupId ? `(group: ${msg.groupId})` : '');

    if (isGroup) {
      // ⭐ Group chat: emit unsend_group_message
      socket.emit('unsend_group_message', {
        messageID: msg.messageID,
        groupID: selectedChat!.chatID,
        senderID: user.userID
      });
    } else {
      // Private chat: emit unsend_message
      socket.emit('unsend_message', {
        messageID: msg.messageID,
        chatID: selectedChat!.chatID,
        senderID: user.userID
      });
    }

    setShowMenu(false);
  };

  const handleForwardMessage = (msg: Message) => {
    if (!msg.messageID) {
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn này');
      return;
    }
    setForwardingMessage(msg);
    setSelectedChatsForForward([]);
    setShowMenu(false);
    setShowForwardModal(true);
  };

  const handleForwardSubmit = async () => {
    if (!forwardingMessage || !user || selectedChatsForForward.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một cuộc trò chuyện');
      return;
    }

    try {
      console.log('🔄 Forwarding message to', selectedChatsForForward.length, 'chats');

      // Determine source chat type
      const isSourceGroup = selectedChat?.type === 'group';
      const sourceChatID = selectedChat?.chatID;

      // Sử dụng socket event thay vì API
      for (const targetChatID of selectedChatsForForward) {
        console.log('📤 Forwarding to chat:', targetChatID);

        // Determine target chat type
        const targetChat = chats.find(c => c.chatID === targetChatID);
        const isTargetGroup = targetChat?.type === 'group';

        console.log('📊 Forward info:', {
          isSourceGroup,
          isTargetGroup,
          sourceChatID,
          targetChatID,
        });

        // Emit appropriate socket event based on target type
        if (isTargetGroup) {
          // Forward to group chat
          socket.emit('forward_to_group', {
            originalMessageID: forwardingMessage.messageID,
            originalChatID: isSourceGroup ? undefined : sourceChatID,
            originalGroupID: isSourceGroup ? sourceChatID : undefined,
            targetGroupID: targetChatID,
            senderID: user.userID,
            senderInfo: {
              name: user.name,
              avatar: user.anhDaiDien || null,
            },
          });
        } else {
          // Forward to private chat
          socket.emit('forward_message', {
            originalMessageID: forwardingMessage.messageID,
            originalChatID: isSourceGroup ? undefined : sourceChatID,
            originalGroupID: isSourceGroup ? sourceChatID : undefined,
            targetChatID,
            senderID: user.userID,
            senderInfo: {
              name: user.name,
              avatar: user.anhDaiDien || null,
            },
          });
        }
      }

      Alert.alert('Thành công', `Đã chuyển tiếp tin nhắn đến ${selectedChatsForForward.length} cuộc trò chuyện`);
      setShowForwardModal(false);
      setForwardingMessage(null);
      setSelectedChatsForForward([]);
    } catch (error) {
      console.error('Forward error:', error);
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn');
    }
  };

  const toggleChatSelection = (chatID: string) => {
    setSelectedChatsForForward(prev =>
      prev.includes(chatID)
        ? prev.filter(id => id !== chatID)
        : [...prev, chatID]
    );
  };

  const startCall = (type: 'voice' | 'video') => {
    setCallType(type);
    setShowCall(true);
  };

  const handleLongPress = (msg: Message) => {
    setSelectedMessage(msg);
    setShowMenu(true);
  };

  const handleMoveToTop = (msg: Message) => {
    if (!msg.messageID || !selectedChat) return;
    const isGroup = selectedChat.type === 'group';
    const pinEvent = isGroup ? 'ghim_group_message' : 'ghim_message';
    const unpinEvent = isGroup ? 'unghim_group_message' : 'unghim_message';
    const payload = isGroup
      ? { messageID: msg.messageID, groupID: selectedChat.chatID, senderID: user!.userID }
      : { messageID: msg.messageID, chatID: selectedChat.chatID, senderID: user!.userID };

    // Bỏ ghim rồi ghim lại để đưa lên đầu
    socket.emit(unpinEvent, payload);
    setTimeout(() => {
      socket.emit(pinEvent, payload);
    }, 100);
    setPinnedMenuId(null);
    Alert.alert("Thành công", "Đã đưa lên đầu");
  };

  const handleCopyPinned = (msg: Message) => {
    if (msg.content) {
      Clipboard.setString(msg.content);
      Alert.alert("Thành công", "Đã sao chép");
    }
    setPinnedMenuId(null);
  };

  const handleUnpinFromMenu = (msg: Message) => {
    if (!msg.messageID || !selectedChat) return;
    const isGroup = selectedChat.type === 'group';
    const unpinEvent = isGroup ? 'unghim_group_message' : 'unghim_message';
    const payload = isGroup
      ? { messageID: msg.messageID, groupID: selectedChat.chatID, senderID: user!.userID }
      : { messageID: msg.messageID, chatID: selectedChat.chatID, senderID: user!.userID };
    socket.emit(unpinEvent, payload);
    setPinnedMenuId(null);
    Alert.alert("Thành công", "Đã bỏ ghim");
  };

  const scrollToMessage = (messageID?: string) => {
    if (!messageID) return;

    // ⭐ Tạo mảng grouped giống như trong FlatList
    const uniqueMessages = messages.filter((msg, idx, arr) =>
      arr.findIndex(m =>
        (m.messageID && m.messageID === msg.messageID) ||
        (m.tempID && m.tempID === msg.tempID && !msg.messageID)
      ) === idx
    );
    const groupedData = groupMessages(uniqueMessages);

    // ⭐ Tìm index trong mảng grouped
    const index = groupedData.findIndex((item) => {
      if (isMessageGroup(item)) {
        // Kiểm tra xem messageID có trong group không
        return item.messages.some((msg: Message) => msg.messageID === messageID);
      }
      return item.messageID === messageID;
    });

    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setShowInfoPanel(false);
    }
  };

  const renderMessage = (item: Message) => {
    const isMine = item.senderID === user?.userID;
    const isUnsent = item.type === 'unsend';
    const isNotification = item.type === 'notification';
    const isNotif = item.type === 'notification';
    const timeStr = new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Render notification messages (ghim, bỏ ghim, etc.)
    if (isNotification) {
      const content = item.content || '';
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
          <View key={item.messageID || item.tempID} style={styles.notifContainer}>
            <View style={styles.notifBadge}>
              <Text style={styles.notifText}>
                Bạn và{' '}
                <Text
                  style={{ fontWeight: 'bold', color: '#0068ff' }}
                  onPress={async () => {
                    try {
                      const token = await AsyncStorage.getItem('token');
                      const [userRes, statusRes] = await Promise.all([
                        fetch(`${API_URL}/api/usersID`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ userID: friendID }),
                        }),
                        fetch(`${API_URL}/api/contacts/friend-status/${friendID}`, {
                          headers: { Authorization: `Bearer ${token}` },
                        }),
                      ]);
                      const userData = await userRes.json();
                      const statusData = await statusRes.json();
                      setOtherProfile({
                        userID: userData.userID,
                        name: userData.name,
                        sdt: userData.sdt,
                        anhDaiDien: userData.anhDaiDien,
                        anhBia: userData.anhBia,
                        ngaysinh: userData.ngaysinh,
                        gioTinh: userData.gioTinh,
                        trangThai: userData.trangThai,
                        friendStatus: statusData.friendStatus || 'none',
                      });
                    } catch (err) {
                      console.error('Failed to fetch friend profile:', err);
                    }
                  }}
                >
                  {friendName}
                </Text>
                {' '}đã trở thành bạn bè.{isNew ? ' Hãy bắt đầu cuộc trò chuyện.' : ''}
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View key={item.messageID || item.tempID} style={styles.notificationContainer}>
          <View style={styles.notificationBubble}>
            <Text style={styles.notificationText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    // Group call message
    if (item.type === 'group-call') {
      return (
        <View key={item.messageID || item.tempID} style={styles.groupCallMsgWrapper}>
          <TouchableOpacity
            style={styles.groupCallMsgCard}
            onPress={() => {
              if (!selectedChat) return;
              socket.emit('group-call-check', { groupID: selectedChat.chatID }, (active: boolean) => {
                if (active) {
                  setGroupCallData({
                    groupID: selectedChat.chatID,
                    groupName: selectedChat.name,
                    initialParticipants: [],
                  });
                  setGroupCallIsCallee(true);
                  setShowGroupCall(true);
                } else {
                  Alert.alert('Thông báo', 'Cuộc gọi đã kết thúc');
                }
              });
            }}
            activeOpacity={0.8}
          >
            <View style={styles.groupCallMsgIcon}>
              <Ionicons name="videocam" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupCallMsgTitle}>Cuộc gọi nhóm</Text>
              <Text style={styles.groupCallMsgSub}>{item.senderInfo?.name} đã bắt đầu</Text>
            </View>
            <View style={styles.groupCallJoinBtn}>
              <Text style={styles.groupCallJoinText}>Tham gia</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.groupCallTime}>{timeStr}</Text>
        </View>
      );
    }

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
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={500}
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
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
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
          <TouchableOpacity
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            activeOpacity={1}
          >
            <Image source={{ uri: item.media_url[0] }} style={styles.stickerImage} />
            <Text style={[styles.messageTime, styles.timeOnMediaOther]}>{timeStr}</Text>
          </TouchableOpacity>
        );
      }
      if (item.type === 'gif' && item.media_url?.[0]) {
        return (
          <TouchableOpacity
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            activeOpacity={1}
          >
            <Image source={{ uri: item.media_url[0] }} style={styles.gifImage} />
            <Text style={[styles.messageTime, isMine ? styles.timeOnMedia : styles.timeOnMediaOther]}>
              {timeStr}
            </Text>
          </TouchableOpacity>
        );
      }
      if (item.type === 'audio' && item.media_url?.[0]) {
        return (
          <TouchableOpacity
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            activeOpacity={1}
            style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
          >
            <AudioPlayer audioUrl={item.media_url[0]} isMine={isMine} />
            <Text style={[styles.messageTime, isMine ? styles.timeMine : styles.timeOther]}>{timeStr}</Text>
          </TouchableOpacity>
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
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
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
        <View style={[
          styles.messageBubble,
          isMine ? styles.bubbleMine : styles.bubbleOther,
          item.pinnedInfo && styles.bubblePinned
        ]}>
          {item.pinnedInfo && (
            <View style={styles.pinnedIndicator}>
              <Text style={styles.pinnedIndicatorText}>📌 Đã ghim</Text>
            </View>
          )}
          {item.replyTo && (
            <View style={[styles.replyInBubble, isMine ? styles.replyInBubbleMine : styles.replyInBubbleOther]}>
              <Text style={[styles.replyInBubbleText, isMine && { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={1}>
                ↩ {item.replyTo.content || '[Media]'}
              </Text>
            </View>
          )}
          {renderMentionedText(item.content || '', isMine, item.mentions)}
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
          <TouchableOpacity onPress={() => handleUserProfileById(item.senderID)}>
            <Image
              source={{
                uri: item.senderInfo?.avatar ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.senderID}`,
              }}
              style={styles.msgAvatar}
            />
          </TouchableOpacity>
        )}
        <View style={[styles.msgContent, isMine ? styles.msgContentMine : styles.msgContentOther]}>
          {renderBubbleContent()}
        </View>
        {/* Spacer bên phải cho tin nhắn người khác */}
        {!isMine && <View style={{ width: 48 }} />}
      </TouchableOpacity>
    );
  };

  // ⭐ Render message group (multiple images sent together)
  const renderMessageGroup = (group: import('../utils/messageGrouping').MessageGroup) => {
    const isMine = group.senderID === user?.userID;
    const firstMsg = group.messages[0] as Message; // ⭐ Cast to local Message type
    const timeStr = new Date(group.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
        {/* Avatar bên trái cho tin nhắn người khác */}
        {!isMine && (
          <TouchableOpacity onPress={() => handleUserProfileById(group.senderID)}>
            <Image
              source={{
                uri: firstMsg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.senderID}`,
              }}
              style={styles.msgAvatar}
            />
          </TouchableOpacity>
        )}

        <View style={[styles.msgContent, isMine ? styles.msgContentMine : styles.msgContentOther]}>
          {/* Tên người gửi trong nhóm */}
          {!isMine && selectedChat?.type === 'group' && (
            <Text style={styles.groupSenderName}>{firstMsg.senderInfo?.name || 'Unknown'}</Text>
          )}

          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              onLongPress={() => handleLongPress(firstMsg)}
              delayLongPress={500}
              activeOpacity={0.9}
            >
              <ImageGrid
                messages={group.messages as any}
                onImageClick={(url, allUrls) => {
                  setSelectedImages(allUrls);
                  setSelectedImageIndex(allUrls.indexOf(url));
                  setImageViewerVisible(true);
                }}
              />
            </TouchableOpacity>

            {/* Action buttons - hiện cho cả người gửi và người nhận */}
            <View style={styles.imageGroupActions}>
              {/* Forward button */}
              <TouchableOpacity
                style={styles.imageGroupActionBtn}
                onPress={() => handleForwardMessage(firstMsg)}
              >
                <Ionicons name="arrow-redo-outline" size={18} color="#fff" />
              </TouchableOpacity>

              {/* Menu button */}
              <TouchableOpacity
                style={styles.imageGroupActionBtn}
                onPress={() => {
                  setSelectedMessage(firstMsg);
                  setShowMenu(true);
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.messageTime, isMine ? styles.timeOnMedia : styles.timeOnMediaOther]}>
            {timeStr}
          </Text>
        </View>

        {/* Spacer bên phải cho tin nhắn người khác */}
        {!isMine && <View style={{ width: 48 }} />}
      </View>
    );
  };

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // ===== CHAT LIST VIEW =====
  if (!selectedChat) {
    return (
      <View style={styles.container}>
        <View style={[styles.listHeader, { paddingTop: insets.top + 10 }]}>
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
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowCreateGroup(true)}>
            <Ionicons name="people" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowAddFriend(true)}>
            <Ionicons name="person-add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredChats}
          keyExtractor={item => item.chatID}
          ListHeaderComponent={
            strangerChats.length > 0 ? (
              <TouchableOpacity
                style={styles.strangerFolder}
                onPress={() => setShowStrangerInbox(true)}
              >
                <View style={styles.strangerAvatarStack}>
                  {strangerChats.slice(0, 3).map((c, i) => (
                    <Image
                      key={c.chatID}
                      source={{ uri: getChatAvatar(c) }}
                      style={[styles.strangerStackAvatar, { left: i * 16, zIndex: 3 - i }]}
                    />
                  ))}
                </View>
                <View style={styles.strangerInfo}>
                  <Text style={styles.strangerTitle}>Tin nhắn từ người lạ</Text>
                  <Text style={styles.strangerSub} numberOfLines={1}>
                    {strangerChats.length} cuộc trò chuyện
                  </Text>
                </View>
                <View style={styles.strangerBadge}>
                  <Text style={styles.strangerBadgeText}>{strangerChats.length}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.swipeDeleteBtn}
                  onPress={() => confirmDeleteChat(item)}
                >
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text style={styles.swipeDeleteText}>Xóa</Text>
                </TouchableOpacity>
              )}
              overshootRight={false}
            >
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
            </Swipeable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào</Text>
            </View>
          }
        />



        {/* Stranger Inbox */}
        <Modal
          visible={showStrangerInbox}
          animationType="slide"
          onRequestClose={() => setShowStrangerInbox(false)}
        >
          <View style={styles.strangerScreen}>
            {/* Header */}
            <View style={[styles.strangerHeader, { paddingTop: insets.top + 6 }]}>
              <TouchableOpacity onPress={() => setShowStrangerInbox(false)} style={styles.backButton}>
                <Ionicons name="chevron-back" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.strangerHeaderTitle}>Tin nhắn từ người lạ</Text>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => {
                  Alert.alert(
                    'Xóa tất cả',
                    'Xóa tất cả tin nhắn từ người lạ?',
                    [
                      { text: 'Hủy', style: 'cancel' },
                      {
                        text: 'Xóa tất cả', style: 'destructive',
                        onPress: async () => {
                          try {
                            const token = await AsyncStorage.getItem('token');
                            await Promise.all(strangerChats.map(c =>
                              fetch(`${API_URL}/api/chats/${c.chatID}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` },
                              })
                            ));
                            setStrangerChats([]);
                          } catch { /* ignore */ }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Info banner */}
            <View style={styles.strangerBanner}>
              <Text style={styles.strangerBannerText}>
                Người lạ có thể nhắn tin cho bạn.
              </Text>
            </View>

            {/* List */}
            <FlatList
              data={strangerChats}
              keyExtractor={c => c.chatID}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.chatItem}
                  onPress={() => {
                    setShowStrangerInbox(false);
                    handleSelectChat(item);
                  }}
                >
                  <Image source={{ uri: getChatAvatar(item) }} style={styles.chatAvatar} />
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
                  <Text style={styles.emptyEmoji}>📭</Text>
                  <Text style={styles.emptyText}>Không có tin nhắn từ người lạ</Text>
                </View>
              }
            />
          </View>
        </Modal>

        {/* Add Friend Modal */}
        <AddFriendModal
          visible={showAddFriend}
          onClose={() => {
            setShowAddFriend(false);
            setAddFriendTarget(null);
          }}
          currentUser={user ? { userID: user.userID, name: user.name } : null}
          initialUser={addFriendTarget}
        />

        {/* Create Group Modal */}
        <CreateGroupModal
          visible={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(groupID) => {
            setShowCreateGroup(false);
            // Reload chats
            if (user) {
              socket.emit('getChat', user.userID);
            }
          }}
          currentUser={user}
        />
      </View>
    );
  }

  const handleHeaderPress = () => {
    if (selectedChat?.type === 'group') {
      if (canEditGroupInfo) {
        setShowEditGroupModal(true);
      }
      return;
    }
    if (selectedChat?.type !== 'private') return;
    openOtherProfile(selectedChat);
  };

  const renderMentionedText = (content: string, isMine: boolean, messageMentions?: string[]) => {
    if (!content) return null;
    
    // Kiểm tra xem có tag nào không
    const lowerContent = content.toLowerCase();
    const hasSpecial = ['@all', '@bot', '@gif', '@sticker'].some(s => lowerContent.includes(s));
    const hasMentions = (messageMentions && messageMentions.length > 0) || hasSpecial;
    
    if (!hasMentions) {
      return <Text style={[styles.messageText, isMine ? styles.textMine : styles.textOther]}>{content}</Text>;
    }

    // Lấy thông tin thành viên từ memberCache để có "name"
    const sortedMembers = (selectedChat?.members || [])
      .map(m => memberCache[m.userID])
      .filter(u => !!u && !!u.name)
      .sort((a, b) => b.name.length - a.name.length);
    
    const memberPatterns = sortedMembers.map(u => u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const allPatterns = `All|Bot|GIF|STICKER${memberPatterns ? '|' + memberPatterns : ''}`;
    const regex = new RegExp(`(@(?:${allPatterns}))`, 'gi');
    
    const parts = content.split(regex);

    return (
      <Text style={[styles.messageText, isMine ? styles.textMine : styles.textOther]}>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            const candidate = part.substring(1).toLowerCase().trim();
            const isAll = candidate === 'all';
            
            // Tìm member khớp từ cache
            const mentionMember = sortedMembers.find(u => 
              u.name.toLowerCase().trim() === candidate ||
              (messageMentions && messageMentions.includes(u.userID) && u.name.toLowerCase().trim().includes(candidate))
            );

            const isValid = isAll || ['bot', 'gif', 'sticker'].includes(candidate) || !!mentionMember;

            if (isValid) {
              return (
                <Text
                  key={index}
                  onPress={() => {
                    if (mentionMember) {
                      handleUserProfileById(mentionMember.userID);
                    } else if (candidate === 'bot') {
                      handleUserProfileById('bot');
                    }
                  }}
                  style={{
                    color: isMine ? '#fff' : '#0068ff',
                    fontWeight: 'bold',
                    textDecorationLine: mentionMember || candidate === 'bot' ? 'underline' : 'none'
                  }}
                >
                  {part}
                </Text>
              );
            }
          }
          return part;
        })}
      </Text>
    );
  };


  // View chính của Chat Window
  return (
    <View style={styles.container}>
      {/* ... (phần header cũ) ... */}
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => { setSelectedChat(null); onChatClose?.(); }} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleHeaderPress} activeOpacity={0.8} style={styles.headerAvatarContainer}>
          <Image
            source={{ uri: getChatAvatar(selectedChat) }}
            style={styles.headerAvatar}
          />
          {selectedChat && selectedChat.type === 'private' && (
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: (() => {
                    const otherId = selectedChat.members.find(m => m.userID !== user?.userID)?.userID;
                    const otherUser = otherId ? memberCache[otherId] : null;
                    return otherUser?.trangThai === 'online' ? '#22c55e' : '#9ca3af';
                  })()
                }
              ]}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1 }} onPress={handleHeaderPress} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.chatTitle} numberOfLines={1}>{getChatDisplayName(selectedChat)}</Text>
            {selectedChat.isStranger && (
              <View style={styles.strangerBadgeSmall}>
                <Text style={styles.strangerBadgeSmallText}>NGƯỜI LẠ</Text>
              </View>
            )}
          </View>
          {selectedChat.isStranger ? (
            <Text style={styles.strangerSubText}>Không có nhóm chung</Text>
          ) : typingUsers.length > 0 ? (
            <Text style={styles.typingText}>
              {typingUsers.map(u => u.userName).join(', ')} đang nhập...
            </Text>
          ) : (
            <Text style={styles.typingText}>
              {(() => {
                if (selectedChat.type === 'private') {
                  const otherId = selectedChat.members.find(m => m.userID !== user?.userID)?.userID;
                  const otherUser = otherId ? memberCache[otherId] : null;
                  return otherUser?.trangThai === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến';
                }
                return 'Đang hoạt động';
              })()}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => startCall('voice')}>
          <Ionicons name="call-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => {
            if (selectedChat?.type === 'group') {
              // Lấy members của group để chọn
              const groupMembers = selectedChat.members
                .filter(m => m.userID !== user?.userID)
                .map(m => ({
                  userID: m.userID,
                  name: memberCache[m.userID]?.name || m.userID,
                  avatar: memberCache[m.userID]?.anhDaiDien,
                }));
              setGroupCallData({
                groupID: selectedChat.chatID,
                groupName: selectedChat.name,
                initialParticipants: [],
              });
              setGroupCallIsCallee(false);
              setShowGroupCall(true);
            } else {
              startCall('video');
            }
          }}
        >
          <Ionicons name="videocam-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowChatInfo(true)}>
          <Ionicons name="menu-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stranger Banner — Chỉ hiện khi là người lạ/chờ */}
      {selectedChat && selectedChat.type === 'private' &&
        (currentFriendStatus === 'none' || currentFriendStatus === 'stranger' || currentFriendStatus === 'pending') && (
          <View style={styles.strangerActionBanner}>
            <View style={styles.strangerBannerLeft}>
              <Ionicons name="people-outline" size={20} color="#666" style={{ marginRight: 8 }} />
              <Text style={styles.strangerBannerTextMain}>
                {currentFriendStatus === 'pending'
                  ? 'Bấm vào hồ sơ để xử lý lời mời'
                  : 'Gửi yêu cầu kết bạn tới người này'}
              </Text>
            </View>
            {currentFriendStatus !== 'pending' && (
              <TouchableOpacity
                style={[styles.strangerAddFriendBtn, loading && { opacity: 0.5 }]}
                disabled={loading}
                onPress={async () => {
                  try {
                    setLoading(true);
                    const token = await AsyncStorage.getItem('token');
                    const otherId = selectedChat.members.find(m => m.userID !== user?.userID)?.userID;
                    if (!otherId) {
                      setLoading(false);
                      return;
                    }

                    // Lấy thông tin đầy đủ + friendStatus (giống openOtherProfile)
                    const [userRes, statusRes] = await Promise.all([
                      fetch(`${API_URL}/api/usersID`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ userID: otherId }),
                      }),
                      fetch(`${API_URL}/api/contacts/friend-status/${otherId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      }),
                    ]);

                    if (userRes.ok && statusRes.ok) {
                      const userData = await userRes.json();
                      const statusData = await statusRes.json();
                      const target = { ...userData, friendStatus: statusData.status };

                      setAddFriendTarget(target);
                      // Đóng bất kỳ hồ sơ nào đang mở
                      setOtherProfile(null);

                      setTimeout(() => {
                        setShowAddFriend(true);
                        setLoading(false);
                      }, 150);
                    } else {
                      setLoading(false);
                    }
                  } catch (err) {
                    console.error("Banner Button onPress error:", err);
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.strangerAddFriendBtnText}>
                  {loading ? "Đang tải..." : "Gửi kết bạn"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <View style={styles.pinnedBanner}>
          <TouchableOpacity
            style={styles.pinnedBannerHeader}
            onPress={() => setShowPinnedList(!showPinnedList)}
          >
            <View style={styles.pinnedBannerLeft}>
              <Ionicons name="pin" size={16} color="#0068ff" />
              <Text style={styles.pinnedBannerTitle}>
                Danh sách ghim ({pinnedMessages.length})
              </Text>
            </View>
            <Ionicons
              name={showPinnedList ? "chevron-up" : "chevron-down"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>

          {/* Expanded list */}
          {showPinnedList && (
            <View style={styles.pinnedBannerList}>
              {pinnedMessages.map((item, idx) => (
                <View key={item.messageID || item.tempID} style={styles.pinnedBannerItem}>
                  <TouchableOpacity
                    style={styles.pinnedBannerItemContent}
                    onPress={() => {
                      scrollToMessage(item.messageID);
                      setShowPinnedList(false);
                    }}
                  >
                    <Ionicons name="pin" size={14} color="#0068ff" />
                    <View style={styles.pinnedBannerItemText}>
                      <Text style={styles.pinnedBannerItemSender}>
                        {item.senderInfo?.name || "Unknown"}
                      </Text>
                      <Text style={styles.pinnedBannerItemMessage} numberOfLines={1}>
                        {item.content || "[Media]"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Menu 3 chấm */}
                  <TouchableOpacity
                    style={styles.pinnedBannerItemMenu}
                    onPress={() => setPinnedMenuId(pinnedMenuId === item.messageID ? null : item.messageID || null)}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color="#999" />
                  </TouchableOpacity>

                  {/* Dropdown menu */}
                  {pinnedMenuId === item.messageID && (
                    <View style={[
                      styles.pinnedBannerDropdown,
                      idx >= pinnedMessages.length - 1 && styles.pinnedBannerDropdownTop
                    ]}>
                      <TouchableOpacity
                        style={styles.pinnedBannerDropdownItem}
                        onPress={() => handleMoveToTop(item)}
                      >
                        <Ionicons name="arrow-up-outline" size={16} color="#333" />
                        <Text style={styles.pinnedBannerDropdownText}>Đưa lên đầu</Text>
                      </TouchableOpacity>

                      {(item.type === "text" || item.type === "emoji") && (
                        <TouchableOpacity
                          style={styles.pinnedBannerDropdownItem}
                          onPress={() => handleCopyPinned(item)}
                        >
                          <Ionicons name="copy-outline" size={16} color="#333" />
                          <Text style={styles.pinnedBannerDropdownText}>Sao chép</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.pinnedBannerDropdownItem}
                        onPress={() => handleUnpinFromMenu(item)}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#f44336" />
                        <Text style={[styles.pinnedBannerDropdownText, { color: "#f44336" }]}>Bỏ ghim</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}



      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={(() => {
          // ⭐ Group messages trước khi render
          const uniqueMessages = messages.filter((msg, idx, arr) =>
            arr.findIndex(m =>
              (m.messageID && m.messageID === msg.messageID) ||
              (m.tempID && m.tempID === msg.tempID && !msg.messageID)
            ) === idx
          );
          return groupMessages(uniqueMessages);
        })()}
        keyExtractor={(item, index) => {
          if (isMessageGroup(item)) {
            return item.groupId;
          }
          return item.messageID || item.tempID || `msg-${index}`;
        }}
        renderItem={({ item }) => {
          if (isMessageGroup(item)) {
            return renderMessageGroup(item);
          }
          return renderMessage(item);
        }}
        contentContainerStyle={styles.messagesList}
        // Thêm pull-to-refresh để load more messages (tải trang cũ)
        refreshControl={
          <RefreshControl
            refreshing={isLoadingMore}
            onRefresh={loadMoreMessages}
            tintColor="#0068ff"
            colors={["#0068ff"]}
          />
        }
        onContentSizeChange={(_, h) => {
          // Chỉ cuộn xuống cuôi nếu như đang ở trang 1 
          // (tránh việc khi load more xong trang 2 thì bị giật xuống luôn)
          if (page === 1) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={() => {
          if (page === 1) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
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

      {/* Mention Dropdown */}
      {showMentionDropdown && selectedChat?.type === 'group' && (
        <View style={styles.mentionDropdown}>
          <View style={styles.mentionHeader}>
            <Text style={styles.mentionHeaderText}>Nhắc tên thành viên</Text>
          </View>
          <ScrollView horizontal={false} keyboardShouldPersistTaps="always">
            {/* Option @all */}
            {(mentionSearch === '' || 'tất cả'.includes(mentionSearch.toLowerCase()) || 'all'.includes(mentionSearch.toLowerCase())) && (
              <TouchableOpacity
                style={styles.mentionItem}
                onPress={() => handleMentionSelect('all')}
              >
                <View style={[styles.mentionAvatar, { backgroundColor: '#0068ff', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>@</Text>
                </View>
                <View>
                  <Text style={styles.mentionName}>@Tất cả</Text>
                  <Text style={styles.mentionRole}>Nhắc tên mọi người trong nhóm</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Members filtered by search */}
            {selectedChat.members
              .filter(m => m.userID !== user?.userID)
              .map(m => {
                const memberInfo = memberCache[m.userID];
                if (!memberInfo || (mentionSearch && !memberInfo.name.toLowerCase().includes(mentionSearch.toLowerCase()))) return null;

                return (
                  <TouchableOpacity
                    key={m.userID}
                    style={styles.mentionItem}
                    onPress={() => handleMentionSelect(memberInfo)}
                  >
                    <Image
                      source={{ uri: memberInfo.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}` }}
                      style={styles.mentionAvatar}
                    />
                    <View>
                      <Text style={styles.mentionName}>{memberInfo.name}</Text>
                      <Text style={styles.mentionRole}>{m.role === 'owner' ? 'Trưởng nhóm' : m.role === 'admin' ? 'Phó nhóm' : 'Thành viên'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>
      )}

      {/* Input */}
      {!canSendMessages ? (
        <View style={[styles.noSendPermissionBar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <Ionicons name="lock-closed" size={16} color="#9ca3af" />
          <Text style={styles.noSendPermissionText}>
            Chỉ trưởng nhóm và phó nhóm mới có thể gửi tin nhắn
          </Text>
        </View>
      ) : (
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 6) }]}>
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
      )}

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

            {/* Nút Chuyển tiếp */}
            {selectedMessage?.messageID && selectedMessage?.type !== 'notification' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleForwardMessage(selectedMessage);
                }}
              >
                <Text style={styles.menuItemText}>↗️ Chuyển tiếp</Text>
              </TouchableOpacity>
            )}

            {/* Nút Ghim tin nhắn */}
            {selectedMessage?.messageID && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (!selectedMessage.messageID || !user || !selectedChat) {
                    setShowMenu(false);
                    return;
                  }

                  const isGroup = selectedChat.type === 'group';
                  const pinEvent = isGroup ? 'ghim_group_message' : 'ghim_message';
                  const unpinEvent = isGroup ? 'unghim_group_message' : 'unghim_message';
                  const payload = isGroup
                    ? { messageID: selectedMessage.messageID, groupID: selectedChat.chatID, senderID: user.userID }
                    : { messageID: selectedMessage.messageID, chatID: selectedChat.chatID, senderID: user.userID };

                  if (selectedMessage.pinnedInfo) {
                    // Bỏ ghim — kiểm tra quyền
                    if (isGroup && !canPinMessages) {
                      Alert.alert("Thông báo", "Chỉ trưởng nhóm và phó nhóm mới có thể bỏ ghim tin nhắn");
                      setShowMenu(false);
                      return;
                    }
                    socket.emit(unpinEvent, payload);
                    Alert.alert("Thành công", "Đã bỏ ghim tin nhắn");
                  } else {
                    // Kiểm tra quyền ghim
                    if (isGroup && !canPinMessages) {
                      Alert.alert("Thông báo", "Chỉ trưởng nhóm và phó nhóm mới có thể ghim tin nhắn");
                      setShowMenu(false);
                      return;
                    }
                    // Kiểm tra giới hạn 3 tin nhắn ghim
                    const pinnedCount = pinnedMessages.length;
                    if (pinnedCount >= 3) {
                      Alert.alert("Thông báo", "Chỉ có thể ghim tối đa 3 tin nhắn");
                      setShowMenu(false);
                      return;
                    }
                    // Ghim tin nhắn
                    socket.emit(pinEvent, payload);
                    Alert.alert("Thành công", "Đã ghim tin nhắn");
                  }
                  setShowMenu(false);
                }}
              >
                <Text style={styles.menuItemText}>
                  {selectedMessage?.pinnedInfo ? "📌 Bỏ ghim" : "📌 Ghim tin nhắn"}
                </Text>
              </TouchableOpacity>
            )}

            {selectedMessage?.senderID === user?.userID && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleUnsend(selectedMessage!)}>
                <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>🔄 Thu hồi</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteLocal(selectedMessage!)}>
              <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>🗑️ Xóa phía tôi</Text>
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

      {/* Info Panel Modal - Danh sách ghim */}
      <Modal
        transparent
        visible={showInfoPanel}
        animationType="slide"
        onRequestClose={() => {
          setShowInfoPanel(false);
          setPinnedMenuId(null);
        }}
      >
        <View style={styles.infoPanelOverlay}>
          <TouchableOpacity
            style={styles.infoPanelBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowInfoPanel(false);
              setPinnedMenuId(null);
            }}
          />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setPinnedMenuId(null)}
            style={styles.infoPanelContainer}
          >
            {/* Header */}
            <View style={styles.infoPanelHeader}>
              <TouchableOpacity onPress={() => {
                setShowInfoPanel(false);
                setPinnedMenuId(null);
              }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoPanelContent}>
              {/* Nhắc hẹn sắp tới */}
              <View style={styles.infoPanelSection}>
                <Text style={styles.infoPanelSectionTitle}>Nhắc hẹn sắp tới</Text>
                <View style={styles.infoPanelEmptyBox}>
                  <Text style={styles.infoPanelEmptyText}>Chưa có nhắc hẹn nào</Text>
                </View>
              </View>

              {/* Danh sách ghim */}
              <View style={styles.infoPanelSection}>
                <Text style={styles.infoPanelSectionTitle}>Danh sách ghim</Text>
                {pinnedMessages.length === 0 ? (
                  <View style={styles.infoPanelEmptyBox}>
                    <Text style={styles.infoPanelEmptyText}>Chưa có tin nhắn ghim</Text>
                  </View>
                ) : (
                  <View style={styles.pinnedListInPanel}>
                    {pinnedMessages.map((item, idx) => (
                      <View key={item.messageID || item.tempID} style={styles.pinnedItemInPanel}>
                        <TouchableOpacity
                          style={styles.pinnedItemContent}
                          onPress={() => {
                            scrollToMessage(item.messageID);
                            setShowInfoPanel(false);
                          }}
                        >
                          <Ionicons name="chatbox-outline" size={20} color="#0e9de8" />
                          <View style={styles.pinnedItemTextContainer}>
                            <Text style={styles.pinnedItemSender}>
                              {item.senderInfo?.name || "Unknown"}
                            </Text>
                            <Text style={styles.pinnedItemContent2} numberOfLines={2}>
                              {item.content || "Media"}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Menu 3 chấm */}


                        {/* Dropdown menu */}
                        {pinnedMenuId === item.messageID && (
                          <View style={[
                            styles.pinnedItemDropdown,
                            idx >= pinnedMessages.length - 1 && styles.pinnedItemDropdownTop
                          ]}>
                            <TouchableOpacity
                              style={styles.pinnedItemDropdownItem}
                              onPress={() => handleMoveToTop(item)}
                            >
                              <Ionicons name="arrow-up-outline" size={18} color="#333" />
                              <Text style={styles.pinnedItemDropdownText}>Đưa lên đầu</Text>
                            </TouchableOpacity>

                            {(item.type === "text" || item.type === "emoji") && (
                              <TouchableOpacity
                                style={styles.pinnedItemDropdownItem}
                                onPress={() => handleCopyPinned(item)}
                              >
                                <Ionicons name="copy-outline" size={18} color="#333" />
                                <Text style={styles.pinnedItemDropdownText}>Sao chép</Text>
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={styles.pinnedItemDropdownItem}
                              onPress={() => handleUnpinFromMenu(item)}
                            >
                              <Ionicons name="close-circle-outline" size={18} color="#f44336" />
                              <Text style={[styles.pinnedItemDropdownText, { color: "#f44336" }]}>Bỏ ghim</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer buttons */}

          </TouchableOpacity>
        </View>
      </Modal>

      {/* Forward Message Modal */}
      <Modal
        transparent
        visible={showForwardModal}
        animationType="slide"
        onRequestClose={() => setShowForwardModal(false)}
      >
        <View style={styles.forwardModalOverlay}>
          <View style={styles.forwardModalContainer}>
            {/* Header */}
            <View style={styles.forwardModalHeader}>
              <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.forwardModalTitle}>Chuyển tiếp tới</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Message Preview */}
            {forwardingMessage && (
              <View style={styles.forwardMessagePreview}>
                <Text style={styles.forwardPreviewLabel}>Tin nhắn gốc:</Text>
                <View style={styles.forwardPreviewBox}>
                  <Text style={styles.forwardPreviewText} numberOfLines={2}>
                    {forwardingMessage.content || '[Media]'}
                  </Text>
                </View>
              </View>
            )}

            {/* Chat List */}
            <FlatList
              data={chats.filter(c => c.chatID !== selectedChat?.chatID)}
              keyExtractor={item => item.chatID}
              renderItem={({ item }) => {
                const isSelected = selectedChatsForForward.includes(item.chatID);
                return (
                  <TouchableOpacity
                    style={[
                      styles.forwardChatItem,
                      isSelected && styles.forwardChatItemSelected
                    ]}
                    onPress={() => toggleChatSelection(item.chatID)}
                  >
                    <Image
                      source={{ uri: getChatAvatar(item) }}
                      style={styles.forwardChatAvatar}
                    />
                    <View style={styles.forwardChatInfo}>
                      <Text style={styles.forwardChatName} numberOfLines={1}>
                        {getChatDisplayName(item)}
                      </Text>
                      <Text style={styles.forwardChatSubtext} numberOfLines={1}>
                        {item.type === 'group' ? 'Nhóm' : 'Tin nhắn riêng'}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color="#0068ff" />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.forwardEmptyState}>
                  <Text style={styles.forwardEmptyText}>Không có cuộc trò chuyện nào</Text>
                </View>
              }
            />

            {/* Footer */}
            <View style={styles.forwardModalFooter}>
              <Text style={styles.forwardSelectedCount}>
                Đã chọn: {selectedChatsForForward.length}
              </Text>
              <TouchableOpacity
                style={[
                  styles.forwardSubmitBtn,
                  selectedChatsForForward.length === 0 && styles.forwardSubmitBtnDisabled
                ]}
                onPress={handleForwardSubmit}
                disabled={selectedChatsForForward.length === 0}
              >
                <Text style={styles.forwardSubmitBtnText}>Chuyển tiếp</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Chat Info Panel */}
      {selectedChat && (
        <ChatInfoPanel
          visible={showChatInfo}
          chat={selectedChat as any}
          memberInfo={
            selectedChat.type === 'private'
              ? memberCache[
              selectedChat.members.find((m) => m.userID !== user?.userID)
                ?.userID || ''
              ] || null
              : null
          }
          messages={messages as any}
          onClose={() => setShowChatInfo(false)}
          onHistoryDeleted={() => {
            setMessages([]);
            setShowChatInfo(false);
          }}
        />
      )}

      {/* Edit Group Info Modal — mở khi nhấn avatar nhóm trên header */}
      {selectedChat && selectedChat.type === 'group' && (
        <EditGroupInfoModal
          visible={showEditGroupModal}
          groupID={selectedChat.chatID}
          currentName={selectedChat.name}
          currentAvatar={selectedChat.avatar}
          onClose={() => setShowEditGroupModal(false)}
          onSuccess={() => {
            setShowEditGroupModal(false);
          }}
        />
      )}

      {/* Global Modals — Dùng chung cho cả Chat List & Chat Window */}
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

      {showCall && user && (
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

      {/* Group Incoming Call */}
      {incomingGroupCall && (
        <GroupIncomingCallModal
          visible={!!incomingGroupCall}
          callerInfo={incomingGroupCall.callerInfo}
          groupName={incomingGroupCall.groupName}
          invitedNames={incomingGroupCall.allMemberInfos
            .filter(m => m.userID !== user?.userID && m.userID !== incomingGroupCall.callerID)
            .map(m => m.name)}
          onAccept={() => {
            const data = incomingGroupCall;
            setIncomingGroupCall(null);
            setGroupCallData({
              groupID: data.groupID,
              groupName: data.groupName,
              initialParticipants: data.allMemberInfos,
            });
            setGroupCallIsCallee(true);
            setShowGroupCall(true);
          }}
          onReject={() => {
            socket.emit('group-call-reject', { groupID: incomingGroupCall.groupID, userID: user?.userID });
            setIncomingGroupCall(null);
          }}
        />
      )}

      {/* Group Call Screen */}
      {showGroupCall && user && groupCallData && (
        <GroupCallScreen
          visible={showGroupCall}
          groupID={groupCallData.groupID}
          groupName={groupCallData.groupName}
          currentUser={{ userID: user.userID, name: user.name, anhDaiDien: user.anhDaiDien }}
          members={
            // Lấy members từ selectedChat nếu đang mở group chat đó
            selectedChat?.chatID === groupCallData.groupID
              ? selectedChat.members
                  .filter(m => m.userID !== user.userID)
                  .map(m => ({
                    userID: m.userID,
                    name: memberCache[m.userID]?.name || m.userID,
                    avatar: memberCache[m.userID]?.anhDaiDien,
                  }))
              : []
          }
          isCallee={groupCallIsCallee}
          initialParticipants={groupCallData.initialParticipants}
          onClose={() => { setShowGroupCall(false); setGroupCallData(null); setGroupCallIsCallee(false); }}
        />
      )}

      {showAddFriend && (
        <AddFriendModal
          visible={showAddFriend}
          onClose={() => {
            setShowAddFriend(false);
            setAddFriendTarget(null);
          }}
          currentUser={user}
          initialUser={addFriendTarget}
          initialStep={addFriendTarget ? "add_friend" : "search"}
          onStartChat={(chat: any) => {
            setShowAddFriend(false);
            setAddFriendTarget(null);
            if (chat?.chatID) handleSelectChat(chat);
          }}
        />
      )}

      {deletingChat && (
        <Modal visible={!!deletingChat} transparent animationType="fade" onRequestClose={() => setDeletingChat(null)}>
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Xóa cuộc trò chuyện</Text>
              <Text style={styles.confirmMsg}>
                Xóa cuộc trò chuyện với{' '}
                <Text style={{ fontWeight: '700' }}>
                  {getChatDisplayName(deletingChat)}
                </Text>
                ? Hành động này không thể hoàn tác.
              </Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmBtnCancel} onPress={() => setDeletingChat(null)}>
                  <Text style={styles.confirmBtnCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtnDelete} onPress={handleDeleteChat}>
                  <Text style={styles.confirmBtnDeleteText}>Xóa</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {otherProfile && (
        <OtherProfileModal
          visible={!!otherProfile}
          user={otherProfile}
          currentUser={user}
          onClose={() => setOtherProfile(null)}
          onStartChat={(chat) => {
            setSelectedChat(chat);
            setOtherProfile(null);
          }}
          onStatusChange={(newStatus) => {
            setCurrentFriendStatus(newStatus);
            if (newStatus === 'none' && selectedChat) {
              setSelectedChat({ ...selectedChat, isStranger: true });
            }
          }}
          onAddFriend={() => {
            setAddFriendTarget(otherProfile);
            setOtherProfile(null);
            setTimeout(() => {
              setShowAddFriend(true);
            }, 200);
          }}
          onAcceptFriend={handleAcceptFriendRequest}
          onCancelRequest={handleCancelFriendRequest}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0068ff',
    backgroundColor: '#9ca3af',
  },

  // List header
  listHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0068ff', paddingHorizontal: 12, paddingBottom: 10, gap: 8,
  },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 40,
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
    backgroundColor: '#ff3b30', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center', marginLeft: 6,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#aaa' },

  // Chat header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0068ff', paddingHorizontal: 6, paddingBottom: 8, gap: 4,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  chatTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  typingText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontStyle: 'italic' },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  bubblePinned: {
    borderWidth: 2,
    borderColor: '#0e9de8',
  },
  pinnedIndicator: {
    marginBottom: 4,
  },
  pinnedIndicatorText: {
    fontSize: 11,
    color: '#0e9de8',
    fontWeight: '600',
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
    backgroundColor: '#fff', paddingHorizontal: 6, paddingTop: 6, gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd',
  },
  // Thanh thông báo khi không có quyền gửi tin nhắn
  noSendPermissionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  noSendPermissionText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    flex: 1,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, backgroundColor: '#f2f2f2', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15, color: '#111', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
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

  // Stranger folder item in chat list
  strangerFolder: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0',
  },
  strangerAvatarStack: { width: 56, height: 48, position: 'relative', marginRight: 12 },
  strangerStackAvatar: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: '#fff', top: 6,
  },
  strangerInfo: { flex: 1 },
  strangerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  strangerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Stranger inbox screen
  strangerScreen: { flex: 1, backgroundColor: '#fff' },
  strangerHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0068ff', paddingHorizontal: 6, paddingBottom: 8, gap: 4,
  },
  strangerHeaderTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  strangerBanner: {
    backgroundColor: '#f0f7ff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#dbeafe',
  },
  strangerBannerText: { fontSize: 13, color: '#374151' },
  // Swipe to delete
  swipeDeleteBtn: {
    backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
    width: 80,
  },
  swipeDeleteText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 3 },

  // Confirm modal
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  confirmBox: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 320,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 8 },
  confirmMsg: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 24 },
  confirmBtns: { flexDirection: 'row', gap: 12 },
  confirmBtnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#e5e7eb', alignItems: 'center',
  },
  confirmBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  confirmBtnDelete: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#ef4444', alignItems: 'center',
  },
  confirmBtnDeleteText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  strangerLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)',
    fontWeight: '500', marginTop: 1,
  },
  addFriendBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#bfdbfe',
  },
  addFriendBannerText: {
    fontSize: 14, fontWeight: '600', color: '#0068ff', flex: 1,
  },
  strangerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  strangerBadgeSmall: {
    backgroundColor: '#dee2e6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  strangerBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#495057',
  },
  strangerSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  strangerActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  strangerBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  strangerBannerTextMain: {
    fontSize: 13,
    color: '#444',
  },
  strangerAddFriendBtn: {
    backgroundColor: '#e7f3ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  strangerAddFriendBtnText: {
    color: '#0068ff',
    fontSize: 13,
    fontWeight: '600',
  },
  strangerBadge: {
    backgroundColor: '#0068ff', borderRadius: 12,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notifContainer: {
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  notifBadge: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 15,
  },
  notifText: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Pinned Messages Banner
  pinnedBanner: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  pinnedBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pinnedBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pinnedBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0068ff",
  },
  pinnedBannerList: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  pinnedBannerItem: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  pinnedBannerItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 30,
  },
  pinnedBannerItemText: {
    flex: 1,
  },
  pinnedBannerItemSender: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0068ff",
    marginBottom: 2,
  },
  pinnedBannerItemMessage: {
    fontSize: 13,
    color: "#333",
  },
  pinnedBannerItemMenu: {
    padding: 4,
  },
  pinnedBannerDropdown: {
    position: "absolute",
    top: 40,
    right: 14,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 150,
    zIndex: 1000,
  },
  pinnedBannerDropdownTop: {
    top: "auto",
    bottom: 40,
  },
  pinnedBannerDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  pinnedBannerDropdownText: {
    fontSize: 13,
    color: "#333",
  },

  // Info Panel
  infoPanelOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  infoPanelBackdrop: {
    flex: 1,
  },
  infoPanelContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    overflow: "hidden",
  },
  infoPanelHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoPanelContent: {
    flex: 1,
  },
  infoPanelSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 8,
    borderBottomColor: "#f5f5f5",
  },
  infoPanelSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  infoPanelEmptyBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    paddingVertical: 24,
    alignItems: "center",
  },
  infoPanelEmptyText: {
    fontSize: 14,
    color: "#999",
  },
  pinnedListInPanel: {
    gap: 8,
  },
  pinnedItemInPanel: {
    position: "relative",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
  },
  pinnedItemContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    paddingRight: 30,
  },
  pinnedItemTextContainer: {
    flex: 1,
  },
  pinnedItemSender: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0e9de8",
    marginBottom: 4,
  },
  pinnedItemContent2: {
    fontSize: 13,
    color: "#424242",
  },
  pinnedItemMenuBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  pinnedItemDropdown: {
    position: "absolute",
    top: 40,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 160,
    zIndex: 1000,
  },
  pinnedItemDropdownTop: {
    top: "auto",
    bottom: 40,
  },
  pinnedItemDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pinnedItemDropdownText: {
    fontSize: 14,
    color: "#333",
  },
  infoPanelFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  infoPanelFooterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: "#eee",
  },
  infoPanelFooterBtnText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },

  // Forward Modal
  forwardModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  forwardModalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  forwardModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0068ff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  forwardModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  forwardMessagePreview: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  forwardPreviewLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  forwardPreviewBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#0068ff",
  },
  forwardPreviewText: {
    fontSize: 14,
    color: "#333",
  },
  forwardChatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
  },
  forwardChatItemSelected: {
    backgroundColor: "#e3f2fd",
  },
  forwardChatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  forwardChatInfo: {
    flex: 1,
  },
  forwardChatName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    marginBottom: 3,
  },
  forwardChatSubtext: {
    fontSize: 13,
    color: "#888",
  },
  forwardEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  forwardEmptyText: {
    fontSize: 15,
    color: "#aaa",
  },
  forwardModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  forwardSelectedCount: {
    fontSize: 14,
    color: "#666",
  },
  forwardSubmitBtn: {
    backgroundColor: "#0068ff",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  forwardSubmitBtnDisabled: {
    backgroundColor: "#ccc",
  },
  forwardSubmitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  // Notification message styles
  notificationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 4,
    paddingHorizontal: 10,
  },
  notificationBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '80%',
  },
  notificationText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Group call message
  groupCallMsgWrapper: {
    alignItems: 'center',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  groupCallMsgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    width: '100%',
    maxWidth: 320,
  },
  groupCallMsgIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0068ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCallMsgTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a5f' },
  groupCallMsgSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  groupCallJoinBtn: {
    backgroundColor: '#0068ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  groupCallJoinText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  groupCallTime: { fontSize: 11, color: '#999', marginTop: 4 },

  // Group sender name (for image groups in group chats)
  groupSenderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0068ff',
    marginBottom: 4,
  },

  // Image group action buttons
  imageGroupActions: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  imageGroupActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  // Mention Dropdown Styles
  mentionDropdown: {
    position: 'absolute',
    bottom: 60,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  mentionHeader: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mentionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  mentionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  mentionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  mentionRole: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
});

export default ChatScreenEnhanced;
