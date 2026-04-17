import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Image,
  ScrollView, Alert,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';

export interface OtherUser {
  userID: string;
  name: string;
  sdt?: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
  trangThai?: string;
  alias?: string;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'blocked';
}

interface Props {
  visible: boolean;
  user: OtherUser;
  currentUser: { userID: string; name: string } | null;
  onClose: () => void;
  onBack?: () => void;
  onStartChat?: (chat: any) => void;
  onAddFriend?: () => void;
  onAcceptFriend?: () => void;
  onCancelRequest?: () => void;
  onStatusChange?: (status: string) => void;
}

const ConfirmDialog = ({
  visible, title, message, danger, onConfirm, onCancel,
}: {
  visible: boolean; title: string; message: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={cd.overlay}>
      <View style={cd.box}>
        <Text style={cd.title}>{title}</Text>
        <Text style={cd.msg}>{message}</Text>
        <View style={cd.row}>
          <TouchableOpacity style={cd.btnCancel} onPress={onCancel}>
            <Text style={cd.btnCancelText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cd.btnConfirm, danger && cd.btnDanger]} onPress={onConfirm}>
            <Text style={cd.btnConfirmText}>Xác nhận</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const cd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320 },
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  msg: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#e5e7eb', alignItems: 'center' },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  btnConfirm: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#0068ff', alignItems: 'center' },
  btnDanger: { backgroundColor: '#ef4444' },
  btnConfirmText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

