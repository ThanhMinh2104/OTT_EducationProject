import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import axiosInstance from '../utils/axios';
import { AddMemberModal } from '../components/AddMemberModal';
import { EditGroupInfoModal } from '../components/EditGroupInfoModal';

const { width } = Dimensions.get('window');

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
  messageID: string;
  groupID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: Date;
  media_url: string[];
}

interface GroupInfoScreenProps {
  groupID: string;
  userID: string;
  onClose: () => void;
  onLeaveGroup?: () => void;
}

type Tab = 'reminders' | 'notes' | 'media' | 'files' | 'links';

export const GroupInfoScreen: React.FC<GroupInfoScreenProps> = ({
  groupID,
  userID,
  onClose,
  onLeaveGroup,
}) => {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('media');
  const [showBoardExpanded, setShowBoardExpanded] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchGroupData();
  }, [groupID]);

  const fetchGroupData = async () => {
    try {
      setLoading(true);
      const [groupRes, messagesRes] = await Promise.all([
        axiosInstance.get(`/groups/${groupID}`),
        axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=100`),
      ]);

      const groupData = groupRes.data;

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

      setGroupInfo({
        ...groupData,
        members: membersWithInfo,
      });
      setMessages(messagesRes.data.messages || []);
    } catch (error) {
      console.error('Error fetching group data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin nhóm');
    } finally {
      setLoading(false);
    }
  };

  const currentMember = groupInfo?.members.find((m) => m.userID === userID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';
  const canEditGroupInfo =
    isOwner || isAdmin || (groupInfo?.settings?.memberPermissions?.changeNameAvatar ?? true);

  const groupAvatar =
    groupInfo?.avatar ||
    `https://api.dicebear.com/7.x/identicon/svg?seed=${groupInfo?.groupID}`;
  const groupInviteLink = `zalo.me/g/${groupInfo?.groupID.substring(0, 10)}`;

  // Media từ messages
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
      id: m.messageID,
    }));

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(groupInviteLink);
    Alert.alert('Thành công', 'Đã sao chép link tham gia nhóm');
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
    Alert.alert(
      'Rời nhóm',
      `Bạn có chắc muốn rời khỏi nhóm "${groupInfo?.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời nhóm',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.post(`/groups/${groupID}/leave`);
              Alert.alert('Thành công', 'Đã rời khỏi nhóm');
              onLeaveGroup?.();
              onClose();
            } catch (error: any) {
              Alert.alert('Lỗi', error.response?.data?.message || 'Không thể rời nhóm');
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Giải tán nhóm',
      `Bạn có chắc muốn giải tán nhóm "${groupInfo?.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`/groups/${groupID}`);
              Alert.alert('Thành công', 'Đã giải tán nhóm');
              onClose();
            } catch (error: any) {
              Alert.alert('Lỗi', error.response?.data?.message || 'Không thể giải tán nhóm');
            }
          },
        },
      ]
    );
  };

  const formatDate = (ts: Date) => {
    return new Date(ts).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const EmptyState = ({ text }: { text: string }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📂</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );

  if (loading || !groupInfo) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Thông tin nhóm</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông tin nhóm</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Avatar + Tên nhóm */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={() => canEditGroupInfo && setShowEditModal(true)}
            disabled={!canEditGroupInfo}
          >
            <Image source={{ uri: groupAvatar }} style={styles.avatar} />
          </TouchableOpacity>
          <Text style={styles.groupName}>{groupInfo.name}</Text>
          {canEditGroupInfo && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowEditModal(true)}
            >
              <Ionicons name="create-outline" size={16} color="#60a5fa" />
              <Text style={styles.editButtonText}>Chỉnh sửa thông tin</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 4 Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleMute}>
            <View style={styles.actionIcon}>
              <Ionicons
                name={isMuted ? 'notifications-off' : 'notifications'}
                size={20}
                color="#fff"
              />
            </View>
            <Text style={styles.actionText}>
              {isMuted ? 'Bật' : 'Tắt'} thông báo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleTogglePin}>
            <View style={styles.actionIcon}>
              <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={20} color="#fff" />
            </View>
            <Text style={styles.actionText}>Ghim hội thoại</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowAddMemberModal(true)}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="person-add" size={20} color="#fff" />
            </View>
            <Text style={styles.actionText}>Thêm thành viên</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={styles.actionIcon}>
              <Ionicons name="settings" size={20} color="#fff" />
            </View>
            <Text style={styles.actionText}>Quản lý nhóm</Text>
          </TouchableOpacity>
        </View>

        {/* Link tham gia nhóm */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={16} color="#9ca3af" />
            <Text style={styles.sectionTitle}>Link tham gia nhóm</Text>
          </View>
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>{groupInviteLink}</Text>
            <TouchableOpacity style={styles.iconButton} onPress={handleCopyLink}>
              <Ionicons name="copy-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="share-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bảng tin nhóm */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.expandableHeader}
            onPress={() => setShowBoardExpanded(!showBoardExpanded)}
          >
            <Text style={styles.sectionTitle}>Bảng tin nhóm</Text>
            <Ionicons
              name={showBoardExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>

          {showBoardExpanded && (
            <View style={styles.boardContent}>
              <TouchableOpacity
                style={[styles.tabButton, tab === 'reminders' && styles.tabButtonActive]}
                onPress={() => setTab('reminders')}
              >
                <Ionicons name="time-outline" size={16} color={tab === 'reminders' ? '#60a5fa' : '#9ca3af'} />
                <Text style={[styles.tabButtonText, tab === 'reminders' && styles.tabButtonTextActive]}>
                  Danh sách nhắc hẹn
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, tab === 'notes' && styles.tabButtonActive]}
                onPress={() => setTab('notes')}
              >
                <Ionicons name="document-text-outline" size={16} color={tab === 'notes' ? '#60a5fa' : '#9ca3af'} />
                <Text style={[styles.tabButtonText, tab === 'notes' && styles.tabButtonTextActive]}>
                  Ghi chú, ghim, bình chọn
                </Text>
              </TouchableOpacity>

              {tab === 'reminders' && <EmptyState text="Chưa có nhắc hẹn" />}
              {tab === 'notes' && <EmptyState text="Chưa có ghi chú" />}
            </View>
          )}
        </View>

        {/* Media tabs */}
        <View style={styles.section}>
          <View style={styles.mediaTabs}>
            <TouchableOpacity
              style={[styles.mediaTab, tab === 'media' && styles.mediaTabActive]}
              onPress={() => setTab('media')}
            >
              <Text style={[styles.mediaTabText, tab === 'media' && styles.mediaTabTextActive]}>
                Ảnh/Video
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaTab, tab === 'files' && styles.mediaTabActive]}
              onPress={() => setTab('files')}
            >
              <Text style={[styles.mediaTabText, tab === 'files' && styles.mediaTabTextActive]}>
                File
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaTab, tab === 'links' && styles.mediaTabActive]}
              onPress={() => setTab('links')}
            >
              <Text style={[styles.mediaTabText, tab === 'links' && styles.mediaTabTextActive]}>
                Link
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mediaContent}>
            {tab === 'media' && (
              <>
                {mediaImages.length === 0 && mediaVideos.length === 0 ? (
                  <EmptyState text="Chưa có ảnh/video" />
                ) : (
                  <View style={styles.mediaGrid}>
                    {mediaImages.map((img) => (
                      <TouchableOpacity
                        key={img.id}
                        style={styles.mediaItem}
                        onPress={() => setSelectedImage(img.url)}
                      >
                        <Image source={{ uri: img.url }} style={styles.mediaImage} />
                      </TouchableOpacity>
                    ))}
                    {mediaVideos.map((vid) => (
                      <View key={vid.id} style={styles.mediaItem}>
                        <Image source={{ uri: vid.url }} style={styles.mediaImage} />
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {tab === 'files' && (
              <>
                {mediaFiles.length === 0 ? (
                  <EmptyState text="Chưa có file" />
                ) : (
                  <View style={styles.fileList}>
                    {mediaFiles.map((f) => (
                      <TouchableOpacity key={f.id} style={styles.fileItem}>
                        <View style={styles.fileIcon}>
                          <Ionicons name="document-text" size={20} color="#60a5fa" />
                        </View>
                        <View style={styles.fileInfo}>
                          <Text style={styles.fileName} numberOfLines={1}>
                            {f.name}
                          </Text>
                          <Text style={styles.fileDate}>{formatDate(f.timestamp)}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => Linking.openURL(f.url)}
                          style={styles.downloadButton}
                        >
                          <Ionicons name="download-outline" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

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
                          <Ionicons name="link" size={16} color="#60a5fa" />
                        </View>
                        <View style={styles.linkInfo}>
                          <Text style={styles.linkUrl} numberOfLines={2}>
                            {l.url}
                          </Text>
                          <Text style={styles.linkDate}>{formatDate(l.timestamp)}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Actions - Rời nhóm / Giải tán nhóm */}
        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveGroup}>
            <Ionicons name="exit-outline" size={18} color="#ef4444" />
            <Text style={styles.dangerButtonText}>Rời nhóm</Text>
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteGroup}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.dangerButtonText}>Giải tán nhóm</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Add Member Modal */}
      <AddMemberModal
        visible={showAddMemberModal}
        groupID={groupID}
        currentMembers={groupInfo?.members.map((m) => m.userID) || []}
        onClose={() => setShowAddMemberModal(false)}
        onSuccess={() => {
          fetchGroupData();
        }}
      />

      {/* Edit Group Info Modal */}
      <EditGroupInfoModal
        visible={showEditModal}
        groupID={groupID}
        currentName={groupInfo?.name || ''}
        currentAvatar={groupInfo?.avatar}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          fetchGroupData();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2f35',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#60a5fa',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
  },
  editButtonText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 12,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#60a5fa',
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boardContent: {
    marginTop: 12,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: '#374151',
  },
  tabButtonText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  mediaTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 12,
  },
  mediaTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mediaTabActive: {
    borderBottomColor: '#60a5fa',
  },
  mediaTabText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  mediaTabTextActive: {
    color: '#60a5fa',
  },
  mediaContent: {
    maxHeight: 300,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mediaItem: {
    width: (width - 40) / 3,
    height: (width - 40) / 3,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  fileList: {
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  fileDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  downloadButton: {
    padding: 4,
  },
  linkList: {
    gap: 8,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  linkInfo: {
    flex: 1,
  },
  linkUrl: {
    fontSize: 12,
    color: '#60a5fa',
    marginBottom: 4,
  },
  linkDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 32,
    opacity: 0.3,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  dangerSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dangerButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ef4444',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  fullImage: {
    width: width,
    height: '80%',
  },
});
