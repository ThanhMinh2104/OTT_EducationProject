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
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUser(u);
        // Lấy thông tin các thành viên trong chat hiện tại
        fetchChatMembers(chatID, u.userID);
      }
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMembers = async (chatId: string, currentUserId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/chat/${chatId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Lọc bỏ chính mình ra khỏi danh sách
        const filteredMembers = data.members.filter((m: ChatMember) => m.userID !== currentUserId);
        setMembers(filteredMembers);
      }
    } catch (err) {
      console.error('Fetch members error:', err);
    }
  };

  const handleForward = async (targetMember: ChatMember) => {
    if (!message.messageID || !user?.userID) {
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn này');
      return;
    }

    setForwarding(true);
    try {
      // Tìm hoặc tạo chat riêng với thành viên này
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/createChat1-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userID2: targetMember.userID,
        }),
      });

      if (response.ok) {
        const chatData = await response.json();
        const targetChatID = chatData.chatID;
        
        socket.emit('forward_message', {
          originalMessageID: message.messageID,
          targetChatID,
          senderID: user.userID,
          senderInfo: {
            name: user.name,
            avatar: user.anhDaiDien || null,
          },
        });

        Alert.alert('Thành công', `Tin nhắn đã được chuyển tiếp tới ${targetMember.name}`);
        navigation.goBack();
      } else {
        Alert.alert('Lỗi', 'Không thể tạo cuộc trò chuyện');
      }
    } catch (err) {
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn');
      console.error('Forward error:', err);
    } finally {
      setForwarding(false);
    }
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
        data={members}
        keyExtractor={(item) => item.userID}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => handleForward(item)}
            disabled={forwarding}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: item.anhDaiDien || `https://api.dicebear.com/7.x/identicon/svg?seed=${item.userID}` }}
              style={styles.avatar}
            />
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatType}>Thành viên trong nhóm</Text>
            </View>
            {forwarding && (
              <ActivityIndicator size="small" color="#0e9de8" />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không có thành viên nào khác trong nhóm</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
});

export default ForwardScreen;
