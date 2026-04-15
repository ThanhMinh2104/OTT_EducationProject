import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  Alert, FlatList, Image, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FoundUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'self' | 'blocked';
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUser: { userID: string; name: string } | null;
  onStartChat?: (chat: any) => void;
}

type Step = 'search' | 'profile';

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

  // Load recent searches from AsyncStorage
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

  // Sync socket events
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

      // Update recent
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

  const handleStartChat = async () => {
    if (!selectedUser) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/createChat1-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userID2: selectedUser.userID }),
      });
      const data = await res.json();
      onStartChat?.(data);
      onClose();
    } catch { Alert.alert('Lỗi', 'Không thể mở cuộc trò chuyện'); }
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

        {step === 'search' ? (
          <>
            {/* Search input */}
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Nhập số điện thoại"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#999"
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoFocus
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.searchBtnText}>Tìm</Text>}
              </TouchableOpacity>
            </View>

            {/* Recent searches */}
            {recentFound.length > 0 && (
              <>
                <Text style={styles.recentLabel}>Kết quả gần nhất</Text>
                <FlatList
                  data={recentFound}
                  keyExtractor={item => item.userID}
                  renderItem={({ item }) => {
                    const statusInfo = getFriendStatusLabel(item.friendStatus);
                    return (
                      <TouchableOpacity style={styles.resultItem} onPress={() => handleUserClick(item)}>
                        <Image
                          source={{ uri: item.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}` }}
                          style={styles.avatar}
                        />
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{item.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {statusInfo && <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>}
                            <Text style={styles.userPhone}>{item.sdt}</Text>
                          </View>
                        </View>
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
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}
          </>
        ) : selectedUser ? (
          /* Profile view */
          <View style={styles.profileContainer}>
            <Image
              source={{ uri: selectedUser.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.userID}` }}
              style={styles.profileAvatar}
            />
            <Text style={styles.profileName}>{selectedUser.name}</Text>
            <Text style={styles.profilePhone}>{selectedUser.sdt}</Text>

            {selectedUser.friendStatus === 'none' && (
              <>
                <View style={styles.messageBox}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Lời nhắn kèm lời mời..."
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={150}
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.charCount}>{message.length}/150</Text>
                </View>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleSendRequest} disabled={sending}>
                  <Text style={styles.btnPrimaryText}>{sending ? 'Đang gửi...' : 'Kết bạn'}</Text>
                </TouchableOpacity>
              </>
            )}

            {selectedUser.friendStatus === 'pending_sent' && (
              <View style={styles.statusBox}>
                <Text style={styles.statusBoxText}>Đã gửi lời mời kết bạn</Text>
                <TouchableOpacity style={styles.btnSecondary} onPress={handleCancelRequest}>
                  <Text style={styles.btnSecondaryText}>Thu hồi lời mời</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedUser.friendStatus === 'pending_received' && (
              <View style={styles.statusBox}>
                <Text style={styles.statusBoxText}>Đã gửi lời mời kết bạn cho bạn</Text>
              </View>
            )}

            {selectedUser.friendStatus === 'accepted' && (
              <TouchableOpacity style={styles.btnPrimary} onPress={handleStartChat}>
                <Text style={styles.btnPrimaryText}>Nhắn tin</Text>
              </TouchableOpacity>
            )}

            {selectedUser.friendStatus === 'self' && (
              <View style={styles.statusBox}>
                <Text style={styles.statusBoxText}>Đây là tài khoản của bạn</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  backBtn: { fontSize: 14, color: '#0e9de8', fontWeight: '600', width: 60 },
  closeBtn: { fontSize: 14, color: '#0e9de8', fontWeight: '600' },
  searchBox: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: '#fff', marginBottom: 8 },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1a1a1a',
  },
  searchBtn: {
    backgroundColor: '#0e9de8', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 8, justifyContent: 'center', minWidth: 60, alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  recentLabel: { fontSize: 13, color: '#999', fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8 },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  userPhone: { fontSize: 13, color: '#999', marginTop: 2 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 14, color: '#999' },
  profileContainer: { flex: 1, alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  profileAvatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 16 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4 },
  profilePhone: { fontSize: 15, color: '#999', marginBottom: 24 },
  messageBox: {
    width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa',
  },
  messageInput: { fontSize: 14, color: '#1a1a1a', minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 4 },
  btnPrimary: {
    width: '100%', backgroundColor: '#0e9de8', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
  },
  btnSecondaryText: { color: '#ff3b30', fontSize: 14, fontWeight: '600' },
  statusBox: { alignItems: 'center', padding: 16 },
  statusBoxText: { fontSize: 15, color: '#65676b', textAlign: 'center' },
});

export default AddFriendModal;
