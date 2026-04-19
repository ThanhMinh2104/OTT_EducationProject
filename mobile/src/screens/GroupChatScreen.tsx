import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const hasFetchedRef = useRef(false); // Đảm bảo chỉ fetch 1 lần

  useEffect(() => {
    console.log('🔌 GroupChatScreen mounted:', { groupID, userID, userName });
    console.log('🔌 Socket initial status:', { connected: socket.connected, id: socket.id });
    
    // Fetch messages chỉ 1 lần
    if (!hasFetchedRef.current) {
      console.log('📥 First time fetching messages...');
      fetchMessages();
      hasFetchedRef.current = true;
    }
    
    // Đợi socket kết nối trước khi join group
    const joinGroup = () => {
      if (socket.connected) {
        console.log('✅ Socket already connected, joining group...');
        console.log('📡 Emitting join_group:', { groupID, userID });
        socket.emit('join_group', { groupID, userID });
      } else {
        console.log('⏳ Socket not connected, waiting...');
        socket.once('connect', () => {
          console.log('✅ Socket connected, now joining group...');
          console.log('📡 Emitting join_group:', { groupID, userID });
          socket.emit('join_group', { groupID, userID });
        });
        // Thử kết nối nếu chưa connect
        if (!socket.connected) {
          console.log('🔄 Attempting to connect socket...');
          socket.connect();
        }
      }
    };

    joinGroup();

    // Listen for socket events
    console.log('👂 Setting up event listeners for group:', groupID);
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

  // Debug: Log khi messages thay đổi
  useEffect(() => {
    console.log('📊 Messages updated, count:', messages.length);
    if (messages.length > 0) {
      console.log('📊 Last message:', messages[messages.length - 1]);
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching messages for group:', groupID);
      const response = await axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=50`);
      console.log('✅ Messages loaded:', response.data.messages?.length || 0);
      
      if (response.data.messages && Array.isArray(response.data.messages)) {
        setMessages(response.data.messages);
        console.log('📊 Set messages, count:', response.data.messages.length);
      } else {
        console.warn('⚠️ No messages array in response');
        setMessages([]);
      }
    } catch (error: any) {
      console.error('❌ Error fetching messages:', error.response?.data || error.message);
      Alert.alert('Lỗi', 'Không thể tải tin nhắn');
      setMessages([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = useCallback((message: Message) => {
    console.log('📨 Received new_group_message:', {
      messageID: message.messageID,
      groupID: message.groupID,
      content: message.content?.substring(0, 30),
      senderID: message.senderID,
    });
    console.log('🔍 Current groupID:', groupID);
    console.log('🔍 Match:', message.groupID === groupID);
    
    if (message.groupID === groupID) {
      setMessages((prev) => {
        // Kiểm tra xem tin nhắn đã tồn tại chưa (tránh duplicate)
        const exists = prev.some(msg => msg.messageID === message.messageID);
        if (exists) {
          console.log('⚠️ Message already exists, skipping:', message.messageID);
          return prev;
        }
        
        // Xóa tin nhắn tạm nếu có (optimistic update)
        const filtered = prev.filter(msg => !msg.messageID.startsWith('temp_'));
        console.log('✅ Adding new message:', message.messageID);
        console.log('📊 Messages count after add:', filtered.length + 1);
        return [...filtered, message];
      });
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else {
      console.log('❌ GroupID mismatch, not adding message');
    }
  }, [groupID]);

  const handleError = useCallback((data: any) => {
    console.error('❌ Socket error:', data);
    Alert.alert('Lỗi', data.message || 'Có lỗi xảy ra');
  }, []);

  const handleTypingStart = useCallback((data: any) => {
    if (data.groupID === groupID && data.userID !== userID) {
      setTypingUsers((prev) => new Set([...prev, data.userID]));
    }
  }, [groupID, userID]);

  const handleTypingStop = useCallback((data: any) => {
    if (data.groupID === groupID) {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.userID);
        return newSet;
      });
    }
  }, [groupID]);

  const handleMessageDeleted = useCallback((data: any) => {
    if (data.deleteForAll) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageID === data.messageID
            ? { ...msg, type: 'notification', content: 'Tin nhắn đã bị xóa' }
            : msg
        )
      );
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const messageContent = inputValue.trim();
    console.log('📤 Sending message:', {
      groupID,
      senderID: userID,
      content: messageContent,
      userName,
    });
    console.log('🔌 Socket status:', {
      connected: socket.connected,
      id: socket.id,
    });

    // Clear input ngay lập tức
    setInputValue('');

    const message = {
      groupID,
      senderID: userID,
      content: messageContent,
      type: 'text',
      media_url: [],
      senderInfo: {
        name: userName,
        avatar: userAvatar,
      },
    };

    // Emit socket event
    console.log('📡 Emitting send_group_message event...');
    socket.emit('send_group_message', message);
    console.log('✅ Event emitted');

    // Optimistic update - hiển thị tin nhắn tạm thời
    const tempMessageID = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage: Message = {
      messageID: tempMessageID,
      groupID,
      senderID: userID,
      content: messageContent,
      type: 'text',
      media_url: [],
      timestamp: new Date(),
      status: 'sending',
      senderInfo: {
        name: userName,
        avatar: userAvatar,
      },
    };
    
    console.log('⏳ Adding optimistic message:', tempMessageID);
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
        extraData={messages}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
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
