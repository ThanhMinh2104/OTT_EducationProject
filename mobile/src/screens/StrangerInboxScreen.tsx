import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import socket from '../utils/socket';

interface Message {
  content?: string;
  type: string;
  timestamp: string;
  senderID: string;
}

interface Chat {
  chatID: string;
  name: string;
  avatar?: string;
  lastMessage: Message[];
  unreadCount?: number;
  members: { userID: string }[];
}

import { StackScreenProps } from '@react-navigation/stack';

type Props = StackScreenProps<RootStackParamList, 'StrangerInbox'>;

const StrangerInboxScreen = ({ navigation }: Props) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const fetchStrangers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/chats/strangers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setChats(data.sort((a, b) => {
          const aT = a.lastMessage?.[0]?.timestamp || 0;
          const bT = b.lastMessage?.[0]?.timestamp || 0;
          return new Date(bT).getTime() - new Date(aT).getTime();
        }));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    AsyncStorage.getItem('user').then(u => u && setUser(JSON.parse(u)));
    fetchStrangers();

    socket.on('new_message', fetchStrangers);
    socket.on('newChat1-1', fetchStrangers);

    return () => {
      socket.off('new_message', fetchStrangers);
      socket.off('newChat1-1', fetchStrangers);
    };
  }, []);

  const getChatAvatar = (chat: Chat) => {
    if (chat.avatar) return { uri: chat.avatar };
    const otherId = chat.members.find(m => m.userID !== user?.userID)?.userID;
    return { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId || chat.chatID}` };
  };

  const getPreview = (chat: Chat) => {
    const last = chat.lastMessage?.[0];
    if (!last) return 'Chưa có tin nhắn';
    return last.type === 'text' ? last.content : `[${last.type}]`;
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tin nhắn từ người lạ</Text>
      </View>

      <View style={s.banner}>
        <Text style={s.bannerText}>
          Các tin nhắn này đến từ người lạ chưa có trong danh bạ của bạn.
        </Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#0068ff" /></View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.chatID}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.chatItem}
              onPress={() => navigation.navigate('Chat' as any, { selectedChat: item })}
            >
              <Image source={getChatAvatar(item)} style={s.avatar} />
              <View style={s.info}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.preview} numberOfLines={1}>{getPreview(item)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="mail-unread-outline" size={48} color="#ddd" />
              <Text style={s.emptyText}>Không có tin nhắn nào từ người lạ</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0068ff', paddingHorizontal: 8, paddingVertical: 12,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  banner: { backgroundColor: '#f0f7ff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  bannerText: { fontSize: 13, color: '#4b5563', lineHeight: 18 },
  chatItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#f0f0f0' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  preview: { fontSize: 13, color: '#888' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#aaa', marginTop: 12 },
});

export default StrangerInboxScreen;
