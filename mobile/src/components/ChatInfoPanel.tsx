import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import { downloadAndOpenFile } from '../utils/fileDownload';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GroupManagementModal from './GroupManagementModal';
import GroupMembersModal from './GroupMembersModal';
import AddMembersModal from './AddMembersModal';
import { EditGroupInfoModal } from './EditGroupInfoModal';
import { GroupBoardModal } from './GroupBoardModal';
import { TransferOwnershipModal } from './TransferOwnershipModal';

const { width } = Dimensions.get('window');

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
  trangThai?: string;
  sdt?: string;
}

interface Member {
  userID: string;
  role: string;
}

interface Message {
  messageID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string | Date; // ⭐ Hỗ trợ cả string và Date
  media_url?: string[];
}

interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: Member[];
  lastMessage: Message[];
}

interface Props {
  visible: boolean;
  chat: Chat;
  memberInfo: User | null;
  messages: Message[];
  onClose: () => void;
  onHistoryDeleted: () => void;
}

type Tab = 'media' | 'files' | 'links';

const formatDate = (ts: string | Date) => {
  const date = typeof ts === 'string' ? new Date(ts) : ts;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

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

const ChatInfoPanel = ({
  visible,
  chat,
  memberInfo,
  messages,
  onClose,
  onHistoryDeleted,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('media');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [friendStatus, setFriendStatus] = useState<string>('none');
  const [showBoardExpanded, setShowBoardExpanded] = useState(true);
  const [boardTab, setBoardTab] = useState<'reminders' | 'notes'>('reminders');
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [currentUserID, setCurrentUserID] = useState<string>('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [membersWithInfo, setMembersWithInfo] = useState<Array<{
    userID: string;
    name: string;
    avatar?: string;
    role: 'owner' | 'admin' | 'member';
  }>>([]);
  const [availableFriends, setAvailableFriends] = useState<Array<{
    userID: string;
    name: string;
    avatar?: string;
  }>>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [showGroupBoard, setShowGroupBoard] = useState(false);
  const [canEditGroupInfo, setCanEditGroupInfo] = useState(true);
  const [groupSettings, setGroupSettings] = useState<any>(null);
  const [canCreateNotes, setCanCreateNotes] = useState(true);
  const [showTransferOwnership, setShowTransferOwnership] = useState(false);

  // Fetch current user ID
  React.useEffect(() => {
    const fetchCurrentUserID = async () => {
      try {
        const userID = await AsyncStorage.getItem('userID');
        if (userID) setCurrentUserID(userID);
      } catch (error) {
        console.error('Error fetching userID:', error);
      }
    };
    fetchCurrentUserID();
  }, []);

  // Fetch group settings to determine canCreateNotes
  React.useEffect(() => {
    if (!visible || chat.type !== 'group' || !currentUserID) return;

    const fetchGroupSettings = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/groups/${chat.chatID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setGroupSettings(data.settings);
          
          const myMember = chat.members.find((m: any) => m.userID === currentUserID);
          const isOwnerOrAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
          const createNotesPerm = data.settings?.memberPermissions?.createNotes ?? true;
          
          setCanCreateNotes(isOwnerOrAdmin || createNotesPerm);
          
          console.log('🔐 ChatInfoPanel - canCreateNotes:', {
            userID: currentUserID,
            role: myMember?.role,
            isOwnerOrAdmin,
            createNotesSetting: createNotesPerm,
            canCreateNotes: isOwnerOrAdmin || createNotesPerm,
          });
        }
      } catch (error) {
        console.error('Error fetching group settings:', error);
      }
    };

    fetchGroupSettings();
    
    // Listen for settings updates via socket
    const handleSettingsUpdated = (data: { groupID: string; settings: any }) => {
      if (data.groupID === chat.chatID) {
        console.log('🔄 ChatInfoPanel - Settings updated via socket, reloading...');
        fetchGroupSettings();
      }
    };
    
    // Listen for member left event to reload members list
    const handleMemberLeft = (data: { groupID: string; userID: string; userName: string }) => {
      if (data.groupID === chat.chatID) {
        console.log('🔄 ChatInfoPanel - Member left, triggering refresh...');
        onHistoryDeleted(); // Trigger parent to reload chat data
      }
    };

    // Listen for member kicked event to reload members list
    const handleMemberKicked = (data: { groupID: string; kickedUserID: string; kickedBy: string; kickerName: string; kickedName: string }) => {
      if (data.groupID === chat.chatID) {
        console.log('🔄 ChatInfoPanel - Member kicked, triggering refresh...');
        onHistoryDeleted(); // Trigger parent to reload chat data
      }
    };
    
    socket.on('group_settings_updated', handleSettingsUpdated);
    socket.on('member_left', handleMemberLeft);
    socket.on('member_kicked', handleMemberKicked);
    
    return () => {
      socket.off('group_settings_updated', handleSettingsUpdated);
      socket.off('member_left', handleMemberLeft);
      socket.off('member_kicked', handleMemberKicked);
    };
  }, [visible, chat.type, chat.chatID, currentUserID, chat.members]);

  // Fetch quyền changeNameAvatar khi panel mở (group chat)
  React.useEffect(() => {
    if (!visible || chat.type !== 'group') return;
    const fetchPermission = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userID = await AsyncStorage.getItem('userID');
        const res = await fetch(`${API_URL}/api/groups/${chat.chatID}/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const myMember = chat.members.find((m: any) => m.userID === userID);
          const isOwnerOrAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';
          const perm = data.settings?.memberPermissions?.changeNameAvatar ?? true;
          setCanEditGroupInfo(isOwnerOrAdmin || perm);
        }
      } catch {
        setCanEditGroupInfo(true); // fallback
      }
    };
    fetchPermission();
  }, [visible, chat.chatID]);

  // Fetch member info when opening members modal
  React.useEffect(() => {
    const fetchMembersInfo = async () => {
      if (!showMembersModal || chat.type !== 'group') return;
      
      try {
        const token = await AsyncStorage.getItem('token');
        const membersInfo = await Promise.all(
          chat.members.map(async (m) => {
            try {
              const res = await fetch(`${API_URL}/api/usersID`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ userID: m.userID }),
              });
              const data = await res.json();
              return {
                userID: m.userID,
                name: data.name || m.userID,
                avatar: data.anhDaiDien,
                role: m.role as 'owner' | 'admin' | 'member',
              };
            } catch {
              return {
                userID: m.userID,
                name: m.userID,
                role: m.role as 'owner' | 'admin' | 'member',
              };
            }
          })
        );
        setMembersWithInfo(membersInfo);
      } catch (error) {
        console.error('Error fetching members info:', error);
      }
    };
    
    fetchMembersInfo();
  }, [showMembersModal, chat.type, chat.members]);

  // Fetch available friends when opening add members modal
  React.useEffect(() => {
    const fetchAvailableFriends = async () => {
      if (!showAddMembersModal || chat.type !== 'group') return;
      
      setIsLoadingFriends(true);
      try {
        const token = await AsyncStorage.getItem('token');
        
        console.log('🔵 Fetching friends for add members modal...');
        console.log('🔵 Current group members:', chat.members.map(m => m.userID));
        
        // Fetch danh sách contacts - sử dụng POST /api/contacts/friends
        const contactsRes = await fetch(`${API_URL}/api/contacts/friends`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
        });
        
        if (!contactsRes.ok) {
          throw new Error('Failed to fetch contacts');
        }
        
        const contactsData = await contactsRes.json();
        console.log('🔵 All friends from API:', contactsData.length, contactsData);
        
        // Lọc ra những bạn bè chưa có trong nhóm
        const memberUserIDs = new Set(chat.members.map(m => m.userID));
        const availableFriendsList = contactsData
          .filter((contact: any) => !memberUserIDs.has(contact.userID))
          .map((contact: any) => ({
            userID: contact.userID,
            name: contact.alias || contact.name || contact.userID,
            avatar: contact.anhDaiDien,
          }));
        
        console.log('🔵 Available friends (not in group):', availableFriendsList.length, availableFriendsList);
        setAvailableFriends(availableFriendsList);
      } catch (error) {
        console.error('❌ Error fetching available friends:', error);
        setAvailableFriends([]);
      } finally {
        setIsLoadingFriends(false);
      }
    };
    
    fetchAvailableFriends();
  }, [showAddMembersModal, chat.type, chat.members]);

  // Fetch friend status khi mở panel
  React.useEffect(() => {
    if (visible && chat.type === 'private' && memberInfo?.userID) {
      const fetchStatus = async () => {
        try {
          const token = await AsyncStorage.getItem('token');
          const res = await fetch(`${API_URL}/api/contacts/friend-status/${memberInfo.userID}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setFriendStatus(data.friendStatus || 'none');
        } catch {
          setFriendStatus('none');
        }
      };
      fetchStatus();
    }
  }, [visible, chat.type, memberInfo?.userID]);

  // Fetch current user ID
  React.useEffect(() => {
    const fetchUserID = async () => {
      try {
        const userID = await AsyncStorage.getItem('userID');
        if (userID) setCurrentUserID(userID);
      } catch (error) {
        console.error('Error fetching userID:', error);
      }
    };
    fetchUserID();
  }, []);

  // Extract media from messages
  const mediaImages = messages
    .filter((m) => m.type === 'image' && m.media_url?.length)
    .flatMap((m) =>
      (m.media_url || []).map((url, i) => ({
        url,
        timestamp: m.timestamp,
        id: `${m.messageID}_${i}`,
      }))
    );

  const mediaVideos = messages
    .filter((m) => m.type === 'video' && m.media_url?.length)
    .flatMap((m) =>
      (m.media_url || []).map((url, i) => ({
        url,
        timestamp: m.timestamp,
        id: `${m.messageID}_${i}`,
      }))
    );

  const mediaFiles = messages
    .filter((m) => m.type === 'file' && m.media_url?.length)
    .flatMap((m) =>
      (m.media_url || []).map((url, i) => ({
        url,
        name: m.content || `file_${i}`,
        timestamp: m.timestamp,
        id: `${m.messageID}_${i}`,
      }))
    );

  const mediaLinks = messages
    .filter((m) => m.type === 'text' && m.content?.match(/https?:\/\//))
    .map((m) => ({
      url: m.content || '',
      timestamp: m.timestamp,
      id: m.messageID || (typeof m.timestamp === 'string' ? m.timestamp : m.timestamp.toISOString()),
    }));

  const allImageUrls = mediaImages.map((i) => i.url);

  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/chats/${chat.chatID}/history`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        onHistoryDeleted();
        setShowDeleteConfirm(false);
        Alert.alert('Thành công', 'Đã xóa lịch sử trò chuyện');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể xóa lịch sử');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBlock = async () => {
    if (!memberInfo?.userID) return;
    setIsBlocking(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/api/contacts/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserID: memberInfo.userID }),
      });
      setFriendStatus('blocked');
      setShowBlockConfirm(false);
      Alert.alert('Thành công', 'Đã chặn người dùng này');
    } catch {
      Alert.alert('Lỗi', 'Không thể thực hiện thao tác');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!memberInfo?.userID) return;
    setIsBlocking(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${API_URL}/api/contacts/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserID: memberInfo.userID }),
      });
      setFriendStatus('none');
      setShowUnblockConfirm(false);
      Alert.alert('Thành công', 'Đã bỏ chặn người dùng này');
    } catch {
      Alert.alert('Lỗi', 'Không thể thực hiện thao tác');
    } finally {
      setIsBlocking(false);
    }
  };

  const chatName =
    chat.type === 'private' ? memberInfo?.name || chat.name : chat.name;
  const chatAvatar =
    chat.type === 'private'
      ? memberInfo?.anhDaiDien ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${memberInfo?.userID}`
      : chat.avatar ||
        `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.chatID}`;

  const groupInviteLink = chat.type === 'group' ? `zalo.me/g/${chat.chatID.substring(0, 10)}` : '';

  const handleCopyLink = () => {
    if (groupInviteLink) {
      Clipboard.setStringAsync(groupInviteLink);
      Alert.alert('Thành công', 'Đã sao chép link tham gia nhóm');
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    Alert.alert('Thành công', isMuted ? 'Đã bật thông báo' : 'Đã tắt thông báo');
  };

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
    Alert.alert('Thành công', isPinned ? 'Đã bỏ ghim hội thoại' : 'Đã ghim hội thoại');
  };

  const handleLeaveGroup = () => {
    // Kiểm tra quyền owner
    const currentMember = chat.members?.find((m: any) => m.userID === currentUserID);
    const isOwner = currentMember?.role === 'owner';

    if (isOwner) {
      // Mở modal chuyển quyền
      setShowTransferOwnership(true);
      return;
    }

    Alert.alert(
      'Rời nhóm',
      `Bạn có chắc muốn rời khỏi nhóm "${chatName}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              await fetch(`${API_URL}/api/groups/${chat.chatID}/leave`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Thành công', 'Đã rời khỏi nhóm', [
                {
                  text: 'OK',
                  onPress: () => {
                    onClose();
                  }
                }
              ]);
            } catch (error: any) {
              Alert.alert('Lỗi', 'Không thể rời nhóm');
            }
          },
        },
      ]
    );
  };

  const handleDissolveGroup = () => {
    // Kiểm tra quyền owner
    const currentMember = chat.members?.find((m: any) => m.userID === currentUserID);
    const isOwner = currentMember?.role === 'owner';

    if (!isOwner) {
      Alert.alert('Không có quyền', 'Chỉ trưởng nhóm mới có thể giải tán nhóm');
      return;
    }

    Alert.alert(
      'Giải tán nhóm',
      `Bạn có chắc muốn giải tán nhóm "${chatName}"? Hành động này không thể hoàn tác và tất cả thành viên sẽ bị xóa khỏi nhóm.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              await fetch(`${API_URL}/api/groups/${chat.chatID}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              Alert.alert('Thành công', 'Đã giải tán nhóm');
              onClose();
            } catch (error: any) {
              Alert.alert('Lỗi', 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
  };

  const EmptyState = ({ text }: { text: string }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📂</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Thông tin hội thoại</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#555" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Avatar + Info */}
          <View style={styles.profileSection}>
            <TouchableOpacity
              onPress={() => chat.type === 'group' && canEditGroupInfo && setShowEditGroupModal(true)}
              activeOpacity={chat.type === 'group' && canEditGroupInfo ? 0.7 : 1}
            >
              <View style={styles.avatarContainer}>
                <Image source={{ uri: chatAvatar }} style={styles.avatar} />
                {chat.type === 'private' && (
                  <View
                    style={[
                      styles.statusDot,
                      memberInfo?.trangThai === 'online'
                        ? styles.statusOnline
                        : styles.statusOffline,
                    ]}
                  />
                )}
                {chat.type === 'group' && canEditGroupInfo && (
                  <View style={styles.avatarEditBadge}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.chatName}>{chatName}</Text>
            {chat.type === 'private' && memberInfo?.sdt && (
              <Text style={styles.phoneNumber}>{memberInfo.sdt}</Text>
            )}
            {chat.type === 'group' && canEditGroupInfo && (
              <TouchableOpacity style={styles.editButton} onPress={() => setShowEditGroupModal(true)}>
                <Text style={styles.editButtonText}>✏️ Đổi tên</Text>
              </TouchableOpacity>
            )}
            <View
              style={[
                styles.statusBadge,
                memberInfo?.trangThai === 'online'
                  ? styles.statusBadgeOnline
                  : styles.statusBadgeOffline,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  memberInfo?.trangThai === 'online'
                    ? styles.statusBadgeTextOnline
                    : styles.statusBadgeTextOffline,
                ]}
              >
                {chat.type === 'private'
                  ? memberInfo?.trangThai === 'online'
                    ? 'Đang hoạt động'
                    : 'Ngoại tuyến'
                  : `${chat.members.length} thành viên`}
              </Text>
            </View>
          </View>

          {/* 4 Action Buttons - chỉ hiện cho group */}
          {chat.type === 'group' && (
            <View style={styles.actionButtonsGrid}>
              <TouchableOpacity key="mute" style={styles.actionButtonItem} onPress={handleToggleMute}>
                <View style={styles.actionButtonIcon}>
                  <Ionicons
                    name={isMuted ? 'notifications-off' : 'notifications'}
                    size={20}
                    color="#111"
                  />
                </View>
                <Text style={styles.actionButtonText}>
                  {isMuted ? 'Bật\nthông báo' : 'Tắt\nthông báo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity key="pin" style={styles.actionButtonItem} onPress={handleTogglePin}>
                <View style={styles.actionButtonIcon}>
                  <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={20} color="#111" />
                </View>
                <Text style={styles.actionButtonText}>Ghim{'\n'}hội thoại</Text>
              </TouchableOpacity>

              <TouchableOpacity key="add" style={styles.actionButtonItem} onPress={() => setShowAddMembersModal(true)}>
                <View style={styles.actionButtonIcon}>
                  <Ionicons name="person-add" size={20} color="#111" />
                </View>
                <Text style={styles.actionButtonText}>Thêm{'\n'}thành viên</Text>
              </TouchableOpacity>

              <TouchableOpacity key="manage" style={styles.actionButtonItem} onPress={() => setShowManagementModal(true)}>
                <View style={styles.actionButtonIcon}>
                  <Ionicons name="settings" size={20} color="#111" />
                </View>
                <Text style={styles.actionButtonText}>Quản lý{'\n'}nhóm</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Xem thành viên - chỉ hiện cho group */}
          {chat.type === 'group' && (
            <TouchableOpacity
              style={styles.viewMembersButton}
              onPress={() => setShowMembersModal(true)}
            >
              <Ionicons name="people" size={20} color="#0068ff" />
              <View style={styles.viewMembersContent}>
                <Text style={styles.viewMembersTitle}>Xem thành viên</Text>
                <Text style={styles.viewMembersCount}>({chat.members.length})</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#888" />
            </TouchableOpacity>
          )}

          {/* Link tham gia nhóm - chỉ hiện cho group */}
          {chat.type === 'group' && (
            <View style={styles.linkSection}>
              <View style={styles.linkSectionHeader}>
                <Ionicons name="link" size={16} color="#888" />
                <Text style={styles.linkSectionTitle}>Link tham gia nhóm</Text>
              </View>
              <View style={styles.linkContainer}>
                <Text style={styles.linkText}>{groupInviteLink}</Text>
                <TouchableOpacity style={styles.linkIconButton} onPress={handleCopyLink}>
                  <Ionicons name="copy-outline" size={18} color="#0068ff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkIconButton}>
                  <Ionicons name="share-outline" size={18} color="#0068ff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bảng tin nhóm - chỉ hiện cho group */}
          {chat.type === 'group' && (
            <View style={styles.boardSection}>
              <TouchableOpacity
                style={styles.boardHeader}
                onPress={() => setShowBoardExpanded(!showBoardExpanded)}
              >
                <Text style={styles.boardTitle}>Bảng tin nhóm</Text>
                <Ionicons
                  name={showBoardExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#111"
                />
              </TouchableOpacity>

              {showBoardExpanded && (
                <View style={styles.boardContent}>
                  <TouchableOpacity
                    key="reminders"
                    style={[
                      styles.boardTabButton,
                      boardTab === 'reminders' && styles.boardTabButtonActive,
                    ]}
                    onPress={() => setBoardTab('reminders')}
                  >
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={boardTab === 'reminders' ? '#111' : '#888'}
                    />
                    <Text
                      style={[
                        styles.boardTabText,
                        boardTab === 'reminders' && styles.boardTabTextActive,
                      ]}
                    >
                      Danh sách nhắc hẹn
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    key="notes"
                    style={[
                      styles.boardTabButton,
                      boardTab === 'notes' && styles.boardTabButtonActive,
                    ]}
                    onPress={() => setShowGroupBoard(true)}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={16}
                      color={boardTab === 'notes' ? '#111' : '#888'}
                    />
                    <Text
                      style={[
                        styles.boardTabText,
                        boardTab === 'notes' && styles.boardTabTextActive,
                      ]}
                    >
                      Ghi chú, ghim, bình chọn
                    </Text>
                  </TouchableOpacity>

                  {boardTab === 'reminders' && <EmptyState text="Chưa có nhắc hẹn" />}
                </View>
              )}
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['media', 'files', 'links'] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, tab === t && styles.tabActive]}
              >
                <Text
                  style={[styles.tabText, tab === t && styles.tabTextActive]}
                >
                  {t === 'media'
                    ? 'Ảnh/Video'
                    : t === 'files'
                    ? 'File'
                    : 'Link'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {/* Media Tab */}
            {tab === 'media' && (
              <>
                {mediaImages.length === 0 && mediaVideos.length === 0 ? (
                  <EmptyState text="Chưa có ảnh/video" />
                ) : (
                  <View style={styles.mediaGrid}>
                    {mediaImages.map((img, i) => (
                      <TouchableOpacity
                        key={img.id}
                        style={styles.mediaItem}
                        onPress={() => {
                          setSelectedImages(allImageUrls);
                          setSelectedImageIndex(i);
                          setImageViewerVisible(true);
                        }}
                      >
                        <Image
                          source={{ uri: img.url }}
                          style={styles.mediaImage}
                        />
                      </TouchableOpacity>
                    ))}
                    {mediaVideos.map((vid) => (
                      <TouchableOpacity
                        key={vid.id}
                        style={styles.mediaItem}
                        onPress={() => {
                          setSelectedVideo(vid.url);
                          setVideoViewerVisible(true);
                        }}
                      >
                        <Image
                          source={{ uri: vid.url }}
                          style={styles.mediaImage}
                        />
                        <View style={styles.videoPlayOverlay}>
                          <Ionicons name="play" size={24} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Files Tab */}
            {tab === 'files' && (
              <>
                {mediaFiles.length === 0 ? (
                  <EmptyState text="Chưa có file" />
                ) : (
                  <View style={styles.fileList}>
                    {mediaFiles.map((f) => {
                      const ext = getFileExt(f.name);
                      const color = getFileColor(f.name);
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={styles.fileItem}
                          onPress={() =>
                            downloadAndOpenFile(f.url, f.name, undefined)
                          }
                        >
                          <View
                            style={[
                              styles.fileIcon,
                              { backgroundColor: color },
                            ]}
                          >
                            <Text style={styles.fileIconText}>{ext}</Text>
                          </View>
                          <View style={styles.fileInfo}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {f.name}
                            </Text>
                            <Text style={styles.fileDate}>
                              {formatDate(f.timestamp)}
                            </Text>
                          </View>
                          <Ionicons
                            name="download-outline"
                            size={20}
                            color="#0068ff"
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Links Tab */}
            {tab === 'links' && (
              <>
                {mediaLinks.length === 0 ? (
                  <EmptyState text="Chưa có link" />
                ) : (
                  <View style={styles.linkList}>
                    {mediaLinks.map((l) => (
                      <TouchableOpacity
                        key={l.id}
                        style={styles.linkItem}
                        onPress={() => Linking.openURL(l.url)}
                      >
                        <View style={styles.linkIcon}>
                          <Ionicons name="link" size={16} color="#0068ff" />
                        </View>
                        <View style={styles.linkInfo}>
                          <Text
                            style={styles.linkUrl}
                            numberOfLines={2}
                            ellipsizeMode="middle"
                          >
                            {l.url}
                          </Text>
                          <Text style={styles.linkDate}>
                            {formatDate(l.timestamp)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Delete History Button */}
          <View style={styles.actions}>
            {/* Block/Unblock Button - chỉ hiện cho private chat */}
            {chat.type === 'private' && memberInfo && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  friendStatus === 'blocked' ? styles.unblockButton : styles.blockButton
                ]}
                onPress={() => {
                  if (friendStatus === 'blocked') {
                    setShowUnblockConfirm(true);
                  } else {
                    setShowBlockConfirm(true);
                  }
                }}
              >
                <Ionicons 
                  name={friendStatus === 'blocked' ? "checkmark-circle-outline" : "ban-outline"} 
                  size={18} 
                  color={friendStatus === 'blocked' ? "#4caf50" : "#ff9500"} 
                />
                <Text style={[
                  styles.actionButtonLargeText,
                  friendStatus === 'blocked' ? styles.unblockButtonText : styles.blockButtonText
                ]}>
                  {friendStatus === 'blocked' ? 'Bỏ chặn' : 'Chặn người dùng'}
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Rời nhóm - chỉ hiện cho group */}
            {chat.type === 'group' && (
              <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
                <Ionicons name="exit-outline" size={18} color="#ff3b30" />
                <Text style={styles.leaveButtonText}>Rời nhóm</Text>
              </TouchableOpacity>
            )}

            {/* Giải tán nhóm - chỉ hiện cho owner */}
            {chat.type === 'group' && chat.members?.find((m: any) => m.userID === currentUserID)?.role === 'owner' && (
              <TouchableOpacity style={styles.dissolveButton} onPress={handleDissolveGroup}>
                <Ionicons name="trash-outline" size={18} color="#ff3b30" />
                <Text style={styles.dissolveButtonText}>Giải tán nhóm</Text>
              </TouchableOpacity>
            )}

            {/* Xóa lịch sử - hiện cho cả private và group */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Ionicons name="trash-outline" size={18} color="#ff3b30" />
              <Text style={styles.deleteButtonText}>
                Xóa lịch sử trò chuyện
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteConfirm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="trash-outline" size={32} color="#ff3b30" />
              </View>
              <Text style={styles.modalTitle}>Xóa lịch sử trò chuyện</Text>
              <Text style={styles.modalMessage}>
                Toàn bộ tin nhắn sẽ bị xóa khỏi thiết bị của bạn. Người khác
                vẫn thấy lịch sử chat.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDelete]}
                  onPress={handleDeleteHistory}
                  disabled={isDeleting}
                >
                  <Text style={styles.modalButtonTextDelete}>
                    {isDeleting ? 'Đang xóa...' : 'Xóa'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Block Confirmation Modal */}
        <Modal
          visible={showBlockConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBlockConfirm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalIconContainer, { backgroundColor: '#fff3e0' }]}>
                <Ionicons name="ban-outline" size={32} color="#ff9500" />
              </View>
              <Text style={styles.modalTitle}>Chặn người dùng</Text>
              <Text style={styles.modalMessage}>
                Bạn sẽ không nhận được tin nhắn từ {memberInfo?.name}. Họ cũng không thể gọi cho bạn.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowBlockConfirm(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#ff9500' }]}
                  onPress={handleBlock}
                  disabled={isBlocking}
                >
                  <Text style={styles.modalButtonTextDelete}>
                    {isBlocking ? 'Đang chặn...' : 'Chặn'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Unblock Confirmation Modal */}
        <Modal
          visible={showUnblockConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUnblockConfirm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalIconContainer, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#4caf50" />
              </View>
              <Text style={styles.modalTitle}>Bỏ chặn người dùng</Text>
              <Text style={styles.modalMessage}>
                Bạn sẽ có thể nhận tin nhắn và cuộc gọi từ {memberInfo?.name}.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowUnblockConfirm(false)}
                >
                  <Text style={styles.modalButtonTextCancel}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#4caf50' }]}
                  onPress={handleUnblock}
                  disabled={isBlocking}
                >
                  <Text style={styles.modalButtonTextDelete}>
                    {isBlocking ? 'Đang bỏ chặn...' : 'Bỏ chặn'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Group Management Modal */}
        {chat.type === 'group' && (
          <GroupManagementModal
            visible={showManagementModal}
            groupInfo={{
              groupID: chat.chatID,
              name: chat.name,
              avatar: chat.avatar,
              ownerID: chat.members.find(m => m.role === 'owner')?.userID || '',
              members: chat.members.map(m => ({
                _id: m.userID,
                userID: m.userID,
                name: memberInfo?.name || m.userID,
                role: m.role as 'owner' | 'admin' | 'member',
                joinedAt: new Date(),
                isActive: true,
              })),
              memberCount: chat.members.length,
            }}
            currentUserID={currentUserID}
            onClose={() => setShowManagementModal(false)}
            onUpdate={() => onHistoryDeleted()}
          />
        )}

        {/* Group Members Modal */}
        {chat.type === 'group' && (
          <GroupMembersModal
            visible={showMembersModal}
            members={membersWithInfo}
            memberCount={chat.members.length}
            groupID={chat.chatID}
            currentUserID={currentUserID}
            onClose={() => setShowMembersModal(false)}
            onAddMembers={() => {
              setShowMembersModal(false);
              setShowAddMembersModal(true);
            }}
            onRefresh={() => {
              // Trigger refresh by calling onHistoryDeleted
              onHistoryDeleted();
            }}
          />
        )}

        {/* Add Members Modal */}
        {chat.type === 'group' && (
          <AddMembersModal
            visible={showAddMembersModal}
            friends={availableFriends}
            isLoading={isLoadingFriends}
            onClose={() => setShowAddMembersModal(false)}
            onAdd={async (selectedUserIDs) => {
              setShowAddMembersModal(false);
              if (selectedUserIDs.length > 0) {
                try {
                  console.log('➕ Adding members:', selectedUserIDs);
                  const token = await AsyncStorage.getItem('token');
                  
                  // Add members one by one
                  const results = await Promise.allSettled(
                    selectedUserIDs.map(async (userID) => {
                      try {
                        const url = `${API_URL}/api/groups/${chat.chatID}/members`;
                        console.log(`➕ Adding member ${userID} to group ${chat.chatID}`);
                        console.log(`📡 Request URL:`, url);
                        console.log(`📡 API_URL:`, API_URL);
                        
                        const response = await fetch(
                          url,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ userID }),
                          }
                        );
                        
                        console.log(`📡 Response status for ${userID}:`, response.status);
                        console.log(`📡 Response headers:`, response.headers);
                        
                        const responseText = await response.text();
                        console.log(`📡 Response text:`, responseText.substring(0, 200));
                        
                        if (!response.ok) {
                          let error;
                          try {
                            error = JSON.parse(responseText);
                          } catch {
                            error = { message: responseText };
                          }
                          console.error(`❌ Error adding ${userID}:`, error);
                          throw new Error(error.message || 'Failed to add member');
                        }
                        
                        const result = JSON.parse(responseText);
                        console.log(`✅ Successfully added ${userID}:`, result);
                        return result;
                      } catch (err) {
                        console.error(`❌ Exception adding ${userID}:`, err);
                        throw err;
                      }
                    })
                  );
                  
                  const successCount = results.filter(r => r.status === 'fulfilled').length;
                  const failCount = results.filter(r => r.status === 'rejected').length;
                  
                  console.log('✅ Add members result:', { successCount, failCount });
                  console.log('📋 Detailed results:', results);
                  
                  if (successCount > 0) {
                    Alert.alert(
                      'Thành công',
                      `Đã thêm ${successCount} thành viên vào nhóm${failCount > 0 ? `. ${failCount} thất bại.` : ''}`
                    );
                    // Trigger refresh by calling onHistoryDeleted
                    onHistoryDeleted();
                  } else {
                    Alert.alert('Lỗi', 'Không thể thêm thành viên vào nhóm');
                  }
                } catch (error) {
                  console.error('❌ Error adding members:', error);
                  Alert.alert('Lỗi', 'Không thể thêm thành viên vào nhóm');
                }
              }
            }}
          />
        )}

        {/* Edit Group Info Modal */}
        {chat.type === 'group' && (
          <EditGroupInfoModal
            visible={showEditGroupModal}
            groupID={chat.chatID}
            currentName={chat.name}
            currentAvatar={chat.avatar}
            onClose={() => setShowEditGroupModal(false)}
            onSuccess={() => {
              setShowEditGroupModal(false);
              onHistoryDeleted(); // trigger refresh
            }}
          />
        )}

        {/* Group Board Modal */}
        {chat.type === 'group' && (
          <GroupBoardModal
            visible={showGroupBoard}
            onClose={() => setShowGroupBoard(false)}
            groupID={chat.chatID}
            userID={currentUserID}
            canCreateNotes={canCreateNotes}
          />
        )}

        {/* Transfer Ownership Modal */}
        {chat.type === 'group' && (
          <TransferOwnershipModal
            visible={showTransferOwnership}
            groupID={chat.chatID}
            members={membersWithInfo}
            currentUserID={currentUserID}
            onClose={() => setShowTransferOwnership(false)}
            onSuccess={() => {
              setShowTransferOwnership(false);
              onClose();
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // Giữ màu trắng
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  statusOnline: {
    backgroundColor: '#4caf50',
  },
  statusOffline: {
    backgroundColor: '#bbb',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0068ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  editButton: {
    paddingVertical: 4,
  },
  editButtonText: {
    color: '#0068ff',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeOnline: {
    backgroundColor: '#e8f5e9',
  },
  statusBadgeOffline: {
    backgroundColor: '#f5f5f5',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadgeTextOnline: {
    color: '#4caf50',
  },
  statusBadgeTextOffline: {
    color: '#888',
  },
  // 4 Action buttons
  actionButtonsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-between',
  },
  actionButtonItem: {
    alignItems: 'center',
    gap: 10,
    width: 80,
  },
  actionButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#111',
    textAlign: 'center',
    lineHeight: 14,
  },
  // Xem thành viên button
  viewMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  viewMembersContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewMembersTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  viewMembersCount: {
    fontSize: 14,
    color: '#888',
  },
  // Link section
  linkSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  linkSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  linkSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#0068ff',
  },
  linkIconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  // Board section (HEAD styles)
  boardSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  boardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  boardContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  boardTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  boardTabButtonActive: {
    backgroundColor: '#f5f5f5',
  },
  boardTabText: {
    fontSize: 13,
    color: '#888',
  },
  boardTabTextActive: {
    color: '#111',
  },
  // Board section (tantai styles)
  boardSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  boardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    gap: 12,
  },
  boardButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0068ff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
  },
  tabTextActive: {
    color: '#0068ff',
  },
  tabContent: {
    padding: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    opacity: 0.3,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#aaa',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mediaItem: {
    width: (width - 32) / 3,
    height: (width - 32) / 3,
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  fileList: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 48,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  fileDate: {
    fontSize: 11,
    color: '#888',
  },
  linkList: {
    gap: 8,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    gap: 12,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkInfo: {
    flex: 1,
  },
  linkUrl: {
    fontSize: 12,
    color: '#0068ff',
    marginBottom: 4,
  },
  linkDate: {
    fontSize: 11,
    color: '#888',
  },
  actions: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
  },
  blockButton: {
    borderColor: '#ff9500',
  },
  unblockButton: {
    borderColor: '#4caf50',
  },
  actionButtonLargeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  blockButtonText: {
    color: '#ff9500',
  },
  unblockButtonText: {
    color: '#4caf50',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff3b30',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff3b30',
  },
  dissolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  dissolveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff3b30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f5f5f5',
  },
  modalButtonDelete: {
    backgroundColor: '#ff3b30',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextDelete: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ChatInfoPanel;
