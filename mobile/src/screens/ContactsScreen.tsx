import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, TextInput, ActivityIndicator, Modal, ScrollView,
  Share, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';
import OtherProfileModal, { OtherUser } from '../components/OtherProfileModal';
import AddFriendModal from '../components/AddFriendModal';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axiosInstance from '../utils/axios';

interface Friend {
  userID: string; name: string; sdt?: string;
  anhDaiDien?: string; anhBia?: string; ngaysinh?: string;
  gioTinh?: string; trangThai?: string; alias?: string;
}
interface FriendRequest {
  contactID: string; userID: string; name?: string;
  avatar?: string; sdt?: string; message?: string;
  anhBia?: string; ngaysinh?: string; gioTinh?: string;
}
interface SentRequest {
  recipientID: string; senderID: string; name?: string;
  avatar?: string; sdt?: string; anhBia?: string;
}
interface BlockedUser {
  userID: string; name: string; sdt?: string; anhDaiDien?: string;
}

type Tab = 'friends' | 'requests' | 'blocked';

import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

// Hỗ trợ cả hai cách dùng: nhúng trực tiếp (Component) hoặc qua Navigation (Screen)
type Props = Partial<StackScreenProps<RootStackParamList, 'Contacts'>> & {
  user?: { userID: string; name: string; anhDaiDien?: string } | null;
  onStartChat?: (chat: any) => void;
};

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

