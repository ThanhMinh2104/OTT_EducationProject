import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../utils/config';

interface SearchResult {
  messageID: string;
  senderID: string;
  content?: string;
  timestamp: string;
  senderInfo: { name: string; avatar?: string | null };
}

interface Member {
  userID: string;
  name: string;
  avatar?: string;
}

interface Props {
  chatID: string;
  chatType: 'private' | 'group';
  members?: Member[];
  currentUserID?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  topInset?: number;
  onClose: () => void;
  onScrollToMessage: (messageID: string) => void;
}

const MessageSearchPanel: React.FC<Props> = ({
  chatID,
  chatType,
  members = [],
  currentUserID,
  currentUserName,
  currentUserAvatar,
  topInset = 0,
  onClose,
  onScrollToMessage,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSender, setSelectedSender] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSenderPicker, setShowSenderPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const doSearch = useCallback(
    async (q: string, sender: string) => {
      if (!q.trim() && !sender) {
        setResults([]);
        setCurrentIndex(0);
        return;
      }
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const params = new URLSearchParams();
        if (chatType === 'group') {
          if (q.trim()) params.set('q', q.trim());
        } else {
          if (q.trim()) params.set('keyword', q.trim());
          params.set('chatID', chatID);
        }
        if (sender) params.set('senderID', sender);

        const endpoint =
          chatType === 'group'
            ? `${API_URL}/api/groups/${chatID}/search?${params}`
            : `${API_URL}/api/messages/search?${params}`;

        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const list: SearchResult[] = Array.isArray(data) ? data : [];
        setResults(list);
        setCurrentIndex(0);
        if (list.length > 0) {
          onScrollToMessage(list[0].messageID);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [chatID, chatType],
  );

  const triggerSearch = (q: string, sender: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q, sender), 400);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    triggerSearch(val, selectedSender);
  };

  const handleSenderSelect = (uid: string) => {
    setSelectedSender(uid);
    setShowSenderPicker(false);
    triggerSearch(query, uid);
  };

  // results[0] = mới nhất (backend sort -1)
  // ↑ lên = cũ hơn → index tăng
  // ↓ xuống = mới hơn → index giảm
  const handleUp = () => {
    if (results.length === 0) return;
    const next = (currentIndex + 1) % results.length;
    setCurrentIndex(next);
    onScrollToMessage(results[next].messageID);
  };

  const handleDown = () => {
    if (results.length === 0) return;
    const next = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(next);
    onScrollToMessage(results[next].messageID);
  };

  // Tin mới nhất = results.length, cũ nhất = 1
  const displayNumber = results.length - currentIndex;
  const selectedSenderInfo = members.find(m => m.userID === selectedSender);

  const getMemberDisplayName = (m: Member) =>
    m.userID === currentUserID
      ? `Bạn (${currentUserName || m.name})`
      : m.name;

  const getMemberAvatar = (m: Member) =>
    m.userID === currentUserID ? (currentUserAvatar || m.avatar) : m.avatar;

  return (
    <View style={[styles.wrapper, { paddingTop: topInset + 6 }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={14} color="#aaa" style={{ marginRight: 5 }} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Tìm kiếm..."
            placeholderTextColor="#bbb"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query, selectedSender)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Ionicons name="close-circle" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Result bar */}
      <View style={styles.resultBar}>
        {/* Sender filter */}
        <TouchableOpacity
          style={[styles.iconBtn, selectedSender ? styles.iconBtnActive : null]}
          onPress={() => setShowSenderPicker(true)}
        >
          {selectedSenderInfo?.avatar ? (
            <Image source={{ uri: selectedSenderInfo.avatar }} style={styles.senderAvatar} />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={22}
              color={selectedSender ? '#0068ff' : '#888'}
            />
          )}
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {loading ? (
          <ActivityIndicator size="small" color="#555" style={{ marginRight: 8 }} />
        ) : results.length > 0 ? (
          <Text style={styles.countText}>
            Kết quả thứ {displayNumber}/{results.length}
          </Text>
        ) : query.length > 0 ? (
          <Text style={styles.countText}>Không tìm thấy</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.navBtn, results.length === 0 && styles.navBtnDisabled]}
          onPress={handleUp}
          disabled={results.length === 0}
        >
          <Ionicons name="chevron-up" size={20} color={results.length > 0 ? '#333' : '#ccc'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, results.length === 0 && styles.navBtnDisabled]}
          onPress={handleDown}
          disabled={results.length === 0}
        >
          <Ionicons name="chevron-down" size={20} color={results.length > 0 ? '#333' : '#ccc'} />
        </TouchableOpacity>
      </View>

      {/* Sender picker bottom sheet */}
      <Modal
        visible={showSenderPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSenderPicker(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowSenderPicker(false)}
        >
          <View
            style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Lọc theo người gửi</Text>
            <ScrollView>
              <TouchableOpacity
                style={[styles.sheetItem, !selectedSender && styles.sheetItemSelected]}
                onPress={() => handleSenderSelect('')}
              >
                <View style={[styles.sheetAvatar, { backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="people" size={16} color="#666" />
                </View>
                <Text style={[styles.sheetItemText, !selectedSender && styles.sheetItemTextSelected]}>
                  Tất cả
                </Text>
                {!selectedSender && (
                  <Ionicons name="checkmark" size={18} color="#0068ff" style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
              {members.map(m => (
                <TouchableOpacity
                  key={m.userID}
                  style={[styles.sheetItem, selectedSender === m.userID && styles.sheetItemSelected]}
                  onPress={() => handleSenderSelect(m.userID)}
                >
                  {getMemberAvatar(m) ? (
                    <Image source={{ uri: getMemberAvatar(m) }} style={styles.sheetAvatar} />
                  ) : (
                    <View style={[styles.sheetAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>{getMemberDisplayName(m)[0]}</Text>
                    </View>
                  )}
                  <Text style={[styles.sheetItemText, selectedSender === m.userID && styles.sheetItemTextSelected]}>
                    {getMemberDisplayName(m)}
                  </Text>
                  {selectedSender === m.userID && (
                    <Ionicons name="checkmark" size={18} color="#0068ff" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { backgroundColor: '#0068ff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
  },
  backBtn: { padding: 4 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  input: { flex: 1, fontSize: 15, color: '#111', padding: 0 },
  resultBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 4,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f0f0f5',
  },
  iconBtnActive: { backgroundColor: '#e8f0fe' },
  senderAvatar: { width: 26, height: 26, borderRadius: 13 },
  countText: { fontSize: 13, color: '#555', marginRight: 4 },
  navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.3 },
  sheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    maxHeight: '65%', paddingTop: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16, fontWeight: '600', color: '#111',
    paddingHorizontal: 16, marginBottom: 8,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 16, paddingVertical: 11,
  },
  sheetItemSelected: { backgroundColor: '#f0f5ff' },
  sheetAvatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { backgroundColor: '#0068ff', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetItemText: { fontSize: 15, color: '#222' },
  sheetItemTextSelected: { color: '#0068ff', fontWeight: '600' },
});

export default MessageSearchPanel;
