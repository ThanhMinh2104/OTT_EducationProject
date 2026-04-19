import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Friend {
  userID: string;
  name: string;
  avatar?: string;
}

interface Props {
  visible: boolean;
  friends: Friend[];
  isLoading?: boolean;
  onClose: () => void;
  onAdd: (selectedUserIDs: string[]) => void;
}

const AddMembersModal = ({ visible, friends, isLoading = false, onClose, onAdd }: Props) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIDs, setSelectedUserIDs] = useState<Set<string>>(new Set());

  console.log('🎯 AddMembersModal render:', {
    visible,
    friendsCount: friends.length,
    isLoading,
    friends: friends.slice(0, 3), // Log first 3 friends
  });

  const filteredFriends = friends.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  console.log('🔍 Filtered friends:', filteredFriends.length);

  const toggleSelect = (userID: string) => {
    const newSelected = new Set(selectedUserIDs);
    if (newSelected.has(userID)) {
      newSelected.delete(userID);
    } else {
      newSelected.add(userID);
    }
    setSelectedUserIDs(newSelected);
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedUserIDs));
    setSelectedUserIDs(new Set());
    setSearchQuery('');
  };

  const handleClose = () => {
    setSelectedUserIDs(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thêm thành viên</Text>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm liên hệ..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
          </View>

          {/* Friends List */}
          <ScrollView 
            style={styles.friendsList}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Đang tải danh sách bạn bè...</Text>
              </View>
            ) : filteredFriends.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Không tìm thấy bạn bè' : 'Không có bạn bè nào để thêm'}
                </Text>
              </View>
            ) : (
              <>
                {console.log('🎨 Rendering friends list, count:', filteredFriends.length)}
                {filteredFriends.map((friend, index) => {
                  console.log(`🎨 Rendering friend ${index}:`, friend);
                  return (
                    <TouchableOpacity
                      key={friend.userID}
                      style={styles.friendItem}
                      onPress={() => toggleSelect(friend.userID)}
                    >
                      <View style={styles.checkbox}>
                        {selectedUserIDs.has(friend.userID) && (
                          <Ionicons name="checkmark" size={18} color="#0068ff" />
                        )}
                      </View>
                      <Image
                        source={{
                          uri: friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.userID}`,
                        }}
                        style={styles.friendAvatar}
                      />
                      <Text style={styles.friendName}>{friend.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.addButton,
                selectedUserIDs.size === 0 && styles.addButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={selectedUserIDs.size === 0}
            >
              <Text style={styles.addButtonText}>Thêm ({selectedUserIDs.size})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    height: '80%', // Thay maxHeight bằng height cố định
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex', // Thêm display flex
    flexDirection: 'column', // Thêm flexDirection
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchInput: {
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  friendsList: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 200, // Thêm minHeight
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d0d0d0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  addButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#0068ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AddMembersModal;
