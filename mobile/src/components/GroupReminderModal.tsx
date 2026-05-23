import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, Alert, Platform, ActivityIndicator, Image, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';

export interface GRParticipant {
  userID: string;
  name: string;
  avatar?: string;
  status: 'joined' | 'declined' | 'pending';
}

export interface GroupReminder {
  reminderID: string;
  groupID: string;
  creatorID: string;
  title: string;
  datetime: string;
  repeat: 'none' | 'daily' | 'weekly';
  note?: string;
  participants: GRParticipant[];
  done: boolean;
}

const repeatOptions: { value: GroupReminder['repeat']; label: string }[] = [
  { value: 'none', label: 'Không lặp' },
  { value: 'daily', label: 'Hàng ngày' },
  { value: 'weekly', label: 'Hàng tuần' },
];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} lúc ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface Props {
  visible: boolean;
  groupID: string;
  userID: string;
  onClose: () => void;
  initialReminder?: GroupReminder;
}

const GroupReminderModal: React.FC<Props> = ({ visible, groupID, userID, onClose, initialReminder }) => {
  const [reminders, setReminders] = useState<GroupReminder[]>([]);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<GroupReminder | null>(initialReminder ?? null);

  // Form
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 30 * 60 * 1000));
  const [repeat, setRepeat] = useState<GroupReminder['repeat']>('none');
  const [note, setNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/group-reminders/${groupID}`);
      setReminders(res.data || []);
    } catch { /* silent */ }
  }, [groupID]);

  useEffect(() => {
    if (visible) fetchReminders();
  }, [visible, fetchReminders]);

  // Real-time
  useEffect(() => {
    if (!visible) return;
    const onCreated = (r: GroupReminder) => {
      if (r.groupID === groupID)
        setReminders(prev => prev.find(x => x.reminderID === r.reminderID) ? prev.map(x => x.reminderID === r.reminderID ? r : x) : [...prev, r]);
    };
    const onUpdated = (r: GroupReminder) => {
      if (r.groupID === groupID) {
        setReminders(prev => prev.map(x => x.reminderID === r.reminderID ? r : x));
        setDetail(prev => prev?.reminderID === r.reminderID ? r : prev);
      }
    };
    const onDeleted = ({ reminderID }: { reminderID: string }) => {
      setReminders(prev => prev.filter(x => x.reminderID !== reminderID));
      setDetail(prev => prev?.reminderID === reminderID ? null : prev);
    };
    socket.on('group_reminder_created', onCreated);
    socket.on('group_reminder_updated', onUpdated);
    socket.on('group_reminder_deleted', onDeleted);
    return () => {
      socket.off('group_reminder_created', onCreated);
      socket.off('group_reminder_updated', onUpdated);
      socket.off('group_reminder_deleted', onDeleted);
    };
  }, [visible, groupID]);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề'); return; }
    if (date <= new Date()) { Alert.alert('Lỗi', 'Thời gian phải ở tương lai'); return; }
    setLoading(true);
    try {
      socket.emit('create_group_reminder', {
        groupID, creatorID: userID,
        title: title.trim(),
        datetime: date.toISOString(),
        repeat, note: note.trim(),
      });
      setTitle(''); setDate(new Date(Date.now() + 30 * 60 * 1000));
      setRepeat('none'); setNote('');
      setTab('list');
      Alert.alert('Thành công', 'Đã tạo nhắc hẹn');
    } catch {
      Alert.alert('Lỗi', 'Không thể tạo nhắc hẹn');
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = (reminderID: string, status: 'joined' | 'declined') => {
    socket.emit('group_reminder_rsvp', { reminderID, userID, status });
  };

  const handleDelete = (r: GroupReminder) => {
    Alert.alert('Xóa nhắc hẹn', `Xóa "${r.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: () => socket.emit('delete_group_reminder', { reminderID: r.reminderID, userID }),
      },
    ]);
  };

  const upcoming = reminders.filter(r => !r.done && new Date(r.datetime) > new Date())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const past = reminders.filter(r => r.done || new Date(r.datetime) <= new Date())
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).slice(0, 5);

  // Detail view
  if (detail) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDetail(null)} />
          <View style={s.sheet}>
            <View style={s.header}>
              <TouchableOpacity onPress={() => setDetail(null)} style={s.backBtn}>
                <Ionicons name="arrow-back" size={20} color="#0068ff" />
              </TouchableOpacity>
              <Text style={s.headerTitle}>Chi tiết nhắc hẹn</Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.body}>
              <View style={s.detailCard}>
                <Text style={s.detailTitle}>{detail.title}</Text>
                <Text style={s.detailDate}>🕐 {formatDate(detail.datetime)}</Text>
                {detail.repeat !== 'none' && (
                  <View style={s.badge}><Text style={s.badgeText}>{detail.repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}</Text></View>
                )}
                {detail.note ? <Text style={s.detailNote}>{detail.note}</Text> : null}
              </View>

              {/* RSVP */}
              {new Date(detail.datetime) > new Date() && (
                <View style={s.rsvpRow}>
                  {(['joined', 'declined'] as const).map(status => {
                    const myStatus = detail.participants.find(p => p.userID === userID)?.status || 'pending';
                    const isActive = myStatus === status;
                    return (
                      <TouchableOpacity key={status} style={[s.rsvpBtn, isActive && (status === 'joined' ? s.rsvpJoinedActive : s.rsvpDeclinedActive)]}
                        onPress={() => handleRSVP(detail.reminderID, status)}>
                        <Text style={[s.rsvpBtnText, isActive && s.rsvpBtnTextActive]}>
                          {status === 'joined' ? (isActive ? '✓ Đã tham gia' : 'Tham gia') : (isActive ? '✗ Đã từ chối' : 'Từ chối')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Participants */}
              {[
                { key: 'joined', label: 'Tham gia', color: '#16a34a', items: detail.participants.filter(p => p.status === 'joined') },
                { key: 'declined', label: 'Từ chối', color: '#ef4444', items: detail.participants.filter(p => p.status === 'declined') },
                { key: 'pending', label: 'Chưa xác nhận', color: '#888', items: detail.participants.filter(p => p.status === 'pending') },
              ].map(section => (
                <View key={section.key} style={s.section}>
                  <Text style={[s.sectionLabel, { color: section.color }]}>{section.label} ({section.items.length})</Text>
                  {section.items.map(p => (
                    <View key={p.userID} style={s.participantRow}>
                      {p.avatar
                        ? <Image source={{ uri: p.avatar }} style={s.avatar} />
                        : <View style={s.avatarPlaceholder}><Ionicons name="person" size={14} color="#aaa" /></View>
                      }
                      <Text style={s.participantName}>{p.name}{p.userID === userID ? ' (bạn)' : ''}</Text>
                    </View>
                  ))}
                  {section.items.length === 0 && <Text style={s.emptyText}>Chưa có ai</Text>}
                </View>
              ))}

              {/* Delete */}
              <TouchableOpacity style={s.deleteFullBtn} onPress={() => { handleDelete(detail); setDetail(null); }}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={s.deleteFullBtnText}>Xóa nhắc hẹn</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={s.headerIcon}><Ionicons name="notifications" size={18} color="#0068ff" /></View>
            <Text style={s.headerTitle}>Nhắc hẹn nhóm</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={20} color="#666" /></TouchableOpacity>
          </View>

          <View style={s.tabs}>
            {(['list', 'create'] as const).map(t => (
              <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === 'list' ? `Danh sách${reminders.length ? ` (${reminders.length})` : ''}` : '+ Tạo mới'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            {tab === 'create' && (
              <View style={s.form}>
                <Text style={s.label}>Tiêu đề</Text>
                <TextInput style={s.input} value={title} onChangeText={setTitle}
                  placeholder="Ví dụ: Họp nhóm, Sinh nhật..." placeholderTextColor="#aaa" maxLength={100} autoFocus />

                <Text style={s.label}>Thời gian</Text>
                <View style={s.dateRow}>
                  <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color="#0068ff" />
                    <Text style={s.dateBtnText}>{`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.dateBtn} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={16} color="#0068ff" />
                    <Text style={s.dateBtnText}>{`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}</Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <Modal transparent animationType="fade" visible={showDatePicker}>
                    <View style={s.pickerOverlay}>
                      <View style={s.pickerBox}>
                        <DateTimePicker value={date} mode="date" minimumDate={new Date()}
                          display="spinner" textColor="#111"
                          onChange={(_, d) => { if (d) setDate(d); }} />
                        <TouchableOpacity style={s.pickerDone} onPress={() => setShowDatePicker(false)}>
                          <Text style={s.pickerDoneText}>Xong</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                )}
                {showTimePicker && (
                  <Modal transparent animationType="fade" visible={showTimePicker}>
                    <View style={s.pickerOverlay}>
                      <View style={s.pickerBox}>
                        <DateTimePicker value={date} mode="time"
                          display="spinner" textColor="#111"
                          onChange={(_, d) => { if (d) setDate(d); }} />
                        <TouchableOpacity style={s.pickerDone} onPress={() => setShowTimePicker(false)}>
                          <Text style={s.pickerDoneText}>Xong</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                )}

                <Text style={s.label}>Lặp lại</Text>
                <View style={s.repeatRow}>
                  {repeatOptions.map(r => (
                    <TouchableOpacity key={r.value} style={[s.repeatBtn, repeat === r.value && s.repeatBtnActive]} onPress={() => setRepeat(r.value)}>
                      <Text style={[s.repeatBtnText, repeat === r.value && s.repeatBtnTextActive]}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.label}>Ghi chú (tùy chọn)</Text>
                <TextInput style={[s.input, { minHeight: 60 }]} value={note} onChangeText={setNote}
                  placeholder="Thêm ghi chú..." placeholderTextColor="#aaa" multiline maxLength={300} />

                <TouchableOpacity style={[s.createBtn, loading && s.createBtnDisabled]} onPress={handleCreate} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.createBtnText}>Tạo nhắc hẹn</Text>}
                </TouchableOpacity>
              </View>
            )}

            {tab === 'list' && (
              <View style={s.listContainer}>
                {upcoming.length === 0 && past.length === 0 && (
                  <View style={s.empty}>
                    <Ionicons name="notifications-outline" size={48} color="#ddd" />
                    <Text style={s.emptyText}>Chưa có nhắc hẹn nào</Text>
                    <TouchableOpacity onPress={() => setTab('create')}>
                      <Text style={s.emptyLink}>Tạo nhắc hẹn đầu tiên →</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {upcoming.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>SẮP TỚI</Text>
                    {upcoming.map(r => <GroupReminderItem key={r.reminderID} reminder={r} userID={userID} onPress={() => setDetail(r)} onRSVP={handleRSVP} onDelete={() => handleDelete(r)} />)}
                  </>
                )}
                {past.length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { marginTop: 12 }]}>ĐÃ QUA</Text>
                    {past.map(r => <GroupReminderItem key={r.reminderID} reminder={r} userID={userID} isPast onPress={() => setDetail(r)} onRSVP={handleRSVP} onDelete={() => handleDelete(r)} />)}
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const GroupReminderItem = ({ reminder, userID, isPast, onPress, onRSVP, onDelete }: {
  reminder: GroupReminder; userID: string; isPast?: boolean;
  onPress: () => void; onRSVP: (id: string, s: 'joined' | 'declined') => void; onDelete: () => void;
}) => {
  const myStatus = reminder.participants.find(p => p.userID === userID)?.status || 'pending';
  const joined = reminder.participants.filter(p => p.status === 'joined').length;
  const declined = reminder.participants.filter(p => p.status === 'declined').length;
  return (
    <TouchableOpacity style={[s.item, isPast && s.itemPast]} onPress={onPress}>
      <View style={s.itemIcon}><Ionicons name="notifications" size={16} color={isPast ? '#aaa' : '#0068ff'} /></View>
      <View style={s.itemInfo}>
        <Text style={[s.itemTitle, isPast && s.itemTitlePast]} numberOfLines={1}>{reminder.title}</Text>
        <Text style={s.itemDate}>{formatDate(reminder.datetime)}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <Text style={s.statText}>✓ {joined}</Text>
          <Text style={[s.statText, { color: '#ef4444' }]}>✗ {declined}</Text>
        </View>
        {!isPast && (
          <View style={s.rsvpMiniRow}>
            <TouchableOpacity style={[s.rsvpMiniBtn, myStatus === 'joined' && s.rsvpMiniJoined]}
              onPress={() => onRSVP(reminder.reminderID, 'joined')}>
              <Text style={[s.rsvpMiniBtnText, myStatus === 'joined' && { color: '#fff' }]}>Tham gia</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.rsvpMiniBtn, myStatus === 'declined' && s.rsvpMiniDeclined]}
              onPress={() => onRSVP(reminder.reminderID, 'declined')}>
              <Text style={[s.rsvpMiniBtnText, myStatus === 'declined' && { color: '#fff' }]}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111' },
  backBtn: { padding: 4, marginRight: 4 },
  closeBtn: { padding: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0068ff' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#0068ff', fontWeight: '700' },
  body: { maxHeight: 520 },
  form: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111', backgroundColor: '#fafafa' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa' },
  dateBtnText: { fontSize: 14, color: '#111', fontWeight: '500' },
  repeatRow: { flexDirection: 'row', gap: 8 },
  repeatBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  repeatBtnActive: { borderColor: '#0068ff', backgroundColor: '#0068ff' },
  repeatBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  repeatBtnTextActive: { color: '#fff' },
  createBtn: { marginTop: 20, backgroundColor: '#0068ff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listContainer: { padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#aaa' },
  emptyLink: { fontSize: 14, color: '#0068ff', fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  itemPast: { opacity: 0.5 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  itemTitlePast: { textDecorationLine: 'line-through', color: '#aaa' },
  itemDate: { fontSize: 12, color: '#888', marginTop: 2 },
  statText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  rsvpMiniRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rsvpMiniBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center' },
  rsvpMiniJoined: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  rsvpMiniDeclined: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  rsvpMiniBtnText: { fontSize: 12, fontWeight: '600', color: '#555' },
  deleteBtn: { padding: 6 },
  // Detail view
  detailCard: { margin: 16, backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, gap: 8 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#111', textAlign: 'center' },
  detailDate: { fontSize: 13, color: '#555', textAlign: 'center' },
  detailNote: { fontSize: 13, color: '#555', backgroundColor: '#fff', borderRadius: 10, padding: 10, marginTop: 4 },
  badge: { alignSelf: 'center', backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, color: '#0068ff', fontWeight: '600' },
  rsvpRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 16 },
  rsvpBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  rsvpJoinedActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  rsvpDeclinedActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  rsvpBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  rsvpBtnTextActive: { color: '#fff' },
  section: { marginHorizontal: 16, marginBottom: 12 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarPlaceholder: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  participantName: { fontSize: 14, color: '#333' },
  deleteFullBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 14, borderRadius: 14, backgroundColor: '#fef2f2', justifyContent: 'center' },
  deleteFullBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 20 },
  pickerDone: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  pickerDoneText: { fontSize: 16, fontWeight: '700', color: '#0068ff' },
});

export default GroupReminderModal;
