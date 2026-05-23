import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, Alert, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';

export interface Reminder {
  reminderID: string;
  chatID: string;
  userID: string;
  title: string;
  datetime: string;
  repeat: 'none' | 'daily' | 'weekly';
  done: boolean;
}

const repeatOptions: { value: Reminder['repeat']; label: string }[] = [
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
  chatID: string;
  userID: string;
  userName: string;
  onClose: () => void;
}

const ReminderModal: React.FC<Props> = ({ visible, chatID, userID, userName, onClose }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 30 * 60 * 1000));
  const [repeat, setRepeat] = useState<Reminder['repeat']>('none');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/reminders/chat/${chatID}`);
      setReminders(res.data || []);
    } catch { /* silent */ }
  }, [chatID]);

  useEffect(() => {
    if (visible) fetchReminders();
  }, [visible, fetchReminders]);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề'); return; }
    if (date <= new Date()) { Alert.alert('Lỗi', 'Thời gian phải ở tương lai'); return; }

    setLoading(true);
    try {
      const reminderID = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const res = await axiosInstance.post('/reminders', {
        reminderID, chatID, userID, userName,
        title: title.trim(),
        datetime: date.toISOString(),
        repeat,
      });
      // Emit socket để chat partner thấy
      socket.emit('reminder_event', {
        chatID,
        eventID: res.data.event?.eventID,
        type: 'created',
        reminderID,
        reminderData: { title: title.trim(), datetime: date.toISOString(), repeat },
        userName,
        userID,
      });
      setReminders((prev) => [...prev, res.data.reminder]);
      setTitle(''); setDate(new Date(Date.now() + 30 * 60 * 1000)); setRepeat('none');
      setTab('list');
      Alert.alert('Thành công', 'Đã tạo nhắc hẹn');
    } catch {
      Alert.alert('Lỗi', 'Không thể tạo nhắc hẹn');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (r: Reminder) => {
    Alert.alert('Xóa nhắc hẹn', `Xóa "${r.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await axiosInstance.delete(`/reminders/${r.reminderID}`, {
              data: { userID, userName, chatID },
            });
            setReminders((prev) => prev.filter((x) => x.reminderID !== r.reminderID));
          } catch { Alert.alert('Lỗi', 'Không thể xóa'); }
        },
      },
    ]);
  };

  const upcoming = reminders.filter((r) => !r.done && new Date(r.datetime) > new Date())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const past = reminders.filter((r) => r.done || new Date(r.datetime) <= new Date())
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, 5);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Ionicons name="notifications" size={18} color="#0068ff" />
            </View>
            <Text style={s.headerTitle}>Nhắc hẹn</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabs}>
            <TouchableOpacity style={[s.tab, tab === 'list' && s.tabActive]} onPress={() => setTab('list')}>
              <Text style={[s.tabText, tab === 'list' && s.tabTextActive]}>
                Danh sách{reminders.length ? ` (${reminders.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, tab === 'create' && s.tabActive]} onPress={() => setTab('create')}>
              <Text style={[s.tabText, tab === 'create' && s.tabTextActive]}>+ Tạo mới</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
            {tab === 'create' && (
              <View style={s.form}>
                <Text style={s.label}>Tiêu đề</Text>
                <TextInput
                  style={s.input} value={title} onChangeText={setTitle}
                  placeholder="Ví dụ: Họp nhóm, Gọi điện..." placeholderTextColor="#aaa"
                  maxLength={100} autoFocus
                />

                <Text style={s.label}>Thời gian</Text>
                <View style={s.dateRow}>
                  <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={16} color="#0068ff" />
                    <Text style={s.dateBtnText}>
                      {`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.dateBtn} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={16} color="#0068ff" />
                    <Text style={s.dateBtnText}>
                      {`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`}
                    </Text>
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
                  {repeatOptions.map((r) => (
                    <TouchableOpacity key={r.value} style={[s.repeatBtn, repeat === r.value && s.repeatBtnActive]}
                      onPress={() => setRepeat(r.value)}>
                      <Text style={[s.repeatBtnText, repeat === r.value && s.repeatBtnTextActive]}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

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
                    {upcoming.map((r) => (
                      <ReminderItem key={r.reminderID} reminder={r} onDelete={() => handleDelete(r)} />
                    ))}
                  </>
                )}
                {past.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>ĐÃ QUA</Text>
                    {past.map((r) => (
                      <ReminderItem key={r.reminderID} reminder={r} onDelete={() => handleDelete(r)} isPast />
                    ))}
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

const ReminderItem = ({ reminder, onDelete, isPast }: { reminder: Reminder; onDelete: () => void; isPast?: boolean }) => (
  <View style={[s.item, isPast && s.itemPast]}>
    <View style={s.itemIcon}>
      <Ionicons name="notifications" size={16} color={isPast ? '#aaa' : '#0068ff'} />
    </View>
    <View style={s.itemInfo}>
      <Text style={[s.itemTitle, isPast && s.itemTitlePast]} numberOfLines={1}>{reminder.title}</Text>
      <Text style={s.itemDate}>{formatDate(reminder.datetime)}</Text>
      {reminder.repeat !== 'none' && (
        <View style={s.repeatBadge}>
          <Text style={s.repeatBadgeText}>{reminder.repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}</Text>
        </View>
      )}
    </View>
    <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
      <Ionicons name="trash-outline" size={18} color="#ef4444" />
    </TouchableOpacity>
  </View>
);

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111' },
  closeBtn: { padding: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0068ff' },
  tabText: { fontSize: 14, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#0068ff', fontWeight: '700' },
  body: { maxHeight: 500 },
  form: { padding: 16, gap: 4 },
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
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  itemPast: { opacity: 0.5 },
  itemIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  itemTitlePast: { textDecorationLine: 'line-through', color: '#aaa' },
  itemDate: { fontSize: 12, color: '#888', marginTop: 2 },
  repeatBadge: { marginTop: 4, backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  repeatBadgeText: { fontSize: 11, color: '#0068ff', fontWeight: '600' },
  deleteBtn: { padding: 6 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 20 },
  pickerDone: { alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  pickerDoneText: { fontSize: 16, fontWeight: '700', color: '#0068ff' },
});

export default ReminderModal;
