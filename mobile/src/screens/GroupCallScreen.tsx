import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  FlatList, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import socket from '../utils/socket';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupMember {
  userID: string;
  name: string;
  avatar?: string;
}

interface Participant {
  userID: string;
  name: string;
  avatar?: string;
  status: 'ringing' | 'connected' | 'rejected' | 'left';
}

interface Props {
  visible: boolean;
  groupID: string;
  groupName: string;
  groupAvatar?: string;
  currentUser: { userID: string; name: string; anhDaiDien?: string };
  // Caller mode: truyền members để chọn
  members?: GroupMember[];
  // Callee mode: truyền isCallee=true
  isCallee?: boolean;
  initialParticipants?: { userID: string; name: string; avatar?: string }[];
  onClose: () => void;
}

// ── ParticipantTile ───────────────────────────────────────────────────────────

const TILE_SIZE = (SCREEN_W - 48) / 2;

const ParticipantTile = ({ participant, isLocal }: { participant: Participant; isLocal?: boolean }) => {
  const avatarUri = participant.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.name}`;
  return (
    <View style={[styles.tile, { width: TILE_SIZE, height: TILE_SIZE }]}>
      <Image source={{ uri: avatarUri }} style={styles.tileAvatar} />
      {participant.status === 'ringing' && (
        <Text style={styles.tileRinging}>Đang đổ chuông...</Text>
      )}
      {participant.status === 'rejected' && (
        <Text style={styles.tileRejected}>Đã từ chối</Text>
      )}
      {participant.status === 'left' && (
        <Text style={styles.tileLeft}>Đã rời</Text>
      )}
      <View style={styles.tileNameBar}>
        <Text style={styles.tileName} numberOfLines={1}>{isLocal ? 'Bạn' : participant.name}</Text>
      </View>
    </View>
  );
};

// ── Select Members Screen ─────────────────────────────────────────────────────

const SelectMembersScreen = ({
  members, onCall, onCancel,
}: { members: GroupMember[]; onCall: (selected: GroupMember[]) => void; onCancel: () => void }) => {
  const [selected, setSelected] = useState<GroupMember[]>([]);

  const toggle = (m: GroupMember) => {
    setSelected(prev =>
      prev.find(s => s.userID === m.userID)
        ? prev.filter(s => s.userID !== m.userID)
        : [...prev, m]
    );
  };

  return (
    <View style={styles.selectContainer}>
      <View style={styles.selectHeader}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.selectTitle}>Tạo cuộc gọi</Text>
        <TouchableOpacity
          onPress={() => selected.length > 0 && onCall(selected)}
          disabled={selected.length === 0}
        >
          <Text style={[styles.selectCallBtn, selected.length === 0 && { opacity: 0.4 }]}>
            Gọi ({selected.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={m => m.userID}
        renderItem={({ item }) => {
          const isSel = selected.some(s => s.userID === item.userID);
          return (
            <TouchableOpacity style={styles.memberRow} onPress={() => toggle(item)}>
              <View style={[styles.checkbox, isSel && styles.checkboxSelected]}>
                {isSel && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Image
                source={{ uri: item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.name}` }}
                style={styles.memberAvatar}
              />
              <Text style={styles.memberName}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {selected.length > 0 && (
        <View style={styles.selectedBar}>
          <Text style={styles.selectedBarText}>Đã chọn: {selected.map(s => s.name).join(', ')}</Text>
        </View>
      )}
    </View>
  );
};

// ── Main GroupCallScreen ──────────────────────────────────────────────────────

