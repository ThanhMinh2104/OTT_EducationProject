import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  callerInfo: { name: string; avatar?: string | null; userID: string };
  callType: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal = ({ visible, callerInfo, callType, onAccept, onReject }: Props) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!visible) { setTimeLeft(30); return; }

    // Rung điện thoại
    const vibPattern = [0, 500, 300, 500];
    const vibInterval = setInterval(() => Vibration.vibrate(vibPattern), 1400);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject(); // timeout = reject
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(vibInterval);
      Vibration.cancel();
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Caller info */}
          <Text style={styles.callTypeLabel}>
            {callType === 'video' ? '📹 Cuộc gọi video đến' : '📞 Cuộc gọi thoại đến'}
          </Text>

          <Image
            source={{
              uri: callerInfo.avatar ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerInfo.userID}`,
            }}
            style={styles.avatar}
          />
          <Text style={styles.callerName}>{callerInfo.name}</Text>
          <Text style={styles.timer}>Tự động từ chối sau {timeLeft}s</Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>Từ chối</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Ionicons name={callType === 'video' ? 'videocam' : 'call'} size={28} color="#fff" />
              <Text style={styles.btnLabel}>Chấp nhận</Text>
            </TouchableOpacity>
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
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 32, paddingBottom: 48, paddingHorizontal: 24,
    alignItems: 'center',
  },
  callTypeLabel: { color: '#aaa', fontSize: 14, marginBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 14, borderWidth: 3, borderColor: '#0068ff' },
  callerName: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  timer: { color: '#888', fontSize: 13, marginBottom: 36 },
  buttons: { flexDirection: 'row', gap: 48 },
  rejectBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center',
  },
  btnLabel: { color: '#fff', fontSize: 12, marginTop: 6, position: 'absolute', bottom: -22 },
});

export default IncomingCallModal;
