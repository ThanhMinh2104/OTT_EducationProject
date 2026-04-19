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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../utils/axios';

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
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
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
}

type TabType = 'all' | 'pinned' | 'notes' | 'polls';

export const GroupBoardModal: React.FC<GroupBoardModalProps> = ({
  visible,
  onClose,
  groupID,
  userID,
  onViewMessage,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, activeTab]);

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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPinnedMessages = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=100`);
      const messages = response.data.messages || [];
      const pinned = messages.filter((msg: Message) => msg.pinnedInfo?.pinnedBy);
      setPinnedMessages(pinned);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      setPinnedMessages([]);
    }
  };

  const fetchNotes = async () => {
    try {
      // TODO: Implement API endpoint for notes
      // const response = await axiosInstance.get(`/groups/${groupID}/notes`);
      // setNotes(response.data);
      setNotes([]);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    }
  };

  const fetchPolls = async () => {
    try {
      // TODO: Implement API endpoint for polls
      // const response = await axiosInstance.get(`/groups/${groupID}/polls`);
      // setPolls(response.data);
      setPolls([]);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setPolls([]);
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
            <TouchableOpacity style={styles.createButton}>
              <Text style={styles.createButtonText}>Tạo ghi chú</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.noteID}
          contentContainerStyle={styles.listContent}
        />
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
          <Text style={styles.headerTitle}>Bảng tin nhóm</Text>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
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

        {/* Content */}
        {renderContent()}
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
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
