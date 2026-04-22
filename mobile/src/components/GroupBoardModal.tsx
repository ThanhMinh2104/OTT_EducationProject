import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import PollVotersModal from './PollVotersModal';

interface Message {
  messageID: string;
  groupID?: string;
  chatID?: string;
  senderID: string;
  content: string;
  type: string;
  media_url?: string[];
  timestamp: string;
  pinnedInfo?: {
    pinnedBy: string;
    pinnedAt: string;
  };
  senderInfo?: {
    name: string;
    avatar?: string;
  };
}

interface Note {
  noteID: string;
  groupID: string;
  creatorID: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
}

interface Reminder {
  reminderID: string;
  chatID: string;
  userID: string;
  title: string;
  datetime: Date;
  repeat: 'none' | 'daily' | 'weekly';
  done: boolean;
  createdAt: Date;
}

interface Poll {
  pollID: string;
  groupID: string;
  creatorID: string;
  question: string;
  options: Array<{
    text: string;
    voters: string[];
  }>;
  isMultipleChoice: boolean;
  endTime?: string;
  canAddOptions: boolean;
  isAnonymous: boolean;
  isActive: boolean;
  isPinned: boolean;
  pinnedAt?: string;
  createdAt: string;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
}

interface GroupBoardModalProps {
  visible: boolean;
  onClose: () => void;
  groupID: string;
  userID: string;
  onViewMessage?: (messageID: string) => void;
  canCreateNotes?: boolean;
  canCreatePolls?: boolean;
  initialTab?: TabType;
  initialPollID?: string | null;
  members?: Array<{ userID: string; name: string; anhDaiDien?: string }>;
  currentUser?: { userID: string; name: string } | null;
}

type TabType = 'all' | 'pinned' | 'notes' | 'polls' | 'reminders';
type ViewMode = 'list' | 'create-note' | 'view-note' | 'edit-note' | 'create-reminder' | 'edit-reminder' | 'create-poll';

