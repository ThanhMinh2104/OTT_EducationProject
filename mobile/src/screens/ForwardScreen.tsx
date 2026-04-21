import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Forward'>;
  route: RouteProp<RootStackParamList, 'Forward'>;
};

interface Message {
  messageID?: string;
  content?: string;
  type: string;
  media_url?: string[];
}

interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: { userID: string; role: string }[];
}

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface ChatMember {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

const ForwardScreen = ({ navigation, route }: Props) => {
  const { message, chatID } = route.params as { message: Message; chatID: string };
  const [chats, setChats] = useState<Chat[]>([]);
  const [memberCache, setMemberCache] = useState<Record<string, ChatMember>>({});
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [selectedChatID, setSelectedChatID] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        // Lấy tất cả các chat của user
        await fetchAllChats(u.userID);
      }
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllChats = async (currentUserId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chats/userID`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: Chat[] = await response.json();
        // Lọc bỏ chat hiện tại ra khỏi danh sách
        const filteredChats = data.filter((c) => c.chatID !== chatID);
        setChats(filteredChats);

        // Fetch thông tin thành viên cho private chats
        const privateChats = filteredChats.filter((c) => c.type === 'private');
        await Promise.all(
          privateChats.map(async (c) => {
            const otherId = c.members.find((m) => m.userID !== currentUserId)?.userID;
            if (!otherId) return;
            try {
              const res = await fetch(`${API_URL}/api/usersID`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ userID: otherId }),
              });
              const info: ChatMember = await res.json();
              setMemberCache((prev) => ({ ...prev, [otherId]: info }));
            } catch (err) {
              console.error('Fetch member info error:', err);
            }
          })
        );
      }
    } catch (err) {
      console.error('Fetch chats error:', err);
    }
  };

  const getDisplayName = (chat: Chat): string => {
    if (chat.type === 'private') {
      const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
      if (otherId && memberCache[otherId]) return memberCache[otherId].name;
    }
    return chat.name;
  };

  const getDisplayAvatar = (chat: Chat): string => {
    if (chat.type === 'private') {
      const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
      if (otherId && memberCache[otherId]?.anhDaiDien) return memberCache[otherId].anhDaiDien;
    }
    return chat.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.chatID}`;
  };

  const handleForward = async () => {
    console.log('🚀 handleForward called!', {
      selectedChatID,
      messageID: message.messageID,
      userID: user?.userID,
      chatID,
    });

    if (!selectedChatID || !message.messageID || !user?.userID) {
      console.log('❌ Missing required data');
      Alert.alert('Lỗi', 'Vui lòng chọn cuộc trò chuyện');
      return;
    }

    // Determine target chat type
    const targetChat = chats.find((c) => c.chatID === selectedChatID);
    const isTargetGroup = targetChat?.type === 'group';
    
    // Determine source chat type from chatID
    // Group chat IDs start with 'grp_', private chat IDs start with 'chat_'
    const isSourceGroup = chatID?.startsWith('grp_');

    console.log('🔄 Forwarding message:', {
      originalMessageID: message.messageID,
      sourceChatID: chatID,
      targetChatID: selectedChatID,
      senderID: user.userID,
      isSourceGroup,
      isTargetGroup,
      socketConnected: socket.connected,
      socketID: socket.id,
    });

    if (!socket.connected) {
      console.log('❌ Socket not connected');
      Alert.alert('Lỗi', 'Mất kết nối. Vui lòng thử lại');
      return;
    }

    setForwarding(true);
    console.log('⏳ Forwarding state set to true');
    
    // Tạo timeout để tự động hiển thị thành công sau 2 giây nếu không có callback
    const timeoutId = setTimeout(() => {
      console.log('⏰ Forward timeout - assuming success');
      setForwarding(false);
      const selectedChat = chats.find((c) => c.chatID === selectedChatID);
      Alert.alert(
        'Đã gửi', 
        `Tin nhắn đang được chuyển tiếp tới ${getDisplayName(selectedChat!)}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }, 2000);
    
    // Prepare forward data
    const forwardData = {
      originalMessageID: message.messageID,
      originalChatID: isSourceGroup ? undefined : chatID,
      originalGroupID: isSourceGroup ? chatID : undefined,
      senderID: user.userID,
      senderInfo: {
        name: user.name,
        avatar: user.anhDaiDien || null,
      },
    };

    // Emit appropriate socket event based on target type
    if (isTargetGroup) {
      // Forward to group chat
      socket.emit(
        'forward_to_group',
        {
          ...forwardData,
          targetGroupID: selectedChatID,
        },
        (response: any) => {
          console.log('📥 Forward to group callback response:', response);
          
          clearTimeout(timeoutId);
          setForwarding(false);
          
          if (response?.success) {
            const selectedChat = chats.find((c) => c.chatID === selectedChatID);
            Alert.alert(
              'Thành công', 
              `Tin nhắn đã được chuyển tiếp tới nhóm ${getDisplayName(selectedChat!)}`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } else {
            Alert.alert('Lỗi', response?.error || 'Không thể chuyển tiếp tin nhắn');
          }
        }
      );
    } else {
      // Forward to private chat
      socket.emit(
        'forward_message',
        {
          ...forwardData,
          targetChatID: selectedChatID,
        },
        (response: any) => {
          console.log('📥 Forward to private callback response:', response);
          
          clearTimeout(timeoutId);
          setForwarding(false);
          
          if (response?.success) {
            const selectedChat = chats.find((c) => c.chatID === selectedChatID);
            Alert.alert(
              'Thành công', 
              `Tin nhắn đã được chuyển tiếp tới ${getDisplayName(selectedChat!)}`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          } else {
            Alert.alert('Lỗi', response?.error || 'Không thể chuyển tiếp tin nhắn');
          }
        }
      );
    }

    console.log(`✅ Forward message emitted to ${isTargetGroup ? 'group' : 'private'} chat`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0e9de8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Chuyển tiếp tới</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Message Preview */}
      <View style={styles.previewContainer}>
        <Text style={styles.previewLabel}>Tin nhắn gốc:</Text>
        <View style={styles.previewBox}>
          <Text style={styles.previewText} numberOfLines={2}>
            {message.content || '[Media]'}
          </Text>
          {message.media_url && message.media_url.length > 0 && (
            <Text style={styles.mediaCount}>+ {message.media_url.length} tệp đính kèm</Text>
          )}
        </View>
      </View>

      {/* Chat List */}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.chatID}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chatItem,
              selectedChatID === item.chatID && styles.chatItemSelected,
            ]}
            onPress={() => setSelectedChatID(item.chatID)}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: getDisplayAvatar(item) }}
              style={styles.avatar}
            />
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{getDisplayName(item)}</Text>
              <Text style={styles.chatType}>
                {item.type === 'private' ? 'Tin nhắn riêng' : 'Nhóm'}
              </Text>
            </View>
            {selectedChatID === item.chatID && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không có cuộc trò chuyện nào</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Footer with Forward Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.forwardButton,
            (!selectedChatID || forwarding) && styles.forwardButtonDisabled,
          ]}
          onPress={() => {
            console.log('🔘 Forward button pressed!', { 
              selectedChatID, 
              forwarding,
              disabled: !selectedChatID || forwarding 
            });
            handleForward();
          }}
          disabled={!selectedChatID || forwarding}
        >
          {forwarding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.forwardButtonText}>Chuyển tiếp</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0e9de8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  backBtn: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    width: 60,
  },

  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },

  previewContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  previewLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontWeight: '500',
  },

  previewBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0e9de8',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  previewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },

  mediaCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },

  listContent: {
    paddingVertical: 8,
  },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  chatItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#0e9de8',
    borderWidth: 2,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },

  chatInfo: {
    flex: 1,
  },

  chatName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },

  chatType: {
    fontSize: 12,
    color: '#999',
  },

  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0e9de8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyText: {
    fontSize: 14,
    color: '#999',
  },

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },

  forwardButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0e9de8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  forwardButtonDisabled: {
    backgroundColor: '#ccc',
  },

  forwardButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ForwardScreen;
