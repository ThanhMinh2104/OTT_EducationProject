import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';

interface Member {
  userID: string;
  name: string;
  avatar?: string;
  role?: 'owner' | 'admin' | 'member';
}

export type SpecialItem = 'all' | 'gif' | 'sticker' | 'bot';

interface MentionDropdownProps {
  visible: boolean;
  members: Member[];
  query: string;
  onSelect: (item: Member | SpecialItem) => void;
  onClose: () => void;
  alreadyMentionedIDs?: string[];
  allAlreadyMentioned?: boolean;
}

// @All luon o dau, @Bot @GIF @STICKER o cuoi (sau members)
const SPECIAL_TOP: { id: SpecialItem; label: string; sub: string; icon: string; color: string }[] = [
  { id: 'all', label: '@All', sub: 'Nhac ten moi nguoi trong nhom', icon: '@', color: '#0068ff' },
];

const SPECIAL_BOTTOM: { id: SpecialItem; label: string; sub: string; icon: string; color: string }[] = [
  { id: 'bot',     label: '@Bot',     sub: 'Hoi AI Bot',          icon: '🤖', color: '#6366f1' },
  { id: 'gif',     label: '@GIF',     sub: 'Tim va gui GIF',       icon: 'GIF', color: '#ff6b35' },
  { id: 'sticker', label: '@STICKER', sub: 'Tim va gui Sticker',   icon: '🎭', color: '#9b59b6' },
];

const MentionDropdown: React.FC<MentionDropdownProps> = ({
  visible,
  members,
  query,
  onSelect,
  alreadyMentionedIDs = [],
  allAlreadyMentioned = false,
}) => {
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [filteredSpecials, setFilteredSpecials] = useState<typeof SPECIAL_TOP>([...SPECIAL_TOP, ...SPECIAL_BOTTOM]);

  useEffect(() => {
    const lowerQuery = query.toLowerCase();

    // Filter members (bỏ đã tag)
    const available = members.filter(m => !alreadyMentionedIDs.includes(m.userID));
    if (!query) {
      setFilteredMembers(available.slice(0, 5));
    } else {
      setFilteredMembers(
        available.filter(m => (m.name || '').toLowerCase().includes(lowerQuery)).slice(0, 5)
      );
    }

    // Filter specials theo query
    const filterCmd = (list: typeof SPECIAL_TOP) =>
      list.filter(cmd => {
        if (cmd.id === 'all' && allAlreadyMentioned) return false;
        if (!query) return true;
        return cmd.label.toLowerCase().includes(lowerQuery) || cmd.id.startsWith(lowerQuery);
      });
    setFilteredSpecials([...filterCmd(SPECIAL_TOP), ...filterCmd(SPECIAL_BOTTOM)]);
  }, [query, members, alreadyMentionedIDs, allAlreadyMentioned]);

  if (!visible) return null;

  const topSpecials = filteredSpecials.filter(s => s.id === 'all');
  const bottomSpecials = filteredSpecials.filter(s => s.id !== 'all');

  const allData: any[] = [
    ...topSpecials.map(s => ({ ...s, _type: 'special' })),
    ...filteredMembers.map(m => ({ ...m, _type: 'member' })),
    ...bottomSpecials.map(s => ({ ...s, _type: 'special' })),
  ];

  if (allData.length === 0) return null;

  const getRoleBadge = (role?: string) => {
    if (role === 'owner') return <Text style={styles.roleBadge}>👑 Trưởng nhóm</Text>;
    if (role === 'admin') return <Text style={styles.roleBadge}>🛡️ Phó nhóm</Text>;
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.dropdown}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Nhắc tên / Lệnh</Text>
        </View>
        <FlatList
          data={allData}
          keyExtractor={(item, i) => item.id || item.userID || String(i)}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item._type === 'special') {
              return (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => onSelect(item.id as SpecialItem)}
                >
                  <View style={[styles.iconAvatar, { backgroundColor: item.color + '20' }]}>
                    <Text style={[styles.iconText, { color: item.color }]}>{item.icon}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: item.color }]}>{item.label}</Text>
                    <Text style={styles.sub}>{item.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            }

            // member
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => onSelect(item as Member)}
              >
                <Image
                  source={{ uri: item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}` }}
                  style={styles.avatar}
                />
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    {getRoleBadge(item.role)}
                  </View>
                  <Text style={styles.sub} numberOfLines={1}>
                    @{(item.name || '').toLowerCase().replace(/\s+/g, '')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e9ecef',
  },
  dropdown: {
    maxHeight: 260,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9ecef',
  },
  headerText: { fontSize: 12, fontWeight: '600', color: '#6c757d' },
  list: { maxHeight: 220 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f3f5',
    backgroundColor: '#fff',
  },
  iconAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: { fontSize: 16, fontWeight: '700' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    backgroundColor: '#e9ecef',
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '600', color: '#212529', marginRight: 6 },
  sub: { fontSize: 12, color: '#868e96' },
  roleBadge: {
    fontSize: 10,
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default MentionDropdown;
