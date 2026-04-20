import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  callerInfo: { name: string; avatar?: string };
  groupName: string;
  invitedNames: string[]; // tên những người khác được mời
  onAccept: () => void;
  onReject: () => void;
}

const GroupIncomingCallModal = ({ visible, callerInfo, groupName, invitedNames, onAccept, onReject }: Props) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!visible) { setTimeLeft(30); return; }

    const vibPattern = [0, 500, 300, 500];
    const vibInterval = setInterval(() => Vibration.vibrate(vibPattern), 1400);

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); onReject(); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(vibInterval);
      Vibration.cancel();
    };
  }, [visible]);

  const othersText = invitedNames.length > 0
    ? invitedNames.slice(0, 3).join(', ') + (invitedNames.length > 3 ? ` và ${invitedNames.length - 3} người khác` : '')
    : groupName;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Avatar caller */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarRing} />
            <Image
              source={{ uri: callerInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerInfo.name}` }}
              style={styles.avatar}
            />
          </View>

          {/* Names */}
          <Text style={styles.othersText} numberOfLines={2}>{othersText}</Text>
          <Text style={styles.inviteText}>
            <Text style={styles.callerName}>{callerInfo.name}</Text>
            {' '}mời bạn vào cuộc gọi nhóm
          </Text>

          <Text style={styles.timer}>Tự động từ chối sau {timeLeft}s</Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            <View style={styles.btnGroup}>
              <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Từ chối</Text>
            </View>

            <View style={styles.btnGroup}>
              <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
                <Ionicons name="videocam" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.btnLabel}>Tham gia</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1558b0',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 32, paddingBottom: 48, paddingHorizontal: 24,
    alignItems: 'center', gap: 10,
  },
  avatarWrapper: { position: 'relative', marginBottom: 4 },
  avatarRing: {
    position: 'absolute', inset: -6,
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)',
  },
  othersText: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    textAlign: 'center', marginTop: 8,
  },
  inviteText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  callerName: { fontWeight: '700', color: '#fff' },
  timer: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  buttons: { flexDirection: 'row', gap: 56, marginTop: 20 },
  btnGroup: { alignItems: 'center', gap: 8 },
  rejectBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  acceptBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  btnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
});

export default GroupIncomingCallModal;
