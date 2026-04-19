import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import { initSocketDebug, testSocketConnection } from '../utils/socketDebug';

interface Message {
  messageID: string;
  groupID: string;
  senderID: string;
  content?: string;
  type: string;
  media_url: string[];
  timestamp: Date;
  status: string;
  senderInfo: {
    name: string;
    avatar?: string;
  };
}

interface GroupChatScreenProps {
  groupID: string;
  userID: string;
  userName?: string;
  userAvatar?: string;
  onBack: () => void;
}

export const GroupChatScreen: React.FC<GroupChatScreenProps> = ({
  groupID,
  userID,
  userName = 'User',
  userAvatar,
  onBack,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set<string>());
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    console.log('🔌 Joining group:', { groupID, userID });
    
    // Initialize socket debug (chỉ chạy 1 lần)
    initSocketDebug();
    testSocketConnection();
    
    fetchMessages();
    
    // Join group room
    socket.emit('join_group', { groupID, userID });

    // Listen for socket events
    socket.on('new_group_message', handleNewMessage);
    socket.on('group_typing_start', handleTypingStart);
    socket.on('group_typing_stop', handleTypingStop);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('error_notification', handleError);

    return () => {
      console.log('🔌 Leaving group:', { groupID, userID });
      socket.off('new_group_message', handleNewMessage);
      socket.off('group_typing_start', handleTypingStart);
      socket.off('group_typing_stop', handleTypingStop);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('error_notification', handleError);
      socket.emit('leave_group', { groupID, userID });
    };
  }, [groupID, userID]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=50`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Lỗi', 'Không thể tải tin nhắn');
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message: Message) => {
    console.log('📨 Received new_group_message:', message);
    if (message.groupID === groupID) {
      setMessages((prev) => [...prev, message]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleError = (data: any) => {
    console.error('❌ Socket error:', data);
    Alert.alert('Lỗi', data.message || 'Có lỗi xảy ra');
  };

  const handleTypingStart = (data: any) => {
    if (data.groupID === groupID && data.userID !== userID) {
      setTypingUsers((prev) => new Set([...prev, data.userID]));
    }
  };

  const handleTypingStop = (data: any) => {
    if (data.groupID === groupID) {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.userID);
        return newSet;
      });
    }
  };

  const handleMessageDeleted = (data: any) => {
    if (data.deleteForAll) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === data.messageID
            ? { ...msg, type: 'notification', content: 'Tin nhắn đã bị xóa' }
            : msg
        )
      );
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    console.log('📤 Sending message:', {
      groupID,
      senderID: userID,
      content: inputValue,
    });

    const message = {
      groupID,
      senderID: userID,
      content: inputValue,
      type: 'text',
      media_url: [],
      senderInfo: {
        name: userName,
        avatar: userAvatar,
      },
    };

    socket.emit('send_group_message', message);
    setInputValue('');

    // Optimistic update - hiển thị tin nhắn ngay lập tức
    const optimisticMessage: Message = {
      messageID: `temp_${Date.now()}`,
      groupID,
      senderID: userID,
      content: inputValue,
      type: 'text',
      media_url: [],
      timestamp: new Date(),
      status: 'sent',
      senderInfo: {
        name: userName,
        avatar: userAvatar,
      },
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleTyping = () => {
    socket.emit('group_typing_start', {
      groupID,
      userID,
      userName: userName,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('group_typing_stop', { groupID, userID });
    }, 3000);
  };

  const handleDeleteMessage = (messageID: string) => {
    Alert.alert('Xóa tin nhắn', 'Bạn muốn xóa tin nhắn này?', [
      { text: 'Hủy', onPress: () => {} },
      {
        text: 'Xóa',
        onPress: () => {
          socket.emit('delete_group_message', {
            messageID,
            userID,
            groupID,
            deleteForAll: false,
          });
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderID === userID;

    return (
      <View style={[styles.messageGroup, isOwn && styles.messageGroupOwn]}>
        {!isOwn && (
          <View style={styles.messageSender}>
            <Text style={styles.senderName}>{item.senderInfo?.name}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
            {new Date(item.timestamp).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        {isOwn && (
          <TouchableOpacity
            style={styles.btnDelete}
            onPress={() => handleDeleteMessage(item.messageID)}
          >
            <Text style={styles.btnDeleteText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.btnBack}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nhóm Chat</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.messageID}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {typingUsers.size > 0 && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>Đang nhập...</Text>
        </View>
      )}

      <View style={styles.inputArea}>
        <TextInput
          style={styles.messageInput}
          placeholder="Nhập tin nhắn..."
          value={inputValue}
          onChangeText={(text) => {
            setInputValue(text);
            handleTyping();
          }}
          multiline
        />
        <TouchableOpacity
          style={[styles.btnSend, !inputValue.trim() && styles.btnSendDisabled]}
          onPress={handleSendMessage}
          disabled={!inputValue.trim()}
        >
          <Text style={styles.btnSendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  btnBack: {
    color: '#0084ff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageGroup: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  messageGroupOwn: {
    justifyContent: 'flex-end',
  },
  messageSender: {
    marginRight: 8,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65676b',
    marginBottom: 4,
  },
  messageBubble: {
    backgroundColor: '#e4e6eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '70%',
  },
  messageBubbleOwn: {
    backgroundColor: '#0084ff',
  },
  messageText: {
    fontSize: 14,
    color: '#000',
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  btnDelete: {
    marginLeft: 8,
    padding: 4,
  },
  btnDeleteText: {
    fontSize: 16,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#65676b',
    fontStyle: 'italic',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  btnSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSendDisabled: {
    backgroundColor: '#ccc',
  },
  btnSendText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
