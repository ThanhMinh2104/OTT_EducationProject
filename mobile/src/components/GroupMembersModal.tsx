import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';
import AddMembersModal from './AddMembersModal';

interface Member {
  userID: string;
  name?: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
}

interface Props {
  visible: boolean;
  members: Member[];
  memberCount: number;
  groupID?: string; // Thêm groupID
  onClose: () => void;
  onAddMembers?: () => void;
  onRefresh?: () => void; // Thêm callback để refresh
}

const GroupMembersModal = ({ visible, members, memberCount, groupID, onClose, onAddMembers, onRefresh }: Props) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<Array<{
    userID: string;
    name: string;
    avatar?: string;
  }>>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  const filteredMembers = members.filter(m =>
    (m.name || m.userID).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch danh sách bạn bè chưa có trong nhóm
  useEffect(() => {
    const fetchAvailableFriends = async () => {
      if (!showAddMembersModal) return;
      
      setIsLoadingFriends(true);
      try {
        const token = await AsyncStorage.getItem('token');
        
        // Fetch danh sách contacts - sử dụng POST /api/contacts/friends
        const contactsRes = await fetch(`${API_URL}/api/contacts/friends`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
        });
        
        if (!contactsRes.ok) {
          throw new Error('Failed to fetch contacts');
        }
        
        const contactsData = await contactsRes.json();
        
        // Lọc ra những bạn bè chưa có trong nhóm
        const memberUserIDs = new Set(members.map(m => m.userID));
        const availableFriendsList = contactsData
          .filter((contact: any) => !memberUserIDs.has(contact.userID))
          .map((contact: any) => ({
            userID: contact.userID,
            name: contact.alias || contact.name || contact.userID,
            avatar: contact.anhDaiDien,
          }));
        
        setAvailableFriends(availableFriendsList);
      } catch (error) {
        console.error('Error fetching friends:', error);
        setAvailableFriends([]);
      } finally {
        setIsLoadingFriends(false);
      }
    };
    
    fetchAvailableFriends();
  }, [showAddMembersModal, members]);

  const getRoleName = (role: string) => {
    if (role === 'owner') return 'Trưởng nhóm';
    if (role === 'admin') return 'Phó nhóm';
    return 'Thành viên';
  };

  const getRoleColor = (role: string) => {
    if (role === 'owner') return '#ff3b30';
    if (role === 'admin') return '#ff9500';
    return '#888';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thành viên ({memberCount})</Text>
          <View style={styles.headerButton} />
        </View>

        {/* Nút thêm thành viên */}
        {onAddMembers && (
          <View style={styles.addButtonContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddMembersModal(true)}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Thêm thành viên</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm thành viên..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#888"
          />
        </View>

        {/* Danh sách thành viên */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            Danh sách thành viên ({filteredMembers.length})
          </Text>
        </View>

        <ScrollView style={styles.memberList}>
          {filteredMembers.map((member) => (
            <View key={member.userID} style={styles.memberItem}>
              <Image
                source={{
                  uri: member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userID}`,
                }}
                style={styles.memberAvatar}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name || member.userID}</Text>
                <Text style={[styles.memberRole, { color: getRoleColor(member.role) }]}>
                  {getRoleName(member.role)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Add Members Modal */}
        <AddMembersModal
          visible={showAddMembersModal}
          friends={availableFriends}
          isLoading={isLoadingFriends}
          onClose={() => setShowAddMembersModal(false)}
          onAdd={async (selectedUserIDs) => {
            setShowAddMembersModal(false);
            if (selectedUserIDs.length > 0 && groupID) {
              try {
                console.log('➕ Adding members to group:', groupID, selectedUserIDs);
                const token = await AsyncStorage.getItem('token');
                
                // Add members one by one
                const results = await Promise.allSettled(
                  selectedUserIDs.map(async (userID) => {
                    const response = await fetch(
                      `${API_URL}/api/groups/${groupID}/members`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ userID }),
                      }
                    );
                    
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.message || 'Failed to add member');
                    }
                    
                    return response.json();
                  })
                );
                
                const successCount = results.filter(r => r.status === 'fulfilled').length;
                const failCount = results.filter(r => r.status === 'rejected').length;
                
                if (successCount > 0) {
                  Alert.alert(
                    'Thành công',
                    `Đã thêm ${successCount} thành viên vào nhóm${failCount > 0 ? `. ${failCount} thất bại.` : ''}`
                  );
                  // Refresh data
                  if (onRefresh) onRefresh();
                } else {
                  Alert.alert('Lỗi', 'Không thể thêm thành viên vào nhóm');
                }
              } catch (error) {
                console.error('❌ Error adding members:', error);
                Alert.alert('Lỗi', 'Không thể thêm thành viên vào nhóm');
              }
            }
          }}
        />
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  addButtonContainer: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#0068ff',
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 14,
    color: '#111',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  memberList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
  },
});

export default GroupMembersModal;
