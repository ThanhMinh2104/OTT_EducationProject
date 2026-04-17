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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import { downloadAndOpenFile } from '../utils/fileDownload';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  timestamp: string;
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

const formatDate = (ts: string) =>
  new Date(ts).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

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
      id: m.messageID || m.timestamp,
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
            </View>
            <Text style={styles.chatName}>{chatName}</Text>
            {chat.type === 'private' && memberInfo?.sdt && (
              <Text style={styles.phoneNumber}>{memberInfo.sdt}</Text>
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
                  styles.actionButtonText,
                  friendStatus === 'blocked' ? styles.unblockButtonText : styles.blockButtonText
                ]}>
                  {friendStatus === 'blocked' ? 'Bỏ chặn' : 'Chặn người dùng'}
                </Text>
              </TouchableOpacity>
            )}
            
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    borderColor: '#e3f2fd',
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
  actionButtonText: {
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
