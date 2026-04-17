import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  Alert, Image, ActivityIndicator, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OtherProfileModal from './OtherProfileModal';

interface FoundUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'blocked';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUser: { userID: string; name: string } | null;
  onStartChat?: (chat: any) => void;
}

type Step = 'search' | 'profile' | 'add_friend';

const AddFriendModal = ({ visible, onClose, currentUser, onStartChat }: Props) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('search');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [recentFound, setRecentFound] = useState<FoundUser[]>([]);

  const getToken = async () => AsyncStorage.getItem('token');

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem('recentSearches').then(stored => {
      if (stored) {
        try { setRecentFound(JSON.parse(stored)); } catch { /* ignore */ }
      }
    });
  }, [visible]);

  const saveRecent = async (users: FoundUser[]) => {
    await AsyncStorage.setItem('recentSearches', JSON.stringify(users));
  };

  useEffect(() => {
    if (!currentUser || !visible) return;
    socket.emit('join_user', currentUser.userID);

    const handleCancelled = (data: { senderID: string; recipientID: string }) => {
      const targetID = data.senderID === currentUser.userID ? data.recipientID : data.senderID;
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === targetID ? { ...u, friendStatus: 'none' as const } : u);
        saveRecent(updated);
        return updated;
      });
      if (selectedUser?.userID === targetID) setSelectedUser(prev => prev ? { ...prev, friendStatus: 'none' } : null);
    };

    const handleAccepted = (data: { userID: string }) => {
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === data.userID ? { ...u, friendStatus: 'accepted' as const } : u);
        saveRecent(updated);
        return updated;
      });
      if (selectedUser?.userID === data.userID) setSelectedUser(prev => prev ? { ...prev, friendStatus: 'accepted' } : null);
    };

    const handleRejected = (data: { senderID: string; recipientID: string }) => {
      const targetID = data.senderID === currentUser.userID ? data.recipientID : data.senderID;
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === targetID ? { ...u, friendStatus: 'none' as const } : u);
        saveRecent(updated);
        return updated;
      });
      if (selectedUser?.userID === targetID) setSelectedUser(prev => prev ? { ...prev, friendStatus: 'none' } : null);
    };

    socket.on('friend_request_cancelled', handleCancelled);
    socket.on('friend_request_accepted', handleAccepted);
    socket.on('friend_request_rejected', handleRejected);

    return () => {
      socket.off('friend_request_cancelled', handleCancelled);
      socket.off('friend_request_accepted', handleAccepted);
      socket.off('friend_request_rejected', handleRejected);
    };
  }, [currentUser, visible, selectedUser?.userID]);

  const handleSearch = async () => {
    if (!phone.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại'); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/search-friend-by-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      if (!res.ok) { Alert.alert('Không tìm thấy', 'Không tìm thấy người dùng với số điện thoại này'); return; }
      const data: FoundUser = await res.json();
      setRecentFound(prev => {
        const filtered = prev.filter(u => u.userID !== data.userID);
        const updated = [data, ...filtered].slice(0, 10);
        saveRecent(updated);
        return updated;
      });
      handleUserClick(data);
    } catch { Alert.alert('Lỗi', 'Không thể tìm kiếm'); }
    finally { setLoading(false); }
  };

  const handleUserClick = (foundUser: FoundUser) => {
    setSelectedUser(foundUser);
    setMessage(`Xin chào, mình là ${currentUser?.name || ''}. Kết bạn với mình nhé!`);
    setStep('profile');
  };

  const handleSendRequest = async () => {
    if (!selectedUser) return;
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/send-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientPhone: selectedUser.sdt, message: message.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Lỗi', err.message || 'Không thể gửi lời mời');
        return;
      }
      setSelectedUser({ ...selectedUser, friendStatus: 'pending_sent' });
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === selectedUser.userID ? { ...u, friendStatus: 'pending_sent' as const } : u);
        saveRecent(updated);
        return updated;
      });
      Alert.alert('Thành công', 'Đã gửi lời mời kết bạn');
      setStep('profile');
    } catch { Alert.alert('Lỗi', 'Không thể gửi lời mời'); }
    finally { setSending(false); }
  };

  const handleCancelRequest = async () => {
    if (!selectedUser) return;
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/cancel-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientID: selectedUser.userID }),
      });
      setSelectedUser({ ...selectedUser, friendStatus: 'none' });
      setRecentFound(prev => {
        const updated = prev.map(u => u.userID === selectedUser.userID ? { ...u, friendStatus: 'none' as const } : u);
        saveRecent(updated);
        return updated;
      });
    } catch { Alert.alert('Lỗi', 'Không thể thu hồi lời mời'); }
  };

  const handleClose = () => {
    setStep('search');
    setPhone('');
    setSelectedUser(null);
    onClose();
  };

  const getFriendStatusLabel = (status: FoundUser['friendStatus']) => {
    switch (status) {
      case 'accepted': return { label: 'Đã là bạn', color: '#34c759' };
      case 'pending_sent': return { label: 'Đã gửi lời mời', color: '#ff9500' };
      case 'pending_received': return { label: 'Đã nhận lời mời', color: '#007aff' };
      case 'self': return { label: 'Đây là bạn', color: '#999' };
      default: return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {step === 'profile' ? (
            <TouchableOpacity onPress={() => setStep('search')}>
              <Text style={styles.backBtn}>← Quay lại</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <Text style={styles.title}>{step === 'search' ? 'Thêm bạn' : 'Thông tin'}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>Đóng</Text>
          </TouchableOpacity>
        </View>
  // ===== SEARCH STEP =====
  const renderSearch = () => (
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Thêm bạn</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#555" />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập số điện thoại..."
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#aaa"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
          </View>

          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="#0068ff" />
            </View>
          )}

          {/* Recent list */}
          <ScrollView style={{ flex: 1 }}>
            {recentFound.length > 0 && !loading && (
              <>
                <Text style={styles.sectionLabel}>Kết quả gần nhất</Text>
                {recentFound.map(item => (
                  <TouchableOpacity
                    key={item.userID}
                    style={styles.resultItem}
                    onPress={() => handleUserClick(item)}
                  >
                    <Image
                      source={{ uri: item.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}` }}
                      style={styles.avatar}
                    />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userSub}>
                        {item.friendStatus === 'pending_sent' && <Text style={{ color: '#f97316' }}>[Đã gửi lời mời] </Text>}
                        {item.friendStatus === 'pending_received' && <Text style={{ color: '#3b82f6' }}>[Lời mời kết bạn] </Text>}
                        {item.friendStatus === 'accepted' && <Text style={{ color: '#22c55e' }}>[Bạn bè] </Text>}
                        {item.sdt}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={async () => {
                        try {
                          const token = await getToken();
                          const res = await fetch(`${API_URL}/api/chats/stranger`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ userID2: item.userID }),
                          });
                          const chat = await res.json();
                          onStartChat?.(chat);
                        } catch { Alert.alert('Lỗi', 'Không thể bắt đầu trò chuyện'); }
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color="#0068ff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => {
                        setRecentFound(prev => {
                          const updated = prev.filter(u => u.userID !== item.userID);
                          saveRecent(updated);
                          return updated;
                        });
                      }}
                    >
                      <Ionicons name="close" size={16} color="#aaa" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancel} onPress={handleClose}>
              <Text style={styles.btnCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSearch} disabled={loading}>
              <Text style={styles.btnPrimaryText}>Tìm kiếm</Text>
            </TouchableOpacity>
          </View>
        </View>
        );

  // ===== ADD FRIEND STEP (lời nhắn kèm lời mời) =====
  const renderAddFriend = () => {
    if (!selectedUser) return null;
        return (
        <View style={styles.sheet}>
          <View style={styles.coverContainer}>
            <Image
              source={{ uri: selectedUser.anhBia || 'https://res.cloudinary.com/ddu7vms87/image/upload/v1740316684/p79itfnd9o7atd62269y.jpg' }}
              style={styles.coverImage}
            />
            <View style={styles.coverHeader}>
              <TouchableOpacity onPress={() => setStep('profile')} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
                <Text style={styles.backBtnText}>Thông tin tài khoản</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileAvatarWrap}>
              <Image
                source={{ uri: selectedUser.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.userID}` }}
                style={styles.profileAvatar}
              />
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.profileName}>{selectedUser.name}</Text>
            <View style={styles.messageBox}>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={150}
                placeholderTextColor="#aaa"
              />
              <Text style={styles.charCount}>{message.length}/150 ký tự</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setStep('profile')}>
              <Text style={styles.btnCancelText}>Thông tin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSendRequest} disabled={sending}>
              <Text style={styles.btnPrimaryText}>{sending ? 'Đang gửi...' : 'Kết bạn'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        );
  };

        return (
        <>
          {/* Search modal */}
          <Modal visible={visible && step === 'search'} animationType="slide" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
              {renderSearch()}
            </View>
          </Modal>

          {/* Profile modal — dùng OtherProfileModal */}
          {visible && step === 'profile' && selectedUser && (
            <OtherProfileModal
              visible
              user={selectedUser}
              currentUser={currentUser}
              onClose={handleClose}
              onBack={() => setStep('search')}
              onStartChat={(chat) => { onStartChat?.(chat); handleClose(); }}
              onAddFriend={() => {
                setMessage(`Xin chào, mình là ${currentUser?.name || ''}. Kết bạn với mình nhé!`);
                setStep('add_friend');
              }}
              onStatusChange={(status) => {
                if (selectedUser) {
                  const updated = { ...selectedUser, friendStatus: status as any };
                  setSelectedUser(updated);
                  setRecentFound(prev => {
                    const arr = prev.map(u => u.userID === selectedUser.userID ? { ...u, friendStatus: status as any } : u);
                    saveRecent(arr);
                    return arr;
                  });
                }
              }}
            />
          )}

          {/* Add friend (lời nhắn) modal */}
          <Modal visible={visible && step === 'add_friend'} animationType="slide" transparent onRequestClose={() => setStep('profile')}>
            <View style={styles.overlay}>
              {renderAddFriend()}
            </View>
          </Modal>
        </>
        );
};

        const styles = StyleSheet.create({
          overlay: {
          flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
  },
        sheet: {
          backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        height: '90%',
        overflow: 'hidden',
  },
        header: {
          flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
  },
        title: {fontSize: 15, fontWeight: '700', color: '#111' },
        closeBtn: {padding: 4 },
        searchRow: {
          paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 8,
  },
        searchInput: {
          borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111',
  },
        sectionLabel: {
          fontSize: 13,
        color: '#6b7280',
        fontWeight: '600',
        paddingHorizontal: 16,
        paddingVertical: 8,
  },
        resultItem: {
          flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f3f4f6',
  },
        avatar: {width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#e5e7eb' },
        userInfo: {flex: 1 },
        userName: {fontSize: 14.5, fontWeight: '600', color: '#111' },
        userSub: {fontSize: 13, color: '#6b7280', marginTop: 2 },
        chatBtn: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
        removeBtn: {width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
        footer: {
          flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#f9fafb',
  },
        btnCancel: {
          paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#e5e7eb',
  },
        btnCancelText: {fontSize: 14.5, fontWeight: '600', color: '#374151' },
        btnPrimary: {
          paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#0068ff',
  },
        btnPrimaryText: {fontSize: 14.5, fontWeight: '600', color: '#fff' },
        // Add friend step
        coverContainer: {position: 'relative', height: 160 },
        coverImage: {width: '100%', height: 160 },
        coverHeader: {
          position: 'absolute',
        top: 0, left: 0, right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
  },
        backBtn: {flexDirection: 'row', alignItems: 'center', gap: 4 },
        backBtnText: {color: '#fff', fontSize: 15, fontWeight: '600' },
        profileAvatarWrap: {position: 'absolute', bottom: -36, left: 20 },
        profileAvatar: {
          width: 72, height: 72, borderRadius: 36,
        borderWidth: 3, borderColor: '#fff', backgroundColor: '#e5e7eb',
  },
        profileName: {fontSize: 18, fontWeight: '700', color: '#111', marginTop: 44, marginBottom: 16 },
        messageBox: {
          borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
        padding: 12, backgroundColor: '#fafafa',
  },
        messageInput: {fontSize: 14, color: '#111', minHeight: 80, textAlignVertical: 'top' },
        charCount: {fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
});

        export default AddFriendModal;
