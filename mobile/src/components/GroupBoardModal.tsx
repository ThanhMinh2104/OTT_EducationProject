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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';

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
  question: string;
  options: Array<{
    text: string;
    votes: number;
  }>;
  createdBy: string;
  createdAt: string;
  endDate?: string;
  voters: Array<{
    userID: string;
    optionIndex: number;
  }>;
}

interface GroupBoardModalProps {
  visible: boolean;
  onClose: () => void;
  groupID: string;
  userID: string;
  onViewMessage?: (messageID: string) => void;
  canCreateNotes?: boolean;
}

type TabType = 'all' | 'pinned' | 'notes' | 'polls' | 'reminders';
type ViewMode = 'list' | 'create-note' | 'view-note' | 'edit-note' | 'create-reminder' | 'edit-reminder';

export const GroupBoardModal: React.FC<GroupBoardModalProps> = ({
  visible,
  onClose,
  groupID,
  userID,
  onViewMessage,
  canCreateNotes = true,
}) => {
  console.log('🎯 GroupBoardModal props:', {
    groupID,
    userID,
    canCreateNotes,
  });
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  
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

  // Reset to list view when modal closes
  useEffect(() => {
    if (!visible) {
      setViewMode('list');
      setSelectedNote(null);
      setNoteContent('');
      setNotePinToTop(false);
      setSelectedReminder(null);
      setReminderTitle('');
      setReminderDate(new Date());
      setReminderRepeat('none');
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      fetchData();
      
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

      socket.on('note_created', handleNoteCreated);
      socket.on('note_updated', handleNoteUpdated);
      socket.on('note_deleted', handleNoteDeleted);
      socket.on('note_pin_toggled', handleNotePinToggled);

      return () => {
        socket.off('note_created', handleNoteCreated);
        socket.off('note_updated', handleNoteUpdated);
        socket.off('note_deleted', handleNoteDeleted);
        socket.off('note_pin_toggled', handleNotePinToggled);
      };
    }
  }, [visible, activeTab, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'all' || activeTab === 'pinned') {
        await fetchPinnedMessages();
      }
      if (activeTab === 'all' || activeTab === 'notes') {
        await fetchNotes();
      }
      if (activeTab === 'all' || activeTab === 'polls') {
        await fetchPolls();
      }
      if (activeTab === 'all' || activeTab === 'reminders') {
        await fetchReminders();
      }
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
      // TODO: Implement API endpoint for polls
      setPolls([]);
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
      if (item.type === 'text') return item.content;
      if (item.type === 'image') return '[Hình ảnh]';
      if (item.type === 'video') return '[Video]';
      if (item.type === 'file') return `[File] ${item.content}`;
      if (item.type === 'audio') return '[Tin nhắn thoại]';
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
              uri: item.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.senderID}`,
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
            {new Date(item.timestamp).toLocaleString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
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
              uri: item.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.creatorID}`,
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
          Hôm nay lúc {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  const renderPoll = ({ item }: { item: Poll }) => {
    const totalVotes = item.options.reduce((sum, opt) => sum + opt.votes, 0);
    const userVote = item.voters.find(v => v.userID === userID);

    return (
      <View style={styles.itemCard}>
        <Text style={styles.pollQuestion}>{item.question}</Text>
        <Text style={styles.pollMeta}>
          Kết thúc lúc {new Date(item.endDate || item.createdAt).toLocaleString('vi-VN')}
        </Text>
        <Text style={styles.pollMeta}>Chọn nhiều phương án</Text>
        
        <View style={styles.pollVoters}>
          <Text style={styles.pollVotersText}>{totalVotes} người bình chọn</Text>
          <Ionicons name="chevron-forward" size={16} color="#0084ff" />
        </View>

        {item.options.map((option, index) => {
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;

          return (
            <View key={index} style={styles.pollOption}>
              <View style={[styles.pollBar, { width: `${percentage}%` }]} />
              <View style={styles.pollOptionContent}>
                <Text style={styles.pollOptionText}>{option.text}</Text>
                <Text style={styles.pollOptionVotes}>{option.votes}</Text>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.pollButton}>
          <Text style={styles.pollButtonText}>Bình chọn</Text>
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
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.creatorID}`,
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
            <TouchableOpacity style={styles.createButton}>
              <Text style={styles.createButtonText}>Tạo bình chọn</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <FlatList
          data={polls}
          renderItem={renderPoll}
          keyExtractor={(item) => item.pollID}
          contentContainerStyle={styles.listContent}
        />
      );
    }

    // Tab "Tất cả"
    return (
      <ScrollView contentContainerStyle={styles.listContent}>
        {pinnedMessages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tin ghim ({pinnedMessages.length})</Text>
            {pinnedMessages.slice(0, 3).map((item) => (
              <View key={item.messageID}>{renderPinnedMessage({ item })}</View>
            ))}
          </View>
        )}

        {notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ghi chú ({notes.length})</Text>
            {notes.slice(0, 3).map((item) => (
              <View key={item.noteID}>{renderNote({ item })}</View>
            ))}
          </View>
        )}

        {polls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bình chọn ({polls.length})</Text>
            {polls.slice(0, 3).map((item) => (
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {viewMode === 'list' && 'Bảng tin nhóm'}
            {viewMode === 'create-note' && 'Tạo ghi chú'}
            {viewMode === 'view-note' && 'Xem ghi chú'}
            {viewMode === 'edit-note' && 'Chỉnh sửa ghi chú'}
            {viewMode === 'create-reminder' && 'Tạo nhắc hẹn'}
            {viewMode === 'edit-reminder' && 'Chỉnh sửa nhắc hẹn'}
          </Text>
          {viewMode === 'list' && canCreateNotes && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                if (activeTab === 'notes') {
                  handleCreateNote();
                } else if (activeTab === 'reminders') {
                  handleCreateReminder();
                }
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          {viewMode === 'list' && !canCreateNotes && (
            <View style={styles.addButton} />
          )}
          {viewMode !== 'list' && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleBackToList}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        {viewMode === 'list' && (
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                Tất cả
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pinned' && styles.tabActive]}
              onPress={() => setActiveTab('pinned')}
            >
              <Text style={[styles.tabText, activeTab === 'pinned' && styles.tabTextActive]}>
                Tin ghim
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'notes' && styles.tabActive]}
              onPress={() => setActiveTab('notes')}
            >
              <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
                Ghi chú
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'polls' && styles.tabActive]}
              onPress={() => setActiveTab('polls')}
            >
              <Text style={[styles.tabText, activeTab === 'polls' && styles.tabTextActive]}>
                Bình chọn
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {viewMode === 'list' && renderContent()}
        
        {/* Create Note Form */}
        {viewMode === 'create-note' && (
          <ScrollView style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nội dung ghi chú</Text>
              <TextInput
                style={styles.textArea}
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Nhập nội dung ghi chú..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
            </View>
            
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setNotePinToTop(!notePinToTop)}
            >
              <Ionicons 
                name={notePinToTop ? "checkbox" : "square-outline"} 
                size={24} 
                color="#0084ff" 
              />
              <Text style={styles.checkboxLabel}>Ghim lên đầu trò chuyện</Text>
            </TouchableOpacity>
            
            <View style={styles.formActions}>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleBackToList}
              >
                <Text style={styles.buttonSecondaryText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.buttonPrimary, 
                  (!noteContent.trim() || isSaving) && styles.buttonDisabled
                ]}
                onPress={handleSaveNote}
                disabled={isSaving || !noteContent.trim()}
              >
                <Text style={styles.buttonPrimaryText}>
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
        
        {/* View Note */}
        {viewMode === 'view-note' && selectedNote && (
          <ScrollView style={styles.formContainer}>
            <View style={styles.noteViewHeader}>
              <View style={styles.itemHeader}>
                <Image
                  source={{
                    uri: selectedNote.creatorInfo?.avatar || 
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedNote.creatorID}`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.senderName}>
                    {selectedNote.creatorInfo?.name || 'Người dùng'}
                  </Text>
                  <Text style={styles.timestamp}>
                    {new Date(selectedNote.createdAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.noteContentView}>
              <Text style={styles.noteContentText}>{selectedNote.content}</Text>
            </View>
            
            <View style={styles.formActions}>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => handleTogglePinNote(selectedNote)}
              >
                <Ionicons 
                  name={selectedNote.isPinned ? "pin" : "pin-outline"} 
                  size={18} 
                  color="#fff" 
                />
                <Text style={styles.buttonSecondaryText}>
                  {selectedNote.isPinned ? 'Bỏ ghim' : 'Ghim'}
                </Text>
              </TouchableOpacity>
              
              {selectedNote.creatorID === userID && canCreateNotes && (
                <>
                  <TouchableOpacity 
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={() => handleEditNote(selectedNote)}
                  >
                    <Text style={styles.buttonPrimaryText}>Chỉnh sửa</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.button, styles.buttonDanger]}
                    onPress={() => handleDeleteNote(selectedNote.noteID)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.buttonDangerText}>Xóa</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        )}
        
        {/* Edit Note Form */}
        {viewMode === 'edit-note' && selectedNote && (
          <ScrollView style={styles.formContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nội dung ghi chú</Text>
              <TextInput
                style={styles.textArea}
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Nhập nội dung ghi chú..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
            </View>
            
            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setNotePinToTop(!notePinToTop)}
            >
              <Ionicons 
                name={notePinToTop ? "checkbox" : "square-outline"} 
                size={24} 
                color="#0084ff" 
              />
              <Text style={styles.checkboxLabel}>Ghim lên đầu trò chuyện</Text>
            </TouchableOpacity>
            
            <View style={styles.formActions}>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleBackToList}
              >
                <Text style={styles.buttonSecondaryText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.buttonPrimary, 
                  (!noteContent.trim() || isSaving) && styles.buttonDisabled
                ]}
                onPress={handleSaveNote}
                disabled={isSaving || !noteContent.trim()}
              >
                <Text style={styles.buttonPrimaryText}>
                  {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
    paddingTop: 50, // Add padding for status bar
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    padding: 4,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0084ff',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
  },
  tabTextActive: {
    color: '#0084ff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: 13,
    color: '#999',
  },
  itemContent: {
    fontSize: 14,
    color: '#e0e0e0',
    marginBottom: 12,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  viewLink: {
    fontSize: 13,
    color: '#0084ff',
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  pollMeta: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  pollVoters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  pollVotersText: {
    fontSize: 13,
    color: '#0084ff',
  },
  pollOption: {
    position: 'relative',
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  pollBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#0084ff',
    opacity: 0.3,
  },
  pollOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  pollOptionText: {
    fontSize: 14,
    color: '#fff',
  },
  pollOptionVotes: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  pollButton: {
    backgroundColor: '#0084ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  pollButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#0084ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  createButtonTextDisabled: {
    color: '#999',
  },
  permissionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginTop: 16,
    maxWidth: 300,
  },
  permissionText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 'auto',
  },
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButtonDisabled: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#3a3a3a',
  },
  formContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    color: '#e0e0e0',
    fontSize: 15,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonPrimary: {
    backgroundColor: '#0084ff',
  },
  buttonSecondary: {
    backgroundColor: '#3a3a3a',
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDangerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  noteViewHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  noteContentView: {
    marginBottom: 24,
  },
  noteContentText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 24,
  },
});