const OtherProfileModal = ({
  visible, user, currentUser, onClose, onBack, onStartChat, onAddFriend, onAcceptFriend, onCancelRequest, onStatusChange,
}: Props) => {
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [showRecallConfirm, setShowRecallConfirm] = useState(false);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [localStatus, setLocalStatus] = useState(user.friendStatus);

  // sync khi user prop thay đổi
  React.useEffect(() => { setLocalStatus(user.friendStatus); }, [user.friendStatus]);

  const getToken = () => AsyncStorage.getItem('token');

  const handleStartChat = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/createChat1-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userID2: user.userID }),
      });
      const data = await res.json();
      onStartChat?.(data);
      onClose();
    } catch { Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện'); }
  };

  const handleUnfriend = async () => {
    setShowUnfriendConfirm(false);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/unfriend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendID: user.userID }),
      });
      setLocalStatus('none');
      onStatusChange?.('none');
      onClose();
    } catch { Alert.alert('Lỗi', 'Không thể thực hiện thao tác'); }
  };

  const handleBlock = async () => {
    setShowBlockConfirm(false);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserID: user.userID }),
      });
      // Backend sẽ emit friend_status_update, không cần emit từ client
      setLocalStatus('blocked');
      onStatusChange?.('blocked');
      onClose();
    } catch { Alert.alert('Lỗi', 'Không thể thực hiện thao tác'); }
  };

  const handleUnblock = async () => {
    setShowUnblockConfirm(false);
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserID: user.userID }),
      });
      // Backend sẽ emit friend_status_update, không cần emit từ client
      setLocalStatus('none');
      onStatusChange?.('none');
      onClose();
    } catch { Alert.alert('Lỗi', 'Không thể thực hiện thao tác'); }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')} tháng ${String(d.getMonth() + 1).padStart(2, '0')}, ${d.getFullYear()}`;
  };

  const renderActions = () => {
    if (localStatus === 'self') {
      return (
        <View style={s.actionRow}>
          <View style={[s.actionBtn, s.actionBtnGray, { flex: 1 }]}>
            <Text style={s.actionBtnGrayText}>Đây là hồ sơ của bạn</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={s.actionRow}>
        {/* Left action */}
        {localStatus === 'accepted' && (
          <View style={{ flex: 1, position: 'relative' }}>
            <TouchableOpacity 
              style={[s.actionBtn, s.actionBtnGray]} 
              onPress={() => setShowFriendMenu(!showFriendMenu)}
            >
              <Ionicons name="people" size={16} color="#374151" style={{ marginRight: 6 }} />
              <Text style={s.actionBtnGrayText}>Bạn bè</Text>
              <Ionicons name="chevron-down" size={12} color="#374151" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {showFriendMenu && (
              <View style={s.dropdownMenu}>
                <TouchableOpacity 
                  style={s.dropdownItem} 
                  onPress={() => {
                    setShowFriendMenu(false);
                    setShowUnfriendConfirm(true);
                  }}
                >
                  <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                  <Text style={[s.dropdownItemText, { color: '#ef4444' }]}>Hủy kết bạn</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {localStatus === 'pending_received' && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnBlue, { flex: 1 }]} onPress={onAcceptFriend}>
            <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={s.actionBtnBlueText}>Chấp nhận</Text>
          </TouchableOpacity>
        )}
        {localStatus === 'pending_sent' && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnRed, { flex: 1 }]} onPress={() => setShowRecallConfirm(true)}>
            <Ionicons name="arrow-undo" size={16} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={s.actionBtnRedText}>Thu hồi lời mời</Text>
          </TouchableOpacity>
        )}
        {localStatus === 'none' && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnGray, { flex: 1 }]} onPress={onAddFriend}>
            <Text style={s.actionBtnGrayText}>Kết bạn</Text>
          </TouchableOpacity>
        )}
        {localStatus === 'blocked' && (
          <TouchableOpacity style={[s.actionBtn, s.actionBtnBlue, { flex: 1 }]} onPress={() => setShowUnblockConfirm(true)}>
            <Text style={s.actionBtnBlueText}>Bỏ chặn</Text>
          </TouchableOpacity>
        )}

        {/* Chat button */}
        {localStatus !== 'blocked' && (
          <TouchableOpacity
            style={[
              s.actionBtn,
              localStatus?.startsWith('pending') ? s.actionBtnBlueSoft : s.actionBtnBlue,
              { flex: 1 },
            ]}
            onPress={handleStartChat}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={16}
              color={localStatus?.startsWith('pending') ? '#0068ff' : '#fff'}
              style={{ marginRight: 6 }}
            />
            <Text style={localStatus?.startsWith('pending') ? s.actionBtnBlueSoftText : s.actionBtnBlueText}>
              Nhắn tin
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Sticky header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {onBack && (
                <TouchableOpacity onPress={onBack}>
                  <Ionicons name="chevron-back" size={20} color="#374151" />
                </TouchableOpacity>
              )}
              <Text style={s.headerTitle}>Thông tin tài khoản</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Cover + Avatar */}
            <View style={s.coverWrap}>
              <Image
                source={{ uri: user.anhBia || 'https://res.cloudinary.com/ddu7vms87/image/upload/v1740316684/p79itfnd9o7atd62269y.jpg' }}
                style={s.cover}
              />
              <View style={s.avatarWrap}>
                <Image
                  source={{ uri: user.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userID}` }}
                  style={s.avatar}
                />
                <View style={[s.onlineDot, { backgroundColor: user.trangThai === 'online' ? '#22c55e' : '#9ca3af' }]} />
              </View>
            </View>

            {/* Name + Actions */}
            <View style={s.section}>
              <Text style={s.name}>{user.alias || user.name}</Text>
              {renderActions()}
            </View>

            {/* Personal info */}
            <View style={[s.section, s.sectionBorder]}>
              <Text style={s.sectionTitle}>Thông tin cá nhân</Text>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Giới tính</Text>
                <Text style={s.infoValue}>{user.gioTinh || '—'}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Ngày sinh</Text>
                <Text style={s.infoValue}>{formatDate(user.ngaysinh)}</Text>
              </View>
              {(localStatus === 'accepted' || localStatus === 'self') && (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Điện thoại</Text>
                  <Text style={s.infoValue}>{user.sdt}</Text>
                </View>
              )}
            </View>

            {/* More actions */}
            {localStatus !== 'self' && (
              <View style={s.sectionBorder}>
                <TouchableOpacity style={s.menuItem}>
                  <Ionicons name="people-outline" size={22} color="#6b7280" style={s.menuIcon} />
                  <Text style={s.menuText}>Nhóm chung</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem}>
                  <Ionicons name="share-social-outline" size={22} color="#6b7280" style={s.menuIcon} />
                  <Text style={s.menuText}>Chia sẻ danh thiếp</Text>
                </TouchableOpacity>
                {localStatus !== 'blocked' ? (
                  <TouchableOpacity style={s.menuItem} onPress={() => setShowBlockConfirm(true)}>
                    <MaterialIcons name="block" size={22} color="#6b7280" style={s.menuIcon} />
                    <Text style={s.menuText}>Chặn tin nhắn và cuộc gọi</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.menuItem} onPress={() => setShowUnblockConfirm(true)}>
                    <MaterialIcons name="block" size={22} color="#ef4444" style={s.menuIcon} />
                    <Text style={[s.menuText, { color: '#ef4444' }]}>Bỏ chặn</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.menuItem}>
                  <Ionicons name="warning-outline" size={22} color="#6b7280" style={s.menuIcon} />
                  <Text style={s.menuText}>Báo xấu</Text>
                </TouchableOpacity>

              </View>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>

      <ConfirmDialog
        visible={showUnfriendConfirm}
        title="Xác nhận xóa bạn"
        message={`Xóa ${user.name} khỏi danh sách bạn bè?`}
        danger
        onConfirm={handleUnfriend}
        onCancel={() => setShowUnfriendConfirm(false)}
      />
      <ConfirmDialog
        visible={showBlockConfirm}
        title="Xác nhận chặn"
        message={`Chặn ${user.name}? Người này sẽ không thể gửi tin nhắn cho bạn.`}
        danger
        onConfirm={handleBlock}
        onCancel={() => setShowBlockConfirm(false)}
      />
      <ConfirmDialog
        visible={showUnblockConfirm}
        title="Xác nhận bỏ chặn"
        message={`Bạn có muốn bỏ chặn liên lạc với ${user.name}?`}
        onConfirm={handleUnblock}
        onCancel={() => setShowUnblockConfirm(false)}
      />
      <ConfirmDialog
        visible={showRecallConfirm}
        title="Xác nhận thu hồi"
        message={`Bạn có muốn thu hồi lời mời kết bạn gửi cho ${user.name}?`}
        onConfirm={() => {
          setShowRecallConfirm(false);
          onCancelRequest?.();
        }}
        onCancel={() => setShowRecallConfirm(false)}
      />
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '92%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  // Cover
  coverWrap: { position: 'relative', marginBottom: 48 },
  cover: { width: '100%', height: 200, backgroundColor: '#e5e7eb' },
  avatarWrap: { position: 'absolute', bottom: -40, left: 20 },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: '#fff', backgroundColor: '#e5e7eb' },
  onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#fff' },
  // Sections
  section: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionBorder: { borderTopWidth: 8, borderTopColor: '#f3f4f6', paddingVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 14 },
  name: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 14 },
  // Info rows
  infoRow: { flexDirection: 'row', marginBottom: 14 },
  infoLabel: { width: 100, fontSize: 14.5, color: '#6b7280' },
  infoValue: { flex: 1, fontSize: 14.5, fontWeight: '500', color: '#111' },
  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 12, paddingHorizontal: 12 },
  actionBtnGray: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  actionBtnGrayText: { fontSize: 14.5, fontWeight: '700', color: '#374151' },
  actionBtnBlue: { backgroundColor: '#0068ff' },
  actionBtnBlueText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  actionBtnBlueSoft: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  actionBtnBlueSoftText: { fontSize: 14.5, fontWeight: '700', color: '#0068ff' },
  actionBtnRed: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  actionBtnRedText: { fontSize: 14.5, fontWeight: '700', color: '#ef4444' },
  // Menu items
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  menuIcon: { marginRight: 16 },
  menuText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  // Dropdown
  dropdownMenu: {
    position: 'absolute',
    top: 46,
    left: 0,
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 1000,
    padding: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 14.5,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default OtherProfileModal;