export const GroupBoardModal: React.FC<GroupBoardModalProps> = ({
  visible,
  onClose,
  groupID,
  userID,
  onViewMessage,
  canCreateNotes = true,
  canCreatePolls = true,
  initialTab = 'all',
  initialPollID,
  members = [],
  currentUser = null,
}) => {

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPollMenu, setShowPollMenu] = useState(false);
  const [selectedPollForMenu, setSelectedPollForMenu] = useState<Poll | null>(null);
  const [showVotersForPoll, setShowVotersForPoll] = useState<Poll | null>(null);
  const pollListRef = React.useRef<FlatList>(null);

  useEffect(() => {
    if (visible && initialPollID && activeTab === 'polls' && polls.length > 0) {
      const index = polls.findIndex(p => p.pollID === initialPollID);
      if (index !== -1) {
        setTimeout(() => {
          pollListRef.current?.scrollToIndex({ index, animated: true });
        }, 500);
      }
    }
  }, [visible, initialPollID, activeTab, polls.length]);

  // Form states for note
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [notePinToTop, setNotePinToTop] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for reminder
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState(new Date());
  const [reminderRepeat, setReminderRepeat] = useState<'none' | 'daily' | 'weekly'>('none');

  // Form states for poll
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollShouldPin, setPollShouldPin] = useState(false);
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);
  const [pollHideResults, setPollHideResults] = useState(false);
  const [pollMultipleChoice, setPollMultipleChoice] = useState(true);
  const [pollCanAddOptions, setPollCanAddOptions] = useState(true);
  const [pollEndTime, setPollEndTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [endTimeDate, setEndTimeDate] = useState<Date | null>(null);

  // Reset to list view when modal closes
  useEffect(() => {
    if (!visible) {
      setViewMode('list');
      setActiveTab(initialTab);
      setSelectedNote(null);
      setNoteContent('');
      setNotePinToTop(false);
      setSelectedReminder(null);
      setReminderTitle('');
      setReminderDate(new Date());
      setReminderRepeat('none');
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollShouldPin(false);
      setPollIsAnonymous(false);
      setPollHideResults(false);
      setPollMultipleChoice(true);
      setPollCanAddOptions(true);
      setPollEndTime('');
      setShowDatePicker(false);
      setEndTimeDate(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    setActiveTab(initialTab);

    // Listen for socket events
    const handleNoteCreated = () => fetchNotes();
    const handleNoteUpdated = () => fetchNotes();
    const handleNoteDeleted = () => fetchNotes();
    const handleNotePinToggled = () => {
      fetchNotes();
      fetchPinnedMessages();
      if (viewMode === 'create-note' || viewMode === 'edit-note') {
        setViewMode('list');
        setSelectedNote(null);
        setNoteContent('');
        setNotePinToTop(false);
      }
    };

    const handlePollCreated = () => fetchPolls();
    const handlePollVoted = (data: any) => {
      if (data.groupID === groupID) fetchPolls();
    };

    socket.on('note_created', handleNoteCreated);
    socket.on('note_updated', handleNoteUpdated);
    socket.on('note_deleted', handleNoteDeleted);
    socket.on('note_pin_toggled', handleNotePinToggled);
    socket.on('poll_created', handlePollCreated);
    socket.on('poll_voted', handlePollVoted);

    return () => {
      socket.off('note_created', handleNoteCreated);
      socket.off('note_updated', handleNoteUpdated);
      socket.off('note_deleted', handleNoteDeleted);
      socket.off('note_pin_toggled', handleNotePinToggled);
      socket.off('poll_created', handlePollCreated);
      socket.off('poll_voted', handlePollVoted);
    };
  }, [visible, groupID]);

  // Fetch data khi tab thay đổi
  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      
      if (activeTab === 'all' || activeTab === 'pinned') {
        promises.push(fetchPinnedMessages());
      }
      if (activeTab === 'all' || activeTab === 'notes') {
        promises.push(fetchNotes());
      }
      if (activeTab === 'all' || activeTab === 'polls') {
        promises.push(fetchPolls());
      }
      if (activeTab === 'all' || activeTab === 'reminders') {
        promises.push(fetchReminders());
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPinnedMessages = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/pinned-messages`);
      setPinnedMessages(response.data.pinnedMessages || []);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      setPinnedMessages([]);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/notes`);
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    }
  };

  const fetchPolls = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/polls`);
      setPolls(response.data.polls || []);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setPolls([]);
    }
  };

  const fetchReminders = async () => {
    try {
      const response = await axiosInstance.get(`/reminders/chat/${groupID}`);
      setReminders(response.data || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      setReminders([]);
    }
  };

  // Note handlers
  const handleCreateNote = () => {
    // Check permission before allowing create
    if (!canCreateNotes) {
      Alert.alert(
        'Không có quyền',
        'Chỉ trưởng nhóm và phó nhóm mới có thể tạo ghi chú trong nhóm này'
      );
      return;
    }

    setSelectedNote(null);
    setNoteContent('');
    setNotePinToTop(false);
    setViewMode('create-note');
  };

  const handleViewNote = (note: Note) => {
    setSelectedNote(note);
    setNoteContent(note.content);
    setNotePinToTop(note.isPinned || false);
    setViewMode('view-note');
  };

  const handleEditNote = (note: Note) => {
    // Check permission before allowing edit
    if (!canCreateNotes) {
      Alert.alert(
        'Không có quyền',
        'Chỉ trưởng nhóm và phó nhóm mới có thể chỉnh sửa ghi chú trong nhóm này'
      );
      return;
    }

    setSelectedNote(note);
    setNoteContent(note.content);
    setNotePinToTop(note.isPinned || false);
    setViewMode('edit-note');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedNote(null);
    setNoteContent('');
    setNotePinToTop(false);
    setSelectedReminder(null);
    setReminderTitle('');
    setReminderDate(new Date());
    setReminderRepeat('none');
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung ghi chú');
      return;
    }

    // Check permission before saving
    if (!canCreateNotes) {
      Alert.alert(
        'Không có quyền',
        'Chỉ trưởng nhóm và phó nhóm mới có thể tạo/chỉnh sửa ghi chú trong nhóm này'
      );
      return;
    }

    setIsSaving(true);
    try {
      if (selectedNote) {
        // Edit existing note
        await axiosInstance.put(`/groups/${groupID}/notes/${selectedNote.noteID}`, {
          content: noteContent
        });

        // Toggle pin if needed
        if (selectedNote.isPinned !== notePinToTop) {
          if (notePinToTop) {
            const totalPinned = pinnedMessages.length + notes.filter(n => n.isPinned).length;
            if (totalPinned >= 3) {
              Alert.alert('Giới hạn ghim', 'Chỉ có thể ghim tối đa 3 mục (tin nhắn + ghi chú)');
              await fetchNotes();
              await fetchPinnedMessages();
              handleBackToList();
              Alert.alert('Thành công', 'Đã cập nhật ghi chú');
              setIsSaving(false);
              return;
            }
          }
          await axiosInstance.post(`/groups/${groupID}/notes/${selectedNote.noteID}/toggle-pin`);
        }

        Alert.alert('Thành công', 'Đã cập nhật ghi chú');
      } else {
        // Create new note
        const response = await axiosInstance.post(`/groups/${groupID}/notes`, {
          content: noteContent
        });
        const newNote = response.data.note;

        // Pin if needed
        if (notePinToTop) {
          const totalPinned = pinnedMessages.length + notes.filter(n => n.isPinned).length;
          if (totalPinned >= 3) {
            Alert.alert('Giới hạn ghim', 'Chỉ có thể ghim tối đa 3 mục (tin nhắn + ghi chú)');
            await fetchNotes();
            await fetchPinnedMessages();
            handleBackToList();
            Alert.alert('Thành công', 'Đã tạo ghi chú');
            setIsSaving(false);
            return;
          }
          await axiosInstance.post(`/groups/${groupID}/notes/${newNote.noteID}/toggle-pin`);
        }

        Alert.alert('Thành công', 'Đã tạo ghi chú');
      }

      // Refresh data and go back to list
      await fetchNotes();
      await fetchPinnedMessages();
      handleBackToList();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi lưu ghi chú');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteID: string) => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa ghi chú này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`/groups/${groupID}/notes/${noteID}`);
              Alert.alert('Thành công', 'Đã xóa ghi chú');
              await fetchNotes();
              await fetchPinnedMessages();
              if (viewMode === 'view-note' || viewMode === 'edit-note') {
                handleBackToList();
              }
            } catch (error: any) {
              Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi xóa ghi chú');
            }
          },
        },
      ]
    );
  };

  const handleTogglePinNote = async (note: Note) => {
    try {
      // If unpinning, just do it
      if (note.isPinned) {
        await axiosInstance.post(`/groups/${groupID}/notes/${note.noteID}/toggle-pin`);
        Alert.alert('Thành công', 'Đã bỏ ghim ghi chú');
        await Promise.all([fetchNotes(), fetchPinnedMessages()]);
        return;
      }

      // If pinning, check limit (3 total including messages and notes)
      const totalPinned = pinnedMessages.length + notes.filter(n => n.isPinned).length;
      if (totalPinned >= 3) {
        Alert.alert('Giới hạn ghim', 'Chỉ có thể ghim tối đa 3 mục (tin nhắn + ghi chú)');
        return;
      }

      await axiosInstance.post(`/groups/${groupID}/notes/${note.noteID}/toggle-pin`);
      Alert.alert('Thành công', 'Đã ghim ghi chú');

      // Refresh both notes and pinned messages to update the list
      await Promise.all([fetchNotes(), fetchPinnedMessages()]);
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi ghim/bỏ ghim');
    }
  };

  const handleCreatePoll = () => {
    if (!canCreatePolls) {
      Alert.alert('Không có quyền', 'Bạn không có quyền tạo bình chọn trong nhóm này');
      return;
    }
    setPollQuestion('');
    setPollOptions(['', '']);
    setViewMode('create-poll');
  };

  const handleAddPollOption = () => {
    if (pollOptions.length >= 10) return;
    setPollOptions([...pollOptions, '']);
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    const newOptions = [...pollOptions];
    newOptions.splice(index, 1);
    setPollOptions(newOptions);
  };

  const handleSavePoll = async () => {
    const validOptions = pollOptions.filter(opt => opt.trim().length > 0);
    if (!pollQuestion.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập câu hỏi');
      return;
    }
    if (validOptions.length < 2) {
      Alert.alert('Lỗi', 'Cần ít nhất 2 phương án bình chọn');
      return;
    }

    setIsSaving(true);
    try {
      await axiosInstance.post(`/groups/${groupID}/polls`, {
        question: pollQuestion,
        options: validOptions,
        isMultipleChoice: pollMultipleChoice,
        canAddOptions: pollCanAddOptions,
        isAnonymous: pollIsAnonymous,
        hideResultsBeforeVote: pollHideResults,
        endTime: pollEndTime || undefined,
        shouldPin: pollShouldPin,
      });
      Alert.alert('Thành công', 'Đã tạo bình chọn');
      await fetchPolls();
      handleBackToList();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi tạo bình chọn');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVote = async (pollID: string, optionIndex: number) => {
    try {
      await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex });
      await fetchPolls();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi bình chọn');
    }
  };

  const handleSharePoll = async (poll: Poll) => {
    try {
      await axiosInstance.post(`/groups/${groupID}/polls/${poll.pollID}/share`);
      Alert.alert('Thành công', 'Đã chia sẻ bình chọn vào trò chuyện');
      setShowPollMenu(false);
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi chia sẻ bình chọn');
    }
  };

  const handleLockPoll = async (poll: Poll) => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn khóa bình chọn này? Sau khi khóa sẽ không thể bình chọn thêm.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Khóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosInstance.post(`/groups/${groupID}/polls/${poll.pollID}/lock`);
            Alert.alert('Thành công', 'Đã khóa bình chọn');
            fetchPolls();
            setShowPollMenu(false);
          } catch (error: any) {
            Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi khóa bình chọn');
          }
        },
      },
    ]);
  };

  const handleTogglePinPoll = async (poll: Poll) => {
    // Logic tương tự pin note, giả sử backend có endpoint toggle-pin cho poll
    // Nếu không có, ta có thể dùng chung logic ghim nếu backend hỗ trợ
    try {
      await axiosInstance.post(`/groups/${groupID}/polls/${poll.pollID}/toggle-pin`);
      fetchPolls();
      fetchPinnedMessages();
      setShowPollMenu(false);
    } catch (error: any) {
      Alert.alert('Lỗi', 'Tính năng ghim bình chọn đang được cập nhật');
    }
  };

  // Reminder handlers
  const handleCreateReminder = () => {
    setSelectedReminder(null);
    setReminderTitle('');
    setReminderDate(new Date());
    setReminderRepeat('none');
    setViewMode('create-reminder');
  };

  const handleEditReminder = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setReminderTitle(reminder.title);
    setReminderDate(new Date(reminder.datetime));
    setReminderRepeat(reminder.repeat);
    setViewMode('edit-reminder');
  };

  const handleSaveReminder = async () => {
    if (!reminderTitle.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tiêu đề nhắc hẹn');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedReminder) {
        // Edit existing reminder
        await axiosInstance.put(`/reminders/${selectedReminder.reminderID}`, {
          title: reminderTitle,
          datetime: reminderDate.toISOString(),
          repeat: reminderRepeat,
        });
        Alert.alert('Thành công', 'Đã cập nhật nhắc hẹn');
      } else {
        // Create new reminder
        await axiosInstance.post('/reminders', {
          chatID: groupID,
          title: reminderTitle,
          datetime: reminderDate.toISOString(),
          repeat: reminderRepeat,
        });
        Alert.alert('Thành công', 'Đã tạo nhắc hẹn');
      }

      // Refresh data and go back to list
      await fetchReminders();
      handleBackToList();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi lưu nhắc hẹn');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReminder = async (reminderID: string) => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa nhắc hẹn này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`/reminders/${reminderID}`);
              Alert.alert('Thành công', 'Đã xóa nhắc hẹn');
              await fetchReminders();
              if (viewMode === 'edit-reminder') {
                handleBackToList();
              }
            } catch (error: any) {
              Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi xóa nhắc hẹn');
            }
          },
        },
      ]
    );
  };

  const handleToggleReminderDone = async (reminder: Reminder) => {
    try {
      await axiosInstance.put(`/reminders/${reminder.reminderID}`, {
        done: !reminder.done,
      });
      await fetchReminders();
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Lỗi khi cập nhật nhắc hẹn');
    }
  };

  const renderPinnedMessage = ({ item }: { item: Message }) => {
    const getContentPreview = () => {
      if (item.type === 'poll') return `[Bình chọn] ${item.content}`;
      if (item.type === 'text') return item.content;
      if (item.type === 'image') return '[Hình ảnh]';
      if (item.type === 'video') return '[Video]';
      if (item.type === 'file') return `[File] ${item.content}`;
      if (item.type === 'audio') return '[Tin nhắn thoại]';
      if (item.type === 'notification') {
        const c = item.content || '';
        if (c.startsWith('POLL_NOTIF|')) {
          const parts = c.split('|');
          const action = parts[1];
          const pollName = parts[3] || 'bình chọn';
          let actionText = 'đã tham gia bình chọn:';
          if (action === 'CREATE') actionText = 'đã tạo bình chọn:';
          if (action === 'LEAVE') actionText = 'đã bỏ bình chọn:';
          if (action === 'CHANGE') actionText = 'đã đổi lựa chọn:';
          if (action === 'LOCK') actionText = 'đã khóa bình chọn:';
          if (action === 'SHARE') actionText = 'đã chia sẻ bình chọn:';
          return `${actionText} ${pollName}`;
        }
        if (c.startsWith('##POLL_')) {
          const parts = c.split('|');
          const type = parts[0];
          const question = parts[2] || 'bình chọn';
          let actionText = 'đã tham gia bình chọn:';
          if (type === '##POLL_CREATED##') actionText = 'đã tạo bình chọn:';
          else if (type === '##POLL_CLOSED##') actionText = 'đã khóa bình chọn:';
          return `${actionText} ${question}`;
        }
        return c;
      }
      return '[Media]';
    };

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => {
          if (onViewMessage && item.messageID) {
            onViewMessage(item.messageID);
            onClose();
          }
        }}
      >
        <View style={styles.itemHeader}>
          <Image
            source={{
              uri: item.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${item.senderID}`,
            }}
            style={styles.avatar}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.senderName}>{item.senderInfo?.name || 'Người dùng'}</Text>
            <View style={styles.typeRow}>
              <Ionicons name="pin" size={14} color="#0084ff" />
              <Text style={styles.typeText}>Tin ghim</Text>
            </View>
          </View>
        </View>
        <Text style={styles.itemContent} numberOfLines={3}>
          {getContentPreview()}
        </Text>
        <View style={styles.itemFooter}>
          <Text style={styles.timestamp}>
            {item.timestamp ? new Date(item.timestamp).toLocaleString('vi-VN', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : ''}
          </Text>
          <TouchableOpacity onPress={() => onViewMessage?.(item.messageID)}>
            <Text style={styles.viewLink}>Xem tin nhắn gốc</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNote = ({ item }: { item: Note }) => {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Image
            source={{
              uri: item.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${item.creatorID}`,
            }}
            style={styles.avatar}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.senderName}>{item.creatorInfo?.name || 'Người dùng'}</Text>
            <View style={styles.typeRow}>
              <Ionicons name="document-text" size={14} color="#ff9500" />
              <Text style={styles.typeText}>Ghi chú</Text>
            </View>
          </View>
        </View>
        <Text style={styles.itemContent}>{item.content}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleString('vi-VN')}
        </Text>
      </View>
    );
  };

  const renderPoll = ({ item }: { item: Poll }) => {
    const totalVotes = item.options?.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0) || 0;
    const userVotedIndices = item.options
      ?.map((opt, idx) => (opt.voters?.includes(userID) ? idx : -1))
      .filter(idx => idx !== -1) || [];
    
    const displayedOptions = item.options?.slice(0, 3) || [];
    const remainingOptionsCount = (item.options?.length || 0) - 3;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Image
            source={{ uri: item.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${item.creatorID}` }}
            style={styles.avatar}
          />
          <View style={styles.itemInfo}>
            <Text style={styles.pollCreatorName}>
              <Text style={{ fontWeight: '700' }}>{item.creatorInfo?.name || 'Người dùng'}</Text> tạo một bình chọn
            </Text>
            <Text style={styles.timestamp}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {item.isPinned && <Ionicons name="pin" size={16} color="#ff9500" style={{ marginRight: 8 }} />}
            <TouchableOpacity onPress={() => { setSelectedPollForMenu(item); setShowPollMenu(true); }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.pollQuestion}>{item.question}</Text>
        <View style={styles.pollMetaRow}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            onPress={() => setShowVotersForPoll(item)}
          >
            <Text style={[styles.pollMeta, { color: '#0068ff' }]}>
              {new Set(item.options?.flatMap(o => o.voters || [])).size} người bình chọn, {totalVotes} lượt bình chọn
            </Text>
            <Text style={{ fontSize: 9, color: '#0068ff' }}>▶</Text>
          </TouchableOpacity>
          {item.endTime && new Date(item.endTime) < new Date() && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>Đã đóng</Text>
            </View>
          )}
        </View>
        
        {displayedOptions.map((option, index) => {
          const votesCount = option.voters?.length || 0;
          const percentage = totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0;
          const isSelected = userVotedIndices.includes(index);

          return (
            <TouchableOpacity 
              key={index} 
              style={[styles.pollOption, isSelected && styles.pollOptionSelected]}
              onPress={() => handleVote(item.pollID, index)}
            >
              <View style={[styles.pollBar, { width: `${percentage}%` }]} />
              <View style={styles.pollOptionContent}>
                <Text style={[styles.pollOptionText, isSelected && styles.pollOptionTextSelected]}>{option.text}</Text>
                <View style={styles.pollVoterAvatars}>
                  {option.voters?.slice(0, 3).map((vID, idx) => {
                    const m = members.find(mb => mb.userID === vID);
                    const avatarUri = m?.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/png?seed=${vID}`;
                    return (
                      <Image key={idx} source={{ uri: avatarUri }} style={styles.smallAvatar} />
                    );
                  })}
                  {isSelected && <Ionicons name="checkmark-circle" size={18} color="#0084ff" style={{ marginLeft: 4 }} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {remainingOptionsCount > 0 && (
          <Text style={styles.pollOtherOptions}>{remainingOptionsCount} phương án khác</Text>
        )}

        <TouchableOpacity 
          style={[styles.pollVoteButton, userVotedIndices.length > 0 && { backgroundColor: '#f1f3f5' }]} 
          disabled={userVotedIndices.length > 0}
          onPress={() => {
            if (userVotedIndices.length === 0) {
              Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một phương án bên trên');
            }
          }}
        >
          <Text style={[styles.pollVoteButtonText, userVotedIndices.length > 0 && { color: '#888' }]}>
            {userVotedIndices.length > 0 ? 'Đã bình chọn' : 'Bình chọn'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0084ff" />
        </View>
      );
    }

    if (activeTab === 'pinned') {
      if (pinnedMessages.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="pin-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có tin ghim</Text>
          </View>
        );
      }
      return (
        <FlatList
          data={pinnedMessages}
          renderItem={renderPinnedMessage}
          keyExtractor={(item) => item.messageID}
          contentContainerStyle={styles.listContent}
        />
      );
    }

    if (activeTab === 'notes') {
      if (notes.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có ghi chú</Text>
            {canCreateNotes && (
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateNote}
              >
                <Text style={styles.createButtonText}>Tạo ghi chú</Text>
              </TouchableOpacity>
            )}
            {!canCreateNotes && (
              <View style={styles.permissionNotice}>
                <Ionicons name="lock-closed" size={16} color="#999" />
                <Text style={styles.permissionText}>
                  Chỉ trưởng nhóm và phó nhóm mới có thể tạo ghi chú
                </Text>
              </View>
            )}
          </View>
        );
      }
      return (
        <View style={{ flex: 1 }}>
          <FlatList
            data={notes}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.itemCard}
                onPress={() => handleViewNote(item)}
              >
                <View style={styles.itemHeader}>
                  <Image
                    source={{
                      uri: item.creatorInfo?.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/png?seed=${item.creatorID}`,
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.senderName}>
                      {item.creatorInfo?.name || 'Người dùng'}
                    </Text>
                    <View style={styles.typeRow}>
                      <Ionicons name="document-text" size={14} color="#ff9500" />
                      <Text style={styles.typeText}>Ghi chú</Text>
                      {item.isPinned && (
                        <Ionicons name="pin" size={12} color="#0084ff" style={{ marginLeft: 8 }} />
                      )}
                    </View>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={() => handleTogglePinNote(item)}>
                      <Ionicons
                        name={item.isPinned ? "pin" : "pin-outline"}
                        size={20}
                        color="#0084ff"
                      />
                    </TouchableOpacity>
                    {item.creatorID === userID && (
                      <TouchableOpacity onPress={() => handleDeleteNote(item.noteID)}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.itemContent} numberOfLines={3}>
                  {item.content}
                </Text>
                <Text style={styles.timestamp}>
                  {new Date(item.createdAt).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.noteID}
            contentContainerStyle={styles.listContent}
          />
          {canCreateNotes && (
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={handleCreateNote}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (activeTab === 'polls') {
      if (polls.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có bình chọn</Text>
            {canCreatePolls && (
              <TouchableOpacity style={styles.createButton} onPress={handleCreatePoll}>
                <Text style={styles.createButtonText}>Tạo bình chọn</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }
      return (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={pollListRef}
            data={polls}
            renderItem={renderPoll}
            keyExtractor={(item) => item.pollID}
            contentContainerStyle={styles.listContent}
            onScrollToIndexFailed={(info) => {
              pollListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            }}
          />
          {canCreatePolls && (
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={handleCreatePoll}
            >
              <Ionicons name="stats-chart" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Tab "Tất cả"
    return (
      <ScrollView contentContainerStyle={styles.listContent}>
        {pinnedMessages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tin ghim ({pinnedMessages.length})</Text>
            {pinnedMessages.slice(0, 2).map((item) => (
              <View key={item.messageID}>{renderPinnedMessage({ item })}</View>
            ))}
          </View>
        )}

        {notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ghi chú ({notes.length})</Text>
            {notes.slice(0, 2).map((item) => (
              <View key={item.noteID}>{renderNote({ item })}</View>
            ))}
          </View>
        )}

        {polls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bình chọn ({polls.length})</Text>
            {polls.slice(0, 2).map((item) => (
              <View key={item.pollID}>{renderPoll({ item })}</View>
            ))}
          </View>
        )}

        {pinnedMessages.length === 0 && notes.length === 0 && polls.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Chưa có nội dung</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={viewMode === 'list' ? onClose : handleBackToList} style={styles.backButton}>
            <Ionicons name={viewMode === 'list' ? "close" : "chevron-back"} size={24} color="#333" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {viewMode === 'list' ? 'Bảng tin nhóm' : viewMode === 'create-note' ? 'Tạo ghi chú' : viewMode === 'edit-note' ? 'Sửa ghi chú' : viewMode === 'view-note' ? 'Chi tiết ghi chú' : 'Tạo bình chọn mới'}
            </Text>
          </View>
          {viewMode === 'create-poll' ? (
            <TouchableOpacity
              onPress={handleSavePoll}
              disabled={isSaving || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
            >
              <Text style={[
                styles.headerActionText,
                (isSaving || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) && { color: '#aaa' }
              ]}>
                {isSaving ? 'ĐANG TẠO' : 'TẠO'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {viewMode === 'list' && (
          <View style={styles.tabs}>
            {(['all', 'pinned', 'notes', 'polls'] as TabType[]).map(tab => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'all' ? 'Tất cả' : tab === 'pinned' ? 'Đã ghim' : tab === 'notes' ? 'Ghi chú' : 'Bình chọn'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {viewMode === 'list' && renderContent()}

        {(viewMode === 'create-note' || viewMode === 'edit-note') && (
          <ScrollView style={styles.formContainer}>
            <Text style={styles.formLabel}>Nội dung ghi chú</Text>
            <TextInput style={styles.textArea} value={noteContent} onChangeText={setNoteContent} placeholder="Nhập nội dung..." placeholderTextColor="#999" multiline />
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setNotePinToTop(!notePinToTop)}>
              <Ionicons name={notePinToTop ? "checkbox" : "square-outline"} size={24} color="#0084ff" />
              <Text style={styles.checkboxLabel}>Ghim lên đầu trò chuyện</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonPrimary, (!noteContent.trim() || isSaving) && styles.buttonDisabled]} onPress={handleSaveNote} disabled={isSaving || !noteContent.trim()}>
              <Text style={styles.buttonPrimaryText}>{isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {viewMode === 'view-note' && selectedNote && (
          <ScrollView style={styles.formContainer}>
            <View style={styles.noteViewHeader}>
              <Image source={{ uri: selectedNote.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${selectedNote.creatorID}` }} style={styles.avatar} />
              <View>
                <Text style={styles.senderName}>{selectedNote.creatorInfo?.name || 'Người dùng'}</Text>
                <Text style={styles.timestamp}>{new Date(selectedNote.createdAt).toLocaleString()}</Text>
              </View>
            </View>
            <Text style={styles.noteContentText}>{selectedNote.content}</Text>
            {selectedNote.creatorID === userID && (
              <View style={styles.formActions}>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => handleEditNote(selectedNote)}><Text style={styles.buttonSecondaryText}>Sửa</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={() => handleDeleteNote(selectedNote.noteID)}><Text style={styles.buttonDangerText}>Xóa</Text></TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}

        {viewMode === 'create-poll' && (
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            {/* Ghim lên đầu */}
            <View style={styles.pinRow}>
              <TouchableOpacity
                style={styles.pinCircle}
                onPress={() => setPollShouldPin(!pollShouldPin)}
              >
                {pollShouldPin
                  ? <View style={styles.pinCircleFilled}><Ionicons name="checkmark" size={14} color="#fff" /></View>
                  : <View style={styles.pinCircleEmpty} />
                }
              </TouchableOpacity>
              <Text style={styles.pinLabel}>Ghim lên đầu trò chuyện</Text>
            </View>

            {/* Câu hỏi */}
            <TextInput
              style={styles.pollQuestionInput}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="Đặt câu hỏi bình chọn"
              placeholderTextColor="#bbb"
              multiline
            />

            {/* Phương án */}
            <View style={styles.pollOptionsSection}>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.pollOptionRow}>
                  <TextInput
                    style={styles.pollOptionInput}
                    value={opt}
                    onChangeText={t => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = t;
                      setPollOptions(newOpts);
                    }}
                    placeholder={`Phương án ${i + 1}`}
                    placeholderTextColor="#bbb"
                  />
                  <TouchableOpacity
                    style={styles.pollOptionRemove}
                    onPress={() => handleRemovePollOption(i)}
                  >
                    <Ionicons name="close" size={18} color="#aaa" />
                  </TouchableOpacity>
                </View>
              ))}
              {pollOptions.length < 30 && (
                <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddPollOption}>
                  <Text style={styles.addOptionText}>+ Thêm phương án</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Tùy chọn */}
            <View style={styles.pollSettingsSection}>
              <Text style={styles.pollSettingsTitle}>Tuỳ chọn</Text>

              {/* Đặt thời hạn */}
              <TouchableOpacity
                style={styles.pollSettingRow}
                onPress={() => setShowDatePicker(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pollSettingLabel}>Đặt thời hạn</Text>
                  <Text style={styles.pollSettingSubLabel}>
                    {endTimeDate
                      ? endTimeDate.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'Không có thời hạn'}
                  </Text>
                </View>
                {endTimeDate && (
                  <TouchableOpacity onPress={() => { setEndTimeDate(null); setPollEndTime(''); }}>
                    <Ionicons name="close-circle" size={20} color="#aaa" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={endTimeDate || new Date(Date.now() + 3600000)}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) {
                      setEndTimeDate(date);
                      setPollEndTime(date.toISOString());
                    }
                  }}
                />
              )}

              <View style={styles.pollSettingDivider} />

              {/* Ẩn người bình chọn */}
              <View style={styles.pollSettingRow}>
                <Text style={styles.pollSettingLabel}>Ẩn người bình chọn</Text>
                <Switch
                  value={pollIsAnonymous}
                  onValueChange={setPollIsAnonymous}
                  trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.pollSettingDivider} />

              {/* Ẩn kết quả khi chưa bình chọn */}
              <View style={styles.pollSettingRow}>
                <Text style={styles.pollSettingLabel}>Ẩn kết quả khi chưa bình chọn</Text>
                <Switch
                  value={pollHideResults}
                  onValueChange={setPollHideResults}
                  trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.pollSettingDivider} />

              {/* Chọn nhiều phương án */}
              <View style={styles.pollSettingRow}>
                <Text style={styles.pollSettingLabel}>Chọn nhiều phương án</Text>
                <Switch
                  value={pollMultipleChoice}
                  onValueChange={setPollMultipleChoice}
                  trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.pollSettingDivider} />

              {/* Có thể thêm phương án */}
              <View style={styles.pollSettingRow}>
                <Text style={styles.pollSettingLabel}>Có thể thêm phương án</Text>
                <Switch
                  value={pollCanAddOptions}
                  onValueChange={setPollCanAddOptions}
                  trackColor={{ false: '#e0e0e0', true: '#0068ff' }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </ScrollView>
        )}

        <Modal visible={showPollMenu} transparent animationType="fade" onRequestClose={() => setShowPollMenu(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowPollMenu(false)}>
            <View style={styles.menuContent}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Tùy chọn</Text>
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => selectedPollForMenu && handleTogglePinPoll(selectedPollForMenu)}>
                <Text style={styles.menuItemText}>
                  {selectedPollForMenu?.isPinned ? 'Bỏ ghim khỏi trò chuyện' : 'Ghim lên đầu trò chuyện'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => selectedPollForMenu && handleSharePoll(selectedPollForMenu)}>
                <Text style={styles.menuItemText}>Gửi vào trò chuyện</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.menuItem, !!(selectedPollForMenu?.endTime && new Date(selectedPollForMenu.endTime) < new Date()) && styles.menuItemDisabled]} 
                onPress={() => selectedPollForMenu && !(selectedPollForMenu?.endTime && new Date(selectedPollForMenu.endTime) < new Date()) && handleLockPoll(selectedPollForMenu)}
                disabled={!!(selectedPollForMenu?.endTime && new Date(selectedPollForMenu.endTime) < new Date())}
              >
                <Text style={[styles.menuItemText, !!(selectedPollForMenu?.endTime && new Date(selectedPollForMenu.endTime) < new Date()) && { color: '#ccc' }]}>
                  {!!(selectedPollForMenu?.endTime && new Date(selectedPollForMenu.endTime) < new Date()) ? 'Bình chọn đã đóng' : 'Khóa bình chọn'}
                </Text>
              </TouchableOpacity>

              <View style={styles.menuFooter}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPollMenu(false)}>
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {showVotersForPoll && (
          <PollVotersModal
            visible={!!showVotersForPoll}
            poll={showVotersForPoll}
            members={members}
            userID={userID}
            currentUser={currentUser}
            onClose={() => setShowVotersForPoll(null)}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  headerActionText: { fontSize: 15, fontWeight: '700', color: '#0068ff' },
  backButton: { padding: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#0084ff' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#0084ff', fontWeight: '700' },
  listContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  itemHeader: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  itemInfo: { flex: 1 },
  senderName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeText: { fontSize: 12, color: '#888' },
  itemContent: { fontSize: 15, color: '#333', marginBottom: 12, lineHeight: 22 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timestamp: { fontSize: 12, color: '#999' },
  viewLink: { fontSize: 13, color: '#0084ff', fontWeight: '500' },
  pollQuestion: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  pollMeta: { fontSize: 13, color: '#888', marginBottom: 12 },
  pollOption: {
    position: 'relative', backgroundColor: '#f1f3f5', borderRadius: 10,
    marginBottom: 8, overflow: 'hidden', height: 44, justifyContent: 'center'
  },
  pollOptionSelected: { backgroundColor: '#e7f3ff', borderWidth: 1, borderColor: '#0084ff' },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#0084ff', opacity: 0.1 },
  pollOptionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  pollOptionText: { fontSize: 14, color: '#444' },
  pollOptionTextSelected: { color: '#0084ff', fontWeight: '600' },
  pollOptionVotes: { fontSize: 14, fontWeight: '700', color: '#111' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 16, marginBottom: 24 },
  createButton: { backgroundColor: '#0084ff', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 25 },
  createButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  floatingButton: {
    position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#0084ff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0084ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  formContainer: { flex: 1, padding: 20, backgroundColor: '#fff' },
  formLabel: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 10 },
  textArea: {
    backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, color: '#111',
    fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: '#eee', textAlignVertical: 'top'
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  checkboxLabel: { fontSize: 15, color: '#333' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  button: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flex: 1 },
  buttonPrimary: { backgroundColor: '#0084ff' },
  buttonSecondary: { backgroundColor: '#f1f3f5' },
  buttonDanger: { backgroundColor: '#fff0f0' },
  buttonPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  buttonSecondaryText: { fontSize: 15, fontWeight: '700', color: '#444' },
  buttonDangerText: { fontSize: 15, fontWeight: '700', color: '#ff4d4f' },
  buttonDisabled: { opacity: 0.5 },
  pollOptionInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  pollOptionInput: { flex: 1, backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#eee', color: '#111' },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginBottom: 20 },
  addOptionText: { fontSize: 15, color: '#0084ff', fontWeight: '600' },
  noteViewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  noteContentText: { fontSize: 16, color: '#333', lineHeight: 26 },
  actionButtons: { flexDirection: 'row', gap: 12, marginLeft: 'auto' },
  pollCreatorName: { fontSize: 14, color: '#333', flex: 1 },
  pollMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  pollVoterAvatars: { flexDirection: 'row', alignItems: 'center' },
  smallAvatar: { width: 20, height: 20, borderRadius: 10, marginLeft: -8, borderWidth: 1, borderColor: '#fff' },
  pollOtherOptions: { fontSize: 13, color: '#888', textAlign: 'center', marginVertical: 8 },
  pollVoteButton: { backgroundColor: '#e7f3ff', borderRadius: 20, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  pollVoteButtonText: { fontSize: 15, color: '#0084ff', fontWeight: '600' },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuContent: { backgroundColor: '#f8f9fa', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  menuHeader: { alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuTitle: { fontSize: 13, color: '#888' },
  menuItem: { backgroundColor: '#fff', paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuItemText: { fontSize: 17, color: '#0084ff' },
  menuFooter: { padding: 10, marginTop: 5 },
  cancelButton: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 17, color: '#0084ff', fontWeight: '600' },
  closedBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  closedBadgeText: { fontSize: 11, color: '#ef4444', fontWeight: '700' },
  menuItemDisabled: { backgroundColor: '#f8f9fa' },
  permissionNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16,
    backgroundColor: '#f1f3f5', borderRadius: 12, marginTop: 16,
  },
  permissionText: { fontSize: 13, color: '#888', textAlign: 'center' },

  // Create poll new UI
  pinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
  },
  pinCircle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  pinCircleEmpty: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ccc' },
  pinCircleFilled: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0068ff', alignItems: 'center', justifyContent: 'center' },
  pinLabel: { fontSize: 15, color: '#333' },
  pollQuestionInput: {
    fontSize: 22, fontWeight: '400', color: '#111',
    paddingHorizontal: 20, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    minHeight: 80,
  },
  pollOptionsSection: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
    borderBottomWidth: 8, borderBottomColor: '#f5f5f5',
  },
  pollOptionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    paddingVertical: 4,
  },
  pollOptionRemove: { padding: 8 },
  pollSettingsSection: {
    paddingHorizontal: 16, paddingTop: 16,
  },
  pollSettingsTitle: { fontSize: 14, fontWeight: '700', color: '#0068ff', marginBottom: 12 },
  pollSettingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  pollSettingLabel: { fontSize: 15, color: '#111', flex: 1, marginRight: 12 },
  pollSettingSubLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  pollSettingDivider: { height: 1, backgroundColor: '#f0f0f0' },
});