const ContactsScreen = ({ navigation, route, user: propsUser, onStartChat: propsOnStartChat }: Props) => {
  // Ưu tiên dữ liệu từ prop (HomeScreen truyền vào), sau đó mới tới route params
  const user = propsUser || route?.params?.user;

  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [recallTarget, setRecallTarget] = useState<SentRequest | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<OtherUser | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrTab, setQrTab] = useState<'myqr' | 'scan'>('myqr');
  const [qrScanned, setQrScanned] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isReceivedExpanded, setIsReceivedExpanded] = useState(true);
  const [isSentExpanded, setIsSentExpanded] = useState(true);
  const [activeMenuFriend, setActiveMenuFriend] = useState<Friend | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<Friend | null>(null);

  const getToken = () => AsyncStorage.getItem('token');

  const handleUnfriend = async () => {
    if (!unfriendTarget) return;
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/friend/${unfriendTarget.userID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFriends(prev => prev.filter(f => f.userID !== unfriendTarget.userID));
      }
    } catch { /* ignore */ }
    finally { setUnfriendTarget(null); }
  };

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/friends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchRequests = async () => {
    try {
      const token = await getToken();
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}/api/contacts/friend-requests`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/contacts/sent-friend-requests`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRequests(Array.isArray(await r1.json()) ? await r1.clone().json() : []);
      setSentRequests(Array.isArray(await r2.json()) ? await r2.clone().json() : []);
    } catch { /* ignore */ }
  };

  const fetchBlocked = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/blocked`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBlockedUsers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user) return;
    fetchFriends();
    fetchRequests();
    socket.emit('join_user', user.userID);

    socket.on('new_friend_request', (data: FriendRequest) => {
      setRequests(prev => prev.find(r => r.contactID === data.contactID) ? prev : [data, ...prev]);
    });
    socket.on('friend_request_accepted', (data: any) => {
      fetchFriends();
      setRequests(prev => prev.filter(r => r.contactID !== data.userID));
      setSentRequests(prev => prev.filter(r => r.recipientID !== data.userID));
    });
    socket.on('friend_request_cancelled', (data: { senderID: string; recipientID: string }) => {
      if (data.recipientID === user.userID) setRequests(prev => prev.filter(r => r.contactID !== data.senderID));
      if (data.senderID === user.userID) setSentRequests(prev => prev.filter(r => r.recipientID !== data.recipientID));
    });
    socket.on('friend_request_rejected', (data: { senderID: string; recipientID: string }) => {
      if (data.senderID === user.userID) setSentRequests(prev => prev.filter(r => r.recipientID !== data.recipientID));
    });
    socket.on('friend_unfriended', (data: { userID: string; friendID: string }) => {
      const targetID = data.userID === user.userID ? data.friendID : data.userID;
      setFriends(prev => prev.filter(f => f.userID !== targetID));
    });

    return () => {
      socket.off('new_friend_request');
      socket.off('friend_request_accepted');
      socket.off('friend_request_cancelled');
      socket.off('friend_request_rejected');
      socket.off('friend_unfriended');
    };
  }, [user?.userID]);

  useEffect(() => {
    if (tab === 'blocked') fetchBlocked();
    if (tab === 'requests') fetchRequests();
  }, [tab]);

  const handleAccept = async (req: FriendRequest) => {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/accept-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senderID: req.contactID }),
      });
      setRequests(prev => prev.filter(r => r.contactID !== req.contactID));
      fetchFriends();
    } catch { /* ignore */ }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/reject-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senderID: req.contactID }),
      });
      setRequests(prev => prev.filter(r => r.contactID !== req.contactID));
    } catch { /* ignore */ }
  };

  const handleCancelSent = async () => {
    if (!recallTarget) return;
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/cancel-friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientID: recallTarget.recipientID }),
      });
      setSentRequests(prev => prev.filter(r => r.recipientID !== recallTarget.recipientID));
    } catch { /* ignore */ }
    finally { setRecallTarget(null); }
  };

  const handleUnblock = async (targetUserID: string) => {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserID }),
      });
      setBlockedUsers(prev => prev.filter(u => u.userID !== targetUserID));
    } catch { /* ignore */ }
  };

  const onStartChat = (chat: any) => {
    if (propsOnStartChat) {
      propsOnStartChat(chat);
    } else if (navigation) {
      navigation.navigate('Chat', { selectedChat: chat });
    }
  };

  const handleStartChat = async (friendID: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/createChat1-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userID2: friendID }),
      });
      const data = await res.json();
      console.log('📥 Created/Got chat:', data);
      onStartChat(data);
    } catch { /* ignore */ }
  };

  // QR handlers
  const qrValue = user ? `ott-edu://add-friend/${user.userID}` : '';

  const qrScannedRef = React.useRef(false);

  const handleQRBarCodeScanned = async ({ data }: { data: string }) => {
    if (qrScannedRef.current || qrLoading) return;
    qrScannedRef.current = true;
    setQrScanned(true);

    // Phân biệt 2 loại QR: kết bạn vs vào nhóm
    const friendMatch = data.match(/ott-edu:\/\/add-friend\/(.+)/);
    const groupMatch = data.match(/ott-edu:\/\/join-group\/(.+)/);

    if (!friendMatch && !groupMatch) {
      Alert.alert('Lỗi', 'QR code không hợp lệ');
      qrScannedRef.current = false;
      setQrScanned(false);
      return;
    }

    // ── QR kết bạn ──────────────────────────────────────────
    if (friendMatch) {
      const scannedUserID = friendMatch[1];
      if (scannedUserID === user?.userID) {
        Alert.alert('Thông báo', 'Đây là mã QR của chính bạn!');
        qrScannedRef.current = false;
        setQrScanned(false);
        return;
      }
      setQrLoading(true);
      try {
        const res = await axiosInstance.get(`/users/qr-profile/${scannedUserID}`);
        const foundUser = res.data;
        setShowQRModal(false);
        setQrScanned(false);
        setSelectedProfile({
          userID: foundUser.userID,
          name: foundUser.name,
          sdt: foundUser.sdt,
          anhDaiDien: foundUser.anhDaiDien,
          anhBia: foundUser.anhBia,
          friendStatus: foundUser.friendStatus,
        });
      } catch {
        Alert.alert('Lỗi', 'Không tìm thấy người dùng');
        qrScannedRef.current = false;
        setQrScanned(false);
      } finally {
        setQrLoading(false);
      }
      return;
    }

    // ── QR vào nhóm ─────────────────────────────────────────
    if (groupMatch) {
      const scannedGroupID = groupMatch[1];
      console.log('🔍 [QR Group] scannedGroupID:', scannedGroupID);
      setQrLoading(true);
      try {
        console.log('🔍 [QR Group] calling API: /groups/join-info/' + scannedGroupID);
        const infoRes = await axiosInstance.get(`/groups/join-info/${scannedGroupID}`);
        console.log('✅ [QR Group] join-info response:', infoRes.data);
        const groupInfo = infoRes.data;

        if (groupInfo.isAlreadyMember) {
          setShowQRModal(false);
          setQrScanned(false);
          alert(`Bạn đã là thành viên của nhóm "${groupInfo.name}"`);
          return;
        }

        // Hỏi xác nhận trước khi join
        setQrLoading(false);
        setShowQRModal(false);
        setQrScanned(false);

        Alert.alert(
          'Tham gia nhóm',
          `Bạn muốn tham gia nhóm "${groupInfo.name}" (${groupInfo.memberCount} thành viên)?${groupInfo.requireApproval ? '\n\n⚠️ Nhóm này yêu cầu duyệt thành viên.' : ''}`,
          [
            { text: 'Hủy', style: 'cancel' },
            {
              text: groupInfo.requireApproval ? 'Gửi yêu cầu' : 'Tham gia',
              onPress: async () => {
                try {
                  const joinRes = await axiosInstance.post(`/groups/join/${scannedGroupID}`);
                  if (joinRes.data.requireApproval) {
                    Alert.alert('Đã gửi yêu cầu', 'Yêu cầu tham gia nhóm đã được gửi, đang chờ admin duyệt.');
                  } else {
                    Alert.alert('Thành công', `Đã tham gia nhóm "${groupInfo.name}"!`);
                    // Join socket room để nhận messages real-time
                    const { default: socket } = await import('../utils/socket');
                    socket.emit('join_group', scannedGroupID);
                    // Trigger reload chat list ở HomeScreen
                    if (user?.userID) {
                      socket.emit('getChat', user.userID);
                    }
                  }
                } catch (err: any) {
                  Alert.alert('Lỗi', err.response?.data?.message || 'Không thể tham gia nhóm');
                }
              },
            },
          ]
        );
      } catch (err: any) {
        console.error('❌ [QR Group] error:', err?.response?.status, err?.response?.data, err?.message);
        Alert.alert('Lỗi', err.response?.data?.message || 'Không thể lấy thông tin nhóm');
        qrScannedRef.current = false;
        setQrScanned(false);
      } finally {
        setQrLoading(false);
      }
    }
  };

  const handleShareQR = async () => {
    try {
      await Share.share({
        message: `Kết bạn với ${user?.name} trên OTT Education!\nMã: ${qrValue}`,
      });
    } catch { /* ignore */ }
  };

  const handleViewProfile = (item: any, status: OtherUser['friendStatus']) => {
    setSelectedProfile({
      userID: item.contactID || item.recipientID || item.userID,
      name: item.name,
      sdt: item.sdt,
      anhDaiDien: item.avatar || item.anhDaiDien,
      anhBia: item.anhBia,
      ngaysinh: item.ngaysinh,
      gioTinh: item.gioTinh,
      trangThai: item.trangThai,
      friendStatus: status,
    });
  };

  const groupedFriends = useMemo(() => {
    const unique = Array.from(new Map(friends.map(f => [f.userID, f])).values());
    const filtered = unique.filter(f =>
      (f.alias?.trim() || f.name).toLowerCase().includes(search.toLowerCase()) ||
      f.sdt?.includes(search)
    );
    const groups: Record<string, Friend[]> = {};
    filtered.forEach(f => {
      const key = (f.alias?.trim() || f.name).charAt(0).toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return Object.keys(groups).sort().map(label => ({
      label,
      items: groups[label].sort((a, b) => (a.alias?.trim() || a.name).localeCompare(b.alias?.trim() || b.name)),
    }));
  }, [friends, search]);

  const pendingCount = requests.length;

  const friendListData = groupedFriends.flatMap(g => [
    { type: 'section' as const, label: g.label },
    ...g.items.map(f => ({ type: 'friend' as const, data: f })),
  ]);

  const requestListData = [
    { type: 'section_received' as const },
    ...(isReceivedExpanded ? requests.map(r => ({ type: 'received' as const, data: r })) : []),
    { type: 'section_sent' as const },
    ...(isSentExpanded ? sentRequests.map(r => ({ type: 'sent' as const, data: r })) : []),
  ];

  return (
    <View style={s.container}>
      {/* Search + Add */}
      <View style={s.topBar}>
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Tìm bạn bè..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>
        {/* Nút QR */}
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => {
            setQrTab('myqr');
            setQrScanned(false);
            setShowQRModal(true);
          }}
        >
          <Ionicons name="qr-code-outline" size={20} color="#0068ff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAddFriend(true)}>
          <Ionicons name="person-add-outline" size={20} color="#0068ff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['friends', 'requests', 'blocked'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'friends' ? 'Bạn bè' : t === 'requests' ? 'Lời mời' : 'Đã chặn'}
            </Text>
            {t === 'requests' && pendingCount > 0 && (
              <View style={s.badge}><Text style={s.badgeText}>{pendingCount}</Text></View>
            )}
            {tab === t && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading && friends.length === 0 ? (
        <View style={s.center}><ActivityIndicator size="large" color="#0068ff" /></View>
      ) : tab === 'friends' ? (
        <FlatList
          data={friendListData}
          keyExtractor={(_, idx) => `f-${idx}`}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return <View style={s.sectionHeader}><Text style={s.sectionText}>{item.label}</Text></View>;
            }
            const friend = item.data;
            return (
              <TouchableOpacity
                style={s.friendItem}
                onPress={() => handleStartChat(friend.userID)}
                onLongPress={() => handleViewProfile(friend, 'accepted')}
              >
                <View style={s.avatarWrap}>
                  <Image
                    source={{ uri: friend.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.userID}` }}
                    style={s.avatar}
                  />
                  <View style={[s.onlineDot, { backgroundColor: friend.trangThai === 'online' ? '#22c55e' : '#d1d5db' }]} />
                </View>
                <View style={s.friendInfo}>
                  <Text style={s.friendName}>{friend.alias?.trim() || friend.name}</Text>
                  {friend.sdt ? <Text style={s.friendPhone}>{friend.sdt}</Text> : null}
                </View>
                <TouchableOpacity 
                   style={s.chatBtn} 
                   onPress={() => setActiveMenuFriend(friend)}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#6b7280" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyEmoji}>👥</Text>
              <Text style={s.emptyText}>Chưa có bạn bè nào</Text>
            </View>
          }
        />
      ) : tab === 'requests' ? (
        <FlatList
          data={requestListData}
          keyExtractor={(_, idx) => `req-${idx}`}
          renderItem={({ item }: any) => {
            if (item.type === 'section_received') {
              return (
                <TouchableOpacity style={s.sectionHeader} onPress={() => setIsReceivedExpanded(v => !v)}>
                  <Ionicons name={isReceivedExpanded ? 'chevron-down' : 'chevron-forward'} size={12} color="#0068ff" style={{ marginRight: 6 }} />
                  <Text style={s.sectionText}>Lời mời kết bạn ({requests.length})</Text>
                </TouchableOpacity>
              );
            }
            if (item.type === 'section_sent') {
              return (
                <TouchableOpacity style={[s.sectionHeader, { marginTop: 8 }]} onPress={() => setIsSentExpanded(v => !v)}>
                  <Ionicons name={isSentExpanded ? 'chevron-down' : 'chevron-forward'} size={12} color="#0068ff" style={{ marginRight: 6 }} />
                  <Text style={s.sectionText}>Lời mời đã gửi ({sentRequests.length})</Text>
                </TouchableOpacity>
              );
            }
            if (item.type === 'received') {
              const req = item.data as FriendRequest;
              return (
                <View style={s.requestItem}>
                  <TouchableOpacity onPress={() => handleViewProfile(req, 'pending_received')}>
                    <Image source={{ uri: req.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.contactID}` }} style={s.avatar} />
                  </TouchableOpacity>
                  <View style={s.requestInfo}>
                    <TouchableOpacity onPress={() => handleViewProfile(req, 'pending_received')}>
                      <Text style={s.friendName}>{req.name}</Text>
                    </TouchableOpacity>
                    {req.sdt ? <Text style={s.friendPhone}>{req.sdt}</Text> : null}
                    {req.message ? (
                      <View style={s.messageBubble}>
                        <Text style={s.messageText} numberOfLines={2}>"{req.message}"</Text>
                      </View>
                    ) : null}
                    <View style={s.requestActions}>
                      <TouchableOpacity style={s.btnAccept} onPress={() => handleAccept(req)}>
                        <Text style={s.btnAcceptText}>Chấp nhận</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnReject} onPress={() => handleReject(req)}>
                        <Text style={s.btnRejectText}>Từ chối</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }
            if (item.type === 'sent') {
              const req = item.data as SentRequest;
              return (
                <View style={s.requestItem}>
                  <TouchableOpacity onPress={() => handleViewProfile(req, 'pending_sent')}>
                    <Image source={{ uri: req.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.recipientID}` }} style={s.avatar} />
                  </TouchableOpacity>
                  <View style={s.requestInfo}>
                    <TouchableOpacity onPress={() => handleViewProfile(req, 'pending_sent')}>
                      <Text style={s.friendName}>{req.name}</Text>
                    </TouchableOpacity>
                    <Text style={s.sentLabel}>Đang chờ phản hồi</Text>
                    <TouchableOpacity style={s.btnRecall} onPress={() => setRecallTarget(req)}>
                      <Text style={s.btnRecallText}>Thu hồi lời mời</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            return null;
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyText}>Không có lời mời nào</Text>
            </View>
          }
        />
      ) : (
        /* Blocked tab */
        <FlatList
          data={blockedUsers}
          keyExtractor={item => item.userID}
          renderItem={({ item }) => (
            <View style={s.friendItem}>
              <View style={s.avatarWrap}>
                <Image
                  source={{ uri: item.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}` }}
                  style={[s.avatar, { opacity: 0.6 }]}
                />
              </View>
              <View style={s.friendInfo}>
                <Text style={s.friendName}>{item.name}</Text>
                {item.sdt ? <Text style={s.friendPhone}>{item.sdt}</Text> : null}
              </View>
              <TouchableOpacity
                style={s.unblockBtn}
                onPress={() => handleUnblock(item.userID)}
              >
                <Text style={s.unblockText}>Bỏ chặn</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyEmoji}>🚫</Text>
              <Text style={s.emptyText}>Chưa chặn ai</Text>
            </View>
          }
        />
      )}

      {/* Profile Modal */}
      {selectedProfile && (
        <OtherProfileModal
          visible={!!selectedProfile}
          user={selectedProfile}
          currentUser={user}
          onClose={() => setSelectedProfile(null)}
          onStartChat={(chat) => { onStartChat(chat); setSelectedProfile(null); }}
          onAddFriend={() => {
            if (selectedProfile.friendStatus === 'pending_received') {
              handleAccept({ contactID: selectedProfile.userID, name: selectedProfile.name } as any);
            } else if (selectedProfile.friendStatus === 'pending_sent') {
              setRecallTarget({ recipientID: selectedProfile.userID, name: selectedProfile.name } as any);
            }
            setSelectedProfile(null);
          }}
          onStatusChange={(status) => {
            if (status === 'none') setFriends(prev => prev.filter(f => f.userID !== selectedProfile.userID));
            if (status === 'blocked') {
              setFriends(prev => prev.filter(f => f.userID !== selectedProfile.userID));
              fetchBlocked();
            }
            setSelectedProfile(null);
          }}
        />
      )}

      {/* Add Friend Modal */}
      <AddFriendModal
        visible={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        currentUser={user}
        onStartChat={(chat) => { onStartChat(chat); setShowAddFriend(false); }}
      />

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={qrs.backdrop}>
          <View style={qrs.container}>
            {/* Header */}
            <View style={qrs.header}>
              <Text style={qrs.headerTitle}>Mã QR kết bạn</Text>
              <TouchableOpacity onPress={() => { setShowQRModal(false); setQrScanned(false); }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={qrs.tabBar}>
              <TouchableOpacity
                style={[qrs.tab, qrTab === 'myqr' && qrs.tabActive]}
                onPress={() => { setQrTab('myqr'); setQrScanned(false); }}
              >
                <Ionicons name="qr-code-outline" size={15} color={qrTab === 'myqr' ? '#0068FF' : '#888'} />
                <Text style={[qrs.tabText, qrTab === 'myqr' && qrs.tabTextActive]}>Mã QR của tôi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[qrs.tab, qrTab === 'scan' && qrs.tabActive]}
                onPress={() => {
                  setQrTab('scan');
                  setQrScanned(false);
                  if (!cameraPermission?.granted) requestCameraPermission();
                }}
              >
                <Ionicons name="camera-outline" size={15} color={qrTab === 'scan' ? '#0068FF' : '#888'} />
                <Text style={[qrs.tabText, qrTab === 'scan' && qrs.tabTextActive]}>Quét mã QR</Text>
              </TouchableOpacity>
            </View>

            {/* Tab: My QR */}
            {qrTab === 'myqr' && (
              <View style={qrs.myQRContent}>
                <Text style={qrs.userName}>{user?.name}</Text>
                <Text style={qrs.userSubtitle}>Quét mã để kết bạn với tôi</Text>
                <View style={qrs.qrWrapper}>
                  {qrValue ? (
                    <QRCode
                      value={qrValue}
                      size={200}
                      color="#0068FF"
                      backgroundColor="#fff"
                    />
                  ) : (
                    <ActivityIndicator color="#0068FF" />
                  )}
                </View>
                <TouchableOpacity style={qrs.shareBtn} onPress={handleShareQR}>
                  <Ionicons name="share-outline" size={18} color="#0068FF" />
                  <Text style={qrs.shareBtnText}>Chia sẻ mã QR</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tab: Scan QR */}
            {qrTab === 'scan' && (
              <View style={qrs.scanContent}>
                {!cameraPermission?.granted ? (
                  <View style={qrs.permissionBox}>
                    <Ionicons name="camera-off-outline" size={50} color="#ccc" />
                    <Text style={qrs.permissionText}>Cần quyền camera để quét mã QR</Text>
                    <TouchableOpacity style={qrs.permissionBtn} onPress={requestCameraPermission}>
                      <Text style={qrs.permissionBtnText}>Cấp quyền</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={qrs.scanHint}>Hướng camera vào mã QR của người bạn muốn kết bạn</Text>
                    <View style={qrs.cameraBox}>
                      <CameraView
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        onBarcodeScanned={qrScanned ? undefined : handleQRBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      />
                      {/* Corner decorations */}
                      <View style={[qrs.corner, qrs.cornerTL]} />
                      <View style={[qrs.corner, qrs.cornerTR]} />
                      <View style={[qrs.corner, qrs.cornerBL]} />
                      <View style={[qrs.corner, qrs.cornerBR]} />
                      {qrLoading && (
                        <View style={qrs.loadingOverlay}>
                          <ActivityIndicator size="large" color="#fff" />
                          <Text style={qrs.loadingText}>Đang tìm kiếm...</Text>
                        </View>
                      )}
                    </View>
                    {qrScanned && !qrLoading && (
                      <TouchableOpacity style={qrs.rescanBtn} onPress={() => {
                        qrScannedRef.current = false;
                        setQrScanned(false);
                      }}>
                        <Text style={qrs.rescanBtnText}>Quét lại</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Recall confirm */}
      <ConfirmDialog
        visible={!!recallTarget}
        title="Thu hồi lời mời"
        message={`Bạn có chắc muốn thu hồi lời mời kết bạn gửi đến ${recallTarget?.name}?`}
        danger
        onConfirm={handleCancelSent}
        onCancel={() => setRecallTarget(null)}
      />

      {/* Friend Action Menu (Bottom Sheet) */}
      {activeMenuFriend && (
        <Modal
          visible={!!activeMenuFriend}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveMenuFriend(null)}
        >
          <TouchableOpacity 
            style={s.menuOverlay} 
            activeOpacity={1} 
            onPress={() => setActiveMenuFriend(null)}
          >
            <View style={s.menuContent}>
              <View style={s.menuHeader}>
                <Image 
                  source={{ uri: activeMenuFriend.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeMenuFriend.userID}` }}
                  style={s.menuAvatar}
                />
                <Text style={s.menuTitle}>{activeMenuFriend.name}</Text>
              </View>
              
              <TouchableOpacity 
                style={s.menuItem} 
                onPress={() => {
                  handleStartChat(activeMenuFriend.userID);
                  setActiveMenuFriend(null);
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#0068ff" />
                <Text style={s.menuItemText}>Nhắn tin</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={s.menuItem} 
                onPress={() => {
                  setSelectedProfile({ ...activeMenuFriend, friendStatus: 'accepted' });
                  setActiveMenuFriend(null);
                }}
              >
                <MaterialIcons name="block" size={22} color="#6b7280" />
                <Text style={s.menuItemText}>Chặn bạn bè</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[s.menuItem, { borderBottomWidth: 0 }]} 
                onPress={() => {
                  setUnfriendTarget(activeMenuFriend);
                  setActiveMenuFriend(null);
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
                <Text style={[s.menuItemText, { color: '#ef4444' }]}>Xóa bạn bè</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={s.menuCancelBtn} 
                onPress={() => setActiveMenuFriend(null)}
              >
                <Text style={s.menuCancelText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Unfriend Confirm */}
      <ConfirmDialog
        visible={!!unfriendTarget}
        title="Xóa bạn bè"
        message={`Bạn có chắc muốn xóa ${unfriendTarget?.name} khỏi danh sách bạn bè?`}
        danger
        onConfirm={handleUnfriend}
        onCancel={() => setUnfriendTarget(null)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingRight: 12, paddingVertical: 4 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f3f4f6', margin: 12, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6, position: 'relative',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#0068ff' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 2, backgroundColor: '#0068ff', borderRadius: 2,
  },
  badge: {
    backgroundColor: '#ef4444', borderRadius: 10,
    paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 7,
  },
  sectionText: { fontSize: 12, fontWeight: '700', color: '#0068ff' },
  friendItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff',
  },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14.5, fontWeight: '600', color: '#111' },
  friendPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  chatBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
  },
  unblockText: { fontSize: 13, fontWeight: '600', color: '#0068ff' },
  requestItem: {
    flexDirection: 'row', padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6', gap: 12,
  },
  requestInfo: { flex: 1 },
  messageBubble: {
    backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1,
    borderColor: '#e5e7eb', padding: 8, marginVertical: 6,
  },
  messageText: { fontSize: 13, color: '#6b7280', fontStyle: 'italic' },
  sentLabel: { fontSize: 13, color: '#6b7280', marginTop: 2, marginBottom: 8 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnAccept: { flex: 1, backgroundColor: '#0068ff', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btnAcceptText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  btnReject: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btnRejectText: { color: '#374151', fontSize: 13, fontWeight: '600' },
  btnRecall: {
    backgroundColor: '#fef2f2', borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#fecaca',
  },
  btnRecallText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#6b7280' },

  // Action Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  menuHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 15,
  },
  menuItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  menuCancelBtn: {
    marginTop: 10,
    paddingVertical: 15,
    alignItems: 'center',
    borderTopWidth: 8,
    borderTopColor: '#f9fafb',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});

const { width: SCREEN_W } = Dimensions.get('window');

const qrs = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0068FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#0068FF',
  },
  // My QR tab
  myQRContent: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  userSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEF4FF',
    marginTop: 8,
  },
  shareBtnText: {
    color: '#0068FF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Scan tab
  scanContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  scanHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  cameraBox: {
    width: SCREEN_W - 40,
    height: SCREEN_W - 40,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#fff',
  },
  cornerTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
  },
  rescanBtn: {
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#0068FF',
    borderRadius: 10,
  },
  rescanBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Permission
  permissionBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  permissionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  permissionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0068FF',
    borderRadius: 10,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ContactsScreen;
