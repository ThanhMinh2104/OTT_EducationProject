import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import axiosInstance from '../utils/axios';

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

interface Props {
  visible: boolean;
  groupInfo: GroupInfo;
  currentUserID: string;
  onClose: () => void;
  onUpdate?: () => void;
}

type ViewType = 'settings' | 'block' | 'admin';

const GroupManagementModal = ({ visible, groupInfo, currentUserID, onClose, onUpdate }: Props) => {
  const insets = useSafeAreaInsets();
  const [currentView, setCurrentView] = useState<ViewType>('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Admin panel sub-views
  const [adminSubView, setAdminSubView] = useState<'main' | 'addAdmin' | 'transferOwner' | 'transferConfirm'>('main');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [selectedNewOwner, setSelectedNewOwner] = useState<GroupMember | null>(null);

  // Block panel sub-views
  const [blockSubView, setBlockSubView] = useState<'list' | 'add'>('list');
  const [blockSearchQuery, setBlockSearchQuery] = useState('');
  const [selectedToBlock, setSelectedToBlock] = useState<string[]>([]);
  const [blockedMembersInfo, setBlockedMembersInfo] = useState<Array<{ userID: string; name: string; avatar?: string }>>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  const currentMember = groupInfo.members.find(m => m.userID === currentUserID);
  const isOwner = currentMember?.role === 'owner';
  const isAdmin = currentMember?.role === 'admin';

  const groupInviteLink = `zalo.me/g/${groupInfo.groupID.substring(0, 10)}`;

  const [settings, setSettings] = useState({
    requireApproval: groupInfo.settings?.requireApproval ?? false,
    highlightAdminMessages: groupInfo.settings?.highlightAdminMessages ?? false,
    allowNewMembersReadHistory: groupInfo.settings?.allowNewMembersReadHistory ?? false,
    allowInviteLink: groupInfo.settings?.allowInviteLink ?? true,
  });

  const [memberPermissions, setMemberPermissions] = useState({
    changeNameAvatar: groupInfo.settings?.memberPermissions?.changeNameAvatar ?? true,
    pinMessages: groupInfo.settings?.memberPermissions?.pinMessages ?? true,
    createNotes: groupInfo.settings?.memberPermissions?.createNotes ?? true,
    createPolls: groupInfo.settings?.memberPermissions?.createPolls ?? true,
    sendMessages: groupInfo.settings?.memberPermissions?.sendMessages ?? true,
  });

  // Fetch settings mới nhất từ server mỗi khi modal mở
  useEffect(() => {
    if (!visible) return;
    const fetchLatestSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const res = await axiosInstance.get(`/groups/${groupInfo.groupID}/settings`);
        const s = res.data.settings;
        if (s) {
          setSettings({
            requireApproval: s.requireApproval ?? false,
            highlightAdminMessages: s.highlightAdminMessages ?? false,
            allowNewMembersReadHistory: s.allowNewMembersReadHistory ?? false,
            allowInviteLink: s.allowInviteLink ?? true,
          });
          if (s.memberPermissions) {
            setMemberPermissions({
              changeNameAvatar: s.memberPermissions.changeNameAvatar ?? true,
              pinMessages: s.memberPermissions.pinMessages ?? true,
              createNotes: s.memberPermissions.createNotes ?? true,
              createPolls: s.memberPermissions.createPolls ?? true,
              sendMessages: s.memberPermissions.sendMessages ?? true,
            });
          }
        }
      } catch (error) {
        // Fallback về props nếu fetch lỗi
        if (groupInfo.settings) {
          setSettings({
            requireApproval: groupInfo.settings.requireApproval ?? false,
            highlightAdminMessages: groupInfo.settings.highlightAdminMessages ?? false,
            allowNewMembersReadHistory: groupInfo.settings.allowNewMembersReadHistory ?? false,
            allowInviteLink: groupInfo.settings.allowInviteLink ?? true,
          });
          if (groupInfo.settings.memberPermissions) {
            setMemberPermissions({
              changeNameAvatar: groupInfo.settings.memberPermissions.changeNameAvatar ?? true,
              pinMessages: groupInfo.settings.memberPermissions.pinMessages ?? true,
              createNotes: groupInfo.settings.memberPermissions.createNotes ?? true,
              createPolls: groupInfo.settings.memberPermissions.createPolls ?? true,
              sendMessages: groupInfo.settings.memberPermissions.sendMessages ?? true,
            });
          }
        }
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchLatestSettings();
  }, [visible, groupInfo.groupID]);

  const handleCopyLink = () => {
    Clipboard.setStringAsync(groupInviteLink);
    Alert.alert('Thành công', 'Đã sao chép link tham gia nhóm');
  };

  // Gọi API lưu settings — giống web
  const saveSettings = async (
    newSettings: typeof settings,
    newPermissions: typeof memberPermissions
  ) => {
    try {
      setIsSaving(true);
      await axiosInstance.put(`/groups/${groupInfo.groupID}/settings`, {
        settings: {
          ...newSettings,
          memberPermissions: newPermissions,
        },
      });
      onUpdate?.();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật cài đặt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSetting = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings, memberPermissions);
  };

  const handleTogglePermission = (key: keyof typeof memberPermissions) => {
    const newPermissions = { ...memberPermissions, [key]: !memberPermissions[key] };
    setMemberPermissions(newPermissions);
    saveSettings(settings, newPermissions);
  };

  // --- Admin actions ---
  const handlePromoteAdmin = async (member: GroupMember) => {
    try {
      await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${member.userID}/role`, { role: 'admin' });
      Alert.alert('Thành công', `Đã thêm ${member.name} làm phó nhóm`);
      setAdminSubView('main');
      setAdminSearchQuery('');
      onUpdate?.();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể thêm phó nhóm');
    }
  };

  const handleDemoteAdmin = async (member: GroupMember) => {
    Alert.alert(
      'Xóa quyền phó nhóm',
      `Bạn có chắc muốn xóa quyền phó nhóm của ${member.name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa quyền',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${member.userID}/role`, { role: 'member' });
              Alert.alert('Thành công', `Đã xóa quyền phó nhóm của ${member.name}`);
              onUpdate?.();
            } catch (error: any) {
              Alert.alert('Lỗi', error.response?.data?.message || 'Không thể xóa quyền');
            }
          },
        },
      ]
    );
  };

  const handleTransferOwner = async () => {
    if (!selectedNewOwner) return;
    try {
      await axiosInstance.put(`/groups/${groupInfo.groupID}/members/${selectedNewOwner.userID}/role`, { role: 'owner' });
      Alert.alert('Thành công', `Đã chuyển quyền trưởng nhóm cho ${selectedNewOwner.name}`);
      setAdminSubView('main');
      setSelectedNewOwner(null);
      onUpdate?.();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể chuyển quyền');
    }
  };

  // --- Block actions ---
  const fetchBlockedMembers = async () => {
    setIsLoadingBlocked(true);
    try {
      const groupRes = await axiosInstance.get(`/groups/${groupInfo.groupID}`);
      const blockedIDs: string[] = groupRes.data.blockedMembers || [];
      if (blockedIDs.length === 0) {
        setBlockedMembersInfo([]);
        return;
      }
      const results = await Promise.all(
        blockedIDs.map(async (uid) => {
          try {
            const res = await axiosInstance.post('/usersID', { userID: uid });
            return { userID: uid, name: res.data.name || uid, avatar: res.data.anhDaiDien };
          } catch {
            return { userID: uid, name: uid, avatar: undefined };
          }
        })
      );
      setBlockedMembersInfo(results);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  const handleOpenBlockView = () => {
    setCurrentView('block');
    setBlockSubView('list');
    fetchBlockedMembers();
  };

  const handleBlockMembers = async () => {
    if (!selectedToBlock.length) return;
    try {
      await Promise.all(
        selectedToBlock.map((uid) =>
          axiosInstance.post(`/groups/${groupInfo.groupID}/block/${uid}`)
        )
      );
      Alert.alert('Thành công', `Đã chặn ${selectedToBlock.length} thành viên`);
      setSelectedToBlock([]);
      setBlockSubView('list');
      onUpdate?.();
      fetchBlockedMembers();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể chặn thành viên');
    }
  };

  const handleUnblock = async (uid: string, name: string) => {
    Alert.alert('Bỏ chặn', `Bỏ chặn ${name} khỏi nhóm?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Bỏ chặn',
        onPress: async () => {
          try {
            await axiosInstance.post(`/groups/${groupInfo.groupID}/unblock/${uid}`);
            setBlockedMembersInfo(prev => prev.filter(m => m.userID !== uid));
            onUpdate?.();
          } catch (error: any) {
            Alert.alert('Lỗi', error.response?.data?.message || 'Không thể bỏ chặn');
          }
        },
      },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Giải tán nhóm',
      `Bạn có chắc muốn giải tán nhóm "${groupInfo.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Giải tán',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`/groups/${groupInfo.groupID}`);
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

  const renderHeader = () => {
    let title = 'Quản lý nhóm';
    let onBack: (() => void) | null = null;

    if (currentView === 'block') {
      if (blockSubView === 'add') {
        title = 'Thêm vào danh sách chặn';
        onBack = () => { setBlockSubView('list'); setSelectedToBlock([]); setBlockSearchQuery(''); };
      } else {
        title = 'Chặn khỏi nhóm';
        onBack = () => setCurrentView('settings');
      }
    } else if (currentView === 'admin') {
      if (adminSubView === 'addAdmin') {
        title = 'Thêm phó nhóm';
        onBack = () => { setAdminSubView('main'); setAdminSearchQuery(''); };
      } else if (adminSubView === 'transferOwner') {
        title = 'Chuyển quyền trưởng nhóm';
        onBack = () => { setAdminSubView('main'); setAdminSearchQuery(''); };
      } else if (adminSubView === 'transferConfirm') {
        title = 'Xác nhận chuyển quyền';
        onBack = () => { setAdminSubView('transferOwner'); setSelectedNewOwner(null); };
      } else {
        title = 'Trưởng & phó nhóm';
        onBack = () => setCurrentView('settings');
      }
    }

    return (
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={onBack ?? onClose}
          style={styles.headerButton}
        >
          <Ionicons name={onBack ? 'arrow-back' : 'close'} size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerButton}>
          {(isSaving || isLoadingSettings) && <ActivityIndicator size="small" color="#0068ff" />}
        </View>
      </View>
    );
  };

  const renderSettingsView = () => (
    <ScrollView 
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      bounces={true}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={true}
    >
      {/* Thông báo chỉ dành cho quản trị viên */}
      {!isOwner && !isAdmin && (
        <View style={styles.adminNotice}>
          <View style={styles.adminNoticeIcon}>
            <Text style={styles.adminNoticeEmoji}>🔒</Text>
          </View>
          <View style={styles.adminNoticeContent}>
            <Text style={styles.adminNoticeTitle}>Tính năng chỉ dành cho quản trị viên</Text>
            <Text style={styles.adminNoticeText}>
              Chỉ trưởng nhóm và phó nhóm mới có thể thay đổi các cài đặt này
            </Text>
          </View>
        </View>
      )}

      {/* Cho phép các thành viên trong nhóm */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cho phép các thành viên trong nhóm:</Text>

        <View style={styles.settingItemCompact}>
          <Text style={styles.settingLabel}>Thay đổi tên & ảnh đại diện của nhóm</Text>
          <Switch
            value={memberPermissions.changeNameAvatar}
            onValueChange={() => handleTogglePermission('changeNameAvatar')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItemCompact}>
          <Text style={[styles.settingLabel, styles.settingLabelMultiline]}>
            Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại
          </Text>
          <Switch
            value={memberPermissions.pinMessages}
            onValueChange={() => handleTogglePermission('pinMessages')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItemCompact}>
          <Text style={styles.settingLabel}>Tạo mới ghi chú, nhắc hẹn</Text>
          <Switch
            value={memberPermissions.createNotes}
            onValueChange={() => handleTogglePermission('createNotes')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItemCompact}>
          <Text style={styles.settingLabel}>Tạo mới bình chọn</Text>
          <Switch
            value={memberPermissions.createPolls}
            onValueChange={() => handleTogglePermission('createPolls')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingItemCompact}>
          <Text style={styles.settingLabel}>Gửi tin nhắn</Text>
          <Switch
            value={memberPermissions.sendMessages}
            onValueChange={() => handleTogglePermission('sendMessages')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Chế độ phê duyệt thành viên mới */}
      <View style={styles.section}>
        <View style={styles.settingItemWithDesc}>
          <View style={styles.settingLabelContainer}>
            <View style={styles.settingLabelRow}>
              <Text style={styles.settingLabelBold}>Chế độ phê duyệt thành viên mới</Text>
              <Ionicons name="information-circle-outline" size={14} color="#888" />
            </View>
            <Text style={styles.settingDesc}>
              Yêu cầu phê duyệt từ trưởng/phó nhóm khi có người xin vào nhóm
            </Text>
          </View>
          <Switch
            value={settings.requireApproval}
            onValueChange={() => handleToggleSetting('requireApproval')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Đánh dấu tin nhắn từ trưởng/phó nhóm */}
      <View style={styles.section}>
        <View style={styles.settingItemWithDesc}>
          <View style={styles.settingLabelContainer}>
            <View style={styles.settingLabelRow}>
              <Text style={styles.settingLabelBold}>Đánh dấu tin nhắn từ trưởng/phó nhóm</Text>
              <Ionicons name="information-circle-outline" size={14} color="#888" />
            </View>
            <Text style={styles.settingDesc}>
              Tin nhắn từ trưởng/phó nhóm sẽ được đánh dấu đặc biệt
            </Text>
          </View>
          <Switch
            value={settings.highlightAdminMessages}
            onValueChange={() => handleToggleSetting('highlightAdminMessages')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Cho phép thành viên mới đọc tin nhắn gần nhất */}
      <View style={styles.section}>
        <View style={styles.settingItemWithDesc}>
          <View style={styles.settingLabelContainer}>
            <View style={styles.settingLabelRow}>
              <Text style={styles.settingLabelBold}>Cho phép thành viên mới đọc tin nhắn gần nhất</Text>
              <Ionicons name="information-circle-outline" size={14} color="#888" />
            </View>
            <Text style={styles.settingDesc}>
              Thành viên mới có thể xem lịch sử tin nhắn trước khi tham gia
            </Text>
          </View>
          <Switch
            value={settings.allowNewMembersReadHistory}
            onValueChange={() => handleToggleSetting('allowNewMembersReadHistory')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Cho phép dùng link tham gia nhóm */}
      <View style={styles.section}>
        <View style={styles.settingItemWithDesc}>
          <View style={styles.settingLabelContainer}>
            <View style={styles.settingLabelRow}>
              <Text style={styles.settingLabelBold}>Cho phép dùng link tham gia nhóm</Text>
              <Ionicons name="information-circle-outline" size={14} color="#888" />
            </View>
            <Text style={styles.settingDesc}>
              Mọi người có link đều có thể tham gia nhóm
            </Text>
          </View>
          <Switch
            value={settings.allowInviteLink}
            onValueChange={() => handleToggleSetting('allowInviteLink')}
            disabled={!isOwner && !isAdmin}
            trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
            thumbColor="#fff"
          />
        </View>

        {settings.allowInviteLink && (
          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>{groupInviteLink}</Text>
            <TouchableOpacity style={styles.linkButton} onPress={handleCopyLink}>
              <Ionicons name="copy-outline" size={18} color="#0068ff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton}>
              <Ionicons name="share-outline" size={18} color="#0068ff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3 nút cuối */}
      <>
        <TouchableOpacity
          style={styles.bottomActionItem}
          onPress={handleOpenBlockView}
        >
          <Ionicons name="people" size={20} color="#111" />
          <Text style={styles.bottomActionText}>Chặn khỏi nhóm</Text>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomActionItem}
          onPress={() => { setCurrentView('admin'); setAdminSubView('main'); }}
        >
          <Ionicons name="key" size={20} color="#111" />
          <Text style={styles.bottomActionText}>Trưởng & phó nhóm</Text>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        {isOwner && (
          <TouchableOpacity
            style={styles.bottomActionItem}
            onPress={handleDeleteGroup}
          >
            <Ionicons name="trash" size={20} color="#ff3b30" />
            <Text style={styles.bottomActionTextDanger}>Giải tán nhóm</Text>
          </TouchableOpacity>
        )}
      </>
    </ScrollView>
  );

  const renderBlockView = () => {
    // Sub-view: Thêm vào danh sách chặn
    if (blockSubView === 'add') {
      const blockableMembers = groupInfo.members.filter(m => {
        if (m.userID === currentUserID) return false;
        if (m.role === 'owner') return false;
        if (groupInfo.blockedMembers?.includes(m.userID)) return false;
        if (blockSearchQuery && !m.name?.toLowerCase().includes(blockSearchQuery.toLowerCase())) return false;
        return true;
      });

      return (
        <View style={styles.flex1}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={blockSearchQuery}
              onChangeText={setBlockSearchQuery}
              placeholder="Tìm kiếm thành viên"
              placeholderTextColor="#aaa"
            />
          </View>
          <ScrollView style={styles.flex1}>
            {blockableMembers.map(m => (
              <TouchableOpacity
                key={m.userID}
                style={styles.memberItem}
                onPress={() =>
                  setSelectedToBlock(prev =>
                    prev.includes(m.userID) ? prev.filter(id => id !== m.userID) : [...prev, m.userID]
                  )
                }
              >
                <View style={[styles.checkbox, selectedToBlock.includes(m.userID) && styles.checkboxChecked]}>
                  {selectedToBlock.includes(m.userID) && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Image
                  source={{ uri: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}` }}
                  style={styles.memberAvatarImg}
                />
                <Text style={styles.memberName}>{m.name || m.userID}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.blockFooter}>
            <TouchableOpacity
              style={styles.blockCancelBtn}
              onPress={() => { setBlockSubView('list'); setSelectedToBlock([]); setBlockSearchQuery(''); }}
            >
              <Text style={styles.blockCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.blockConfirmBtn, !selectedToBlock.length && styles.blockConfirmBtnDisabled]}
              onPress={handleBlockMembers}
              disabled={!selectedToBlock.length}
            >
              <Text style={styles.blockConfirmText}>Chặn thành viên</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Sub-view: Danh sách chặn
    return (
      <ScrollView style={styles.content}>
        <View style={styles.blockDescription}>
          <Text style={styles.blockDescriptionText}>
            Những người đã bị chặn không thể tham gia lại nhóm, trừ khi được trưởng, phó nhóm bỏ chặn hoặc thêm lại vào nhóm.
          </Text>
        </View>

        {(isOwner || isAdmin) && (
          <View style={styles.blockAddSection}>
            <TouchableOpacity
              style={styles.blockAddButton}
              onPress={() => { setBlockSubView('add'); setSelectedToBlock([]); setBlockSearchQuery(''); }}
            >
              <Text style={styles.blockAddButtonText}>Thêm vào danh sách chặn</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.blockListSection}>
          {isLoadingBlocked ? (
            <ActivityIndicator size="large" color="#0068ff" style={{ marginTop: 40 }} />
          ) : blockedMembersInfo.length === 0 ? (
            <View style={styles.emptyBlockList}>
              <View style={styles.emptyBlockIcon}>
                <Ionicons name="people" size={32} color="#ccc" />
              </View>
              <Text style={styles.emptyBlockText}>Chưa có thành viên nào bị chặn</Text>
            </View>
          ) : (
            <>
              <Text style={styles.blockedCount}>Thành viên bị chặn ({blockedMembersInfo.length})</Text>
              {blockedMembersInfo.map(m => (
                <View key={m.userID} style={styles.memberItem}>
                  <Image
                    source={{ uri: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}` }}
                    style={styles.memberAvatarImg}
                  />
                  <Text style={[styles.memberName, styles.flex1]}>{m.name}</Text>
                  <TouchableOpacity
                    style={styles.unblockBtn}
                    onPress={() => handleUnblock(m.userID, m.name)}
                  >
                    <Text style={styles.unblockBtnText}>Bỏ chặn</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderAdminView = () => {
    const owner = groupInfo.members.find(m => m.role === 'owner');
    const admins = groupInfo.members.filter(m => m.role === 'admin');

    // Sub-view: Thêm phó nhóm
    if (adminSubView === 'addAdmin') {
      const candidates = groupInfo.members.filter(m =>
        m.role === 'member' && m.userID !== currentUserID &&
        (!adminSearchQuery || m.name?.toLowerCase().includes(adminSearchQuery.toLowerCase()))
      );
      return (
        <View style={styles.flex1}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={adminSearchQuery}
              onChangeText={setAdminSearchQuery}
              placeholder="Tìm kiếm thành viên"
              placeholderTextColor="#aaa"
            />
          </View>
          <ScrollView style={styles.flex1}>
            {candidates.map(m => (
              <View key={m.userID} style={styles.memberItem}>
                <Image
                  source={{ uri: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}` }}
                  style={styles.memberAvatarImg}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name || m.userID}</Text>
                  <Text style={styles.memberRole}>Thành viên</Text>
                </View>
                <TouchableOpacity
                  style={styles.addAdminBtn}
                  onPress={() => handlePromoteAdmin(m)}
                >
                  <Text style={styles.addAdminBtnText}>Thêm</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Sub-view: Chọn người nhận quyền trưởng nhóm
    if (adminSubView === 'transferOwner') {
      const candidates = groupInfo.members.filter(m =>
        m.userID !== currentUserID &&
        (!adminSearchQuery || m.name?.toLowerCase().includes(adminSearchQuery.toLowerCase()))
      );
      return (
        <View style={styles.flex1}>
          <View style={styles.transferHint}>
            <Text style={styles.transferHintText}>Chọn thành viên để chuyển quyền trưởng nhóm:</Text>
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={adminSearchQuery}
              onChangeText={setAdminSearchQuery}
              placeholder="Tìm kiếm thành viên"
              placeholderTextColor="#aaa"
            />
          </View>
          <ScrollView style={styles.flex1}>
            {candidates.map(m => (
              <TouchableOpacity
                key={m.userID}
                style={styles.memberItem}
                onPress={() => { setSelectedNewOwner(m); setAdminSubView('transferConfirm'); }}
              >
                <Image
                  source={{ uri: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.userID}` }}
                  style={styles.memberAvatarImg}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.name || m.userID}</Text>
                  <Text style={styles.memberRole}>{m.role === 'admin' ? 'Phó nhóm' : 'Thành viên'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Sub-view: Xác nhận chuyển quyền
    if (adminSubView === 'transferConfirm' && selectedNewOwner) {
      return (
        <View style={styles.transferConfirmContainer}>
          <View style={styles.transferConfirmMember}>
            <Image
              source={{ uri: selectedNewOwner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedNewOwner.userID}` }}
              style={styles.memberAvatarImg}
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{selectedNewOwner.name}</Text>
              <Text style={styles.memberRole}>{selectedNewOwner.role === 'admin' ? 'Phó nhóm' : 'Thành viên'}</Text>
            </View>
          </View>
          <View style={styles.transferWarning}>
            <Text style={styles.transferWarningTitle}>⚠️ Cảnh báo quan trọng</Text>
            <Text style={styles.transferWarningText}>
              Đây là quyết định không thể hoàn tác. Sau khi chuyển quyền, bạn sẽ trở thành phó nhóm và không thể lấy lại quyền trưởng nhóm trừ khi người mới chuyển lại cho bạn.
            </Text>
          </View>
          <Text style={styles.transferConfirmText}>
            Bạn có chắc chắn muốn chuyển quyền trưởng nhóm cho{' '}
            <Text style={{ fontWeight: 'bold' }}>{selectedNewOwner.name}</Text>?
          </Text>
          <View style={styles.transferConfirmButtons}>
            <TouchableOpacity
              style={styles.transferBackBtn}
              onPress={() => { setAdminSubView('transferOwner'); setSelectedNewOwner(null); }}
            >
              <Text style={styles.transferBackBtnText}>Quay lại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.transferConfirmBtn}
              onPress={handleTransferOwner}
            >
              <Text style={styles.transferConfirmBtnText}>Xác nhận chuyển</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Main admin view
    return (
      <ScrollView style={styles.content}>
        {owner && (
          <View style={styles.memberItem}>
            <Image
              source={{ uri: owner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${owner.userID}` }}
              style={styles.memberAvatarImg}
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{owner.name || owner.userID}</Text>
              <Text style={styles.memberRole}>Trưởng nhóm</Text>
            </View>
          </View>
        )}

        {admins.map(admin => (
          <View key={admin.userID} style={styles.memberItem}>
            <Image
              source={{ uri: admin.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${admin.userID}` }}
              style={styles.memberAvatarImg}
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{admin.name || admin.userID}</Text>
              <Text style={styles.memberRole}>Phó nhóm</Text>
            </View>
            {isOwner && (
              <TouchableOpacity
                style={styles.removeAdminButton}
                onPress={() => handleDemoteAdmin(admin)}
              >
                <Text style={styles.removeAdminButtonText}>Xóa</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {isOwner && (
          <View style={styles.adminActions}>
            <TouchableOpacity
              style={styles.adminActionButton}
              onPress={() => { setAdminSubView('addAdmin'); setAdminSearchQuery(''); }}
            >
              <Text style={styles.adminActionButtonText}>Thêm phó nhóm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminActionButton}
              onPress={() => { setAdminSubView('transferOwner'); setAdminSearchQuery(''); }}
            >
              <Text style={styles.adminActionButtonText}>Chuyển quyền trưởng nhóm</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {renderHeader()}
        {currentView === 'settings' && renderSettingsView()}
        {currentView === 'block' && renderBlockView()}
        {currentView === 'admin' && renderAdminView()}
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
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  adminNotice: {
    flexDirection: 'row',
    margin: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  adminNoticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminNoticeEmoji: {
    fontSize: 16,
  },
  adminNoticeContent: {
    flex: 1,
  },
  adminNoticeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  adminNoticeText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    marginRight: 12,
  },
  settingLabelMultiline: {
    lineHeight: 20,
  },
  settingItemWithDesc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  settingLabelBold: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  settingDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#0068ff',
    fontFamily: 'monospace',
  },
  linkButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  // 3 nút cuối
  bottomActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  bottomActionText: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  bottomActionTextDanger: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#ff3b30',
  },
  blockDescription: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  blockDescriptionText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  blockAddSection: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  blockAddButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#ffcccc',
    alignItems: 'center',
  },
  blockAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff3b30',
  },
  blockListSection: {
    padding: 16,
  },
  emptyBlockList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyBlockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyBlockText: {
    fontSize: 13,
    color: '#aaa',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#888',
  },
  removeAdminButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff0f0',
  },
  removeAdminButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ff3b30',
  },
  adminActions: {
    padding: 16,
    gap: 8,
  },
  adminActionButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  adminActionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  // Flex helper
  flex1: {
    flex: 1,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  // Member avatar image
  memberAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0068ff',
    borderColor: '#0068ff',
  },
  // Block footer
  blockFooter: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  blockCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  blockCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  blockConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
  },
  blockConfirmBtnDisabled: {
    opacity: 0.4,
  },
  blockConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  blockedCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  unblockBtnText: {
    fontSize: 13,
    color: '#111',
  },
  // Add admin
  addAdminBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0068ff',
  },
  addAdminBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  // Transfer owner
  transferHint: {
    padding: 16,
    paddingBottom: 4,
  },
  transferHintText: {
    fontSize: 13,
    color: '#666',
  },
  transferConfirmContainer: {
    padding: 20,
  },
  transferConfirmMember: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  transferWarning: {
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#ffcccc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  transferWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff3b30',
    marginBottom: 6,
  },
  transferWarningText: {
    fontSize: 12,
    color: '#cc0000',
    lineHeight: 18,
  },
  transferConfirmText: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  transferConfirmButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  transferBackBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  transferBackBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  transferConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
  },
  transferConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default GroupManagementModal;