import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import OtherProfileModal, { OtherUser } from './OtherProfileModal';

interface Member {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface PollOption {
  text: string;
  voters: string[];
}

interface Props {
  visible: boolean;
  poll: {
    question: string;
    options: PollOption[];
    isAnonymous?: boolean;
  };
  members: Member[];
  userID: string;
  currentUser: { userID: string; name: string } | null;
  onClose: () => void;
}

const PollVotersModal = ({ visible, poll, members, userID, currentUser, onClose }: Props) => {
  const [viewingUser, setViewingUser] = useState<OtherUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<string | null>(null);

  const getMember = (vid: string) => members.find(m => m.userID === vid);

  const handleViewProfile = async (targetUserID: string) => {
    setLoadingProfile(targetUserID);
    try {
      const token = await AsyncStorage.getItem('token');
      const isSelf = targetUserID === userID;
      const memberInfo = getMember(targetUserID);

      const [userRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/usersID`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userID: targetUserID }),
        }),
        isSelf
          ? Promise.resolve({ json: async () => ({ friendStatus: 'self' }) })
          : fetch(`${API_URL}/api/contacts/friend-status/${targetUserID}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
      ]);
      const userData = await userRes.json();
      const statusData = await statusRes.json();
      setViewingUser({
        userID: targetUserID,
        name: userData.name || memberInfo?.name || targetUserID,
        sdt: userData.sdt,
        anhDaiDien: userData.anhDaiDien || memberInfo?.anhDaiDien,
        anhBia: userData.anhBia,
        ngaysinh: userData.ngaysinh,
        gioTinh: userData.gioTinh,
        trangThai: userData.trangThai,
        friendStatus: isSelf ? 'self' : (statusData.friendStatus || 'none'),
      });
    } catch {
      // Fallback: dùng thông tin từ members local
      const memberInfo = getMember(targetUserID);
      if (memberInfo) {
        setViewingUser({
          userID: targetUserID,
          name: memberInfo.name,
          anhDaiDien: memberInfo.anhDaiDien,
          friendStatus: targetUserID === userID ? 'self' : 'none',
        });
      }
    } finally {
      setLoadingProfile(null);
    }
  };

  const hasAnyVoters = poll.options.some(o => (o.voters?.length || 0) > 0);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity style={s.iconBtn} onPress={onClose}>
                <Ionicons name="chevron-back" size={22} color="#333" />
              </TouchableOpacity>
              <Text style={s.title}>Chi tiết bình chọn</Text>
              <TouchableOpacity style={s.iconBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
              {!hasAnyVoters ? (
                <Text style={s.emptyText}>Chưa có ai bình chọn</Text>
              ) : (
                poll.options.map((option, idx) => {
                  const voteCount = option.voters?.length || 0;
                  if (voteCount === 0) return null;
                  return (
                    <View key={idx} style={s.optionSection}>
                      <Text style={s.optionLabel}>
                        {option.text}{' '}
                        <Text style={s.optionCount}>({voteCount})</Text>
                      </Text>

                      {poll.isAnonymous ? (
                        <Text style={s.anonymousText}>{voteCount} người đã bình chọn (ẩn danh)</Text>
                      ) : (
                        option.voters.map((vid) => {
                          const m = getMember(vid);
                          const name = m?.name || vid;
                          const avatar = m?.anhDaiDien;
                          const isMe = vid === userID;
                          const isLoading = loadingProfile === vid;
                          return (
                            <TouchableOpacity
                              key={vid}
                              style={s.voterRow}
                              onPress={() => handleViewProfile(vid)}
                              disabled={isLoading}
                            >
                              {avatar ? (
                                <Image source={{ uri: avatar }} style={s.avatar} />
                              ) : (
                                <View style={[s.avatar, s.avatarFallback]}>
                                  <Text style={s.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                                </View>
                              )}
                              <Text style={[s.voterName, isMe && s.voterNameMe]}>
                                {name}{isMe ? ' (bạn)' : ''}
                              </Text>
                              {isLoading && <ActivityIndicator size="small" color="#0068ff" style={{ marginLeft: 8 }} />}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  );
                })
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {viewingUser && (
        <OtherProfileModal
          visible={!!viewingUser}
          user={viewingUser}
          currentUser={currentUser}
          onClose={() => setViewingUser(null)}
        />
      )}
    </>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 14,
    marginTop: 32,
  },
  optionSection: {
    marginBottom: 20,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  optionCount: {
    fontWeight: '400',
    color: '#666',
  },
  anonymousText: {
    fontSize: 13,
    color: '#aaa',
    fontStyle: 'italic',
    paddingLeft: 4,
  },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4f46e5',
  },
  voterName: {
    fontSize: 14,
    color: '#111',
    flex: 1,
  },
  voterNameMe: {
    color: '#0068ff',
    fontWeight: '600',
  },
});

export default PollVotersModal;