const GroupCallScreen = ({
  visible, groupID, groupName, groupAvatar,
  currentUser, members = [], isCallee = false,
  initialParticipants = [], onClose,
}: Props) => {
  const [screen, setScreen] = useState<'select' | 'calling' | 'in-call'>(
    isCallee ? 'in-call' : 'select'
  );
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [endedMsg, setEndedMsg] = useState<string | null>(null);

  const isActiveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartedRef = useRef(false);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startTimer = useCallback(() => {
    if (callStartedRef.current) return;
    callStartedRef.current = true;
    timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
  }, []);

  const doCleanup = useCallback(() => {
    isActiveRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    socket.off('group-call-user-joined');
    socket.off('group-call-offer');
    socket.off('group-call-answer');
    socket.off('group-call-ice');
    socket.off('group-call-user-rejected');
    socket.off('group-call-user-left');
    socket.off('group-call-ended');
    socket.off('group-call-session-info');
  }, []);

  const leaveCall = useCallback(() => {
    socket.emit('group-call-leave', { groupID, userID: currentUser.userID });
    doCleanup();
    onClose();
  }, [groupID, currentUser.userID, doCleanup, onClose]);

  const setupListeners = useCallback(() => {
    socket.off('group-call-user-joined');
    socket.off('group-call-offer');
    socket.off('group-call-answer');
    socket.off('group-call-ice');
    socket.off('group-call-user-rejected');
    socket.off('group-call-user-left');
    socket.off('group-call-ended');
    socket.off('group-call-session-info');

    socket.on('group-call-user-joined', (data: { groupID: string; userID: string; userInfo: { name: string; avatar?: string } }) => {
      if (!isActiveRef.current || data.groupID !== groupID) return;
      startTimer();
      setScreen('in-call');
      setParticipants(prev => {
        const exists = prev.find(p => p.userID === data.userID);
        if (exists) return prev.map(p => p.userID === data.userID ? { ...p, status: 'connected' as const } : p);
        return [...prev, { userID: data.userID, name: data.userInfo.name, avatar: data.userInfo.avatar, status: 'connected' as const }];
      });
    });

    socket.on('group-call-user-rejected', (data: { groupID: string; userID: string }) => {
      if (data.groupID !== groupID) return;
      setParticipants(prev => prev.map(p => p.userID === data.userID ? { ...p, status: 'rejected' as const } : p));
    });

    socket.on('group-call-user-left', (data: { groupID: string; userID: string }) => {
      if (data.groupID !== groupID) return;
      setParticipants(prev => prev.map(p => p.userID === data.userID ? { ...p, status: 'left' as const } : p));
    });

    socket.on('group-call-ended', (data: { groupID: string; reason?: string }) => {
      if (data.groupID !== groupID) return;
      doCleanup();
      setEndedMsg(data.reason || 'Cuộc gọi đã kết thúc');
      setTimeout(() => onClose(), 2000);
    });

    socket.on('group-call-session-info', (data: { groupID: string; participants: { userID: string; name: string; avatar?: string }[]; ringing: { userID: string; name: string; avatar?: string }[] }) => {
      if (!isActiveRef.current || data.groupID !== groupID) return;
      setParticipants(prev => {
        const existing = new Set(prev.map(p => p.userID));
        const updated = prev.map(p => {
          if (data.participants.find(ip => ip.userID === p.userID)) return { ...p, status: 'connected' as const };
          return p;
        });
        const newPs = [...data.participants, ...data.ringing]
          .filter(p => !existing.has(p.userID))
          .map(p => ({
            userID: p.userID, name: p.name, avatar: p.avatar,
            status: data.participants.find(ip => ip.userID === p.userID) ? 'connected' as const : 'ringing' as const,
          }));
        return [...updated, ...newPs];
      });
    });
  }, [groupID, startTimer, doCleanup, onClose]);

  const startCall = useCallback((selected: GroupMember[]) => {
    const localP: Participant = {
      userID: currentUser.userID, name: currentUser.name,
      avatar: currentUser.anhDaiDien, status: 'connected',
    };
    const invitedPs: Participant[] = selected.map(m => ({
      userID: m.userID, name: m.name, avatar: m.avatar, status: 'ringing',
    }));
    setParticipants([localP, ...invitedPs]);
    setScreen('calling');
    setupListeners();

    socket.emit('group-call-start', {
      groupID,
      callerID: currentUser.userID,
      callerInfo: { name: currentUser.name, avatar: currentUser.anhDaiDien },
      invitedUserIDs: selected.map(m => m.userID),
      invitedUserInfos: selected.map(m => ({ userID: m.userID, name: m.name, avatar: m.avatar })),
      groupName,
    });
  }, [currentUser, groupID, groupName, setupListeners]);

  const acceptCall = useCallback(() => {
    const otherTiles: Participant[] = initialParticipants
      .filter(p => p.userID !== currentUser.userID)
      .map(p => ({ userID: p.userID, name: p.name, avatar: p.avatar, status: 'ringing' as const }));

    setParticipants([
      { userID: currentUser.userID, name: currentUser.name, avatar: currentUser.anhDaiDien, status: 'connected' },
      ...otherTiles,
    ]);

    setupListeners();
    startTimer();

    socket.emit('group-call-accept', {
      groupID,
      userID: currentUser.userID,
      userInfo: { name: currentUser.name, avatar: currentUser.anhDaiDien },
    });
  }, [currentUser, groupID, initialParticipants, setupListeners, startTimer]);

  useEffect(() => {
    if (!visible) return;
    isActiveRef.current = true;
    callStartedRef.current = false;

    if (isCallee) {
      acceptCall();
    }

    return () => { doCleanup(); };
  }, [visible]);

  if (!visible) return null;

  // Screen 1: Chọn thành viên
  if (screen === 'select') {
    return (
      <Modal visible animationType="slide" statusBarTranslucent>
        <SelectMembersScreen
          members={members.filter(m => m.userID !== currentUser.userID)}
          onCall={startCall}
          onCancel={onClose}
        />
      </Modal>
    );
  }

  // Screen 2 & 3: Calling / In-call
  const connectedCount = participants.filter(p => p.status === 'connected').length;
  const ringingCount = participants.filter(p => p.status === 'ringing').length;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.callContainer}>
        {/* Header */}
        <View style={styles.callHeader}>
          <View style={styles.callHeaderLeft}>
            {groupAvatar ? (
              <Image source={{ uri: groupAvatar }} style={styles.groupAvatar} />
            ) : (
              <View style={styles.groupAvatarPlaceholder}>
                <Ionicons name="people" size={18} color="#fff" />
              </View>
            )}
            <View>
              <Text style={styles.groupName}>{groupName}</Text>
              <Text style={styles.callSubtitle}>
                {screen === 'calling'
                  ? `Đang gọi ${ringingCount} người...`
                  : `${connectedCount} người • ${fmt(callDuration)}`}
              </Text>
            </View>
          </View>
          <View style={styles.timerBadge}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{fmt(callDuration)}</Text>
          </View>
        </View>

        {/* Participant grid */}
        <FlatList
          data={participants}
          keyExtractor={p => p.userID}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <ParticipantTile participant={item} isLocal={item.userID === currentUser.userID} />
          )}
        />

        {/* Ended overlay */}
        {endedMsg && (
          <View style={styles.endedOverlay}>
            <Ionicons name="call" size={40} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.endedText}>{endedMsg}</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]}
            onPress={() => setIsMuted(m => !m)}
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
            <Text style={styles.ctrlLabel}>{isMuted ? 'Bật mic' : 'Tắt mic'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.hangupBtn} onPress={leaveCall}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Select screen
  selectContainer: { flex: 1, backgroundColor: '#fff' },
  selectHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  selectTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  selectCallBtn: { fontSize: 15, fontWeight: '700', color: '#0068ff' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, gap: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#ccc', alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#0068ff', borderColor: '#0068ff' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22 },
  memberName: { fontSize: 15, fontWeight: '500', color: '#111', flex: 1 },
  selectedBar: {
    backgroundColor: '#f0f7ff', paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#bfdbfe',
  },
  selectedBarText: { fontSize: 13, color: '#0068ff' },

  // Call screen
  callContainer: { flex: 1, backgroundColor: '#0f172a' },
  callHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#1e293b',
  },
  callHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvatar: { width: 36, height: 36, borderRadius: 18 },
  groupAvatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0068ff', alignItems: 'center', justifyContent: 'center',
  },
  groupName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  callSubtitle: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  timerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  timerText: { color: '#4ade80', fontSize: 13, fontWeight: '700' },

  // Grid
  grid: { padding: 16, gap: 12 },
  tile: {
    backgroundColor: '#1e293b', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  tileAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  tileRinging: { color: '#94a3b8', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  tileRejected: { color: '#f87171', fontSize: 11, marginTop: 8 },
  tileLeft: { color: '#64748b', fontSize: 11, marginTop: 8 },
  tileNameBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 4, paddingHorizontal: 8,
  },
  tileName: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Ended overlay
  endedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  endedText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 40, paddingVertical: 28, backgroundColor: '#1e293b',
  },
  ctrlBtn: {
    alignItems: 'center', gap: 6,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center',
  },
  ctrlBtnActive: { backgroundColor: 'rgba(0,104,255,0.5)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, position: 'absolute', bottom: -18 },
  hangupBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
});

export default GroupCallScreen;
