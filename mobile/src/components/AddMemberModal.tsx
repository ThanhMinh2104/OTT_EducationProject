import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../utils/axios';

interface Contact {
  userID: string;
  name: string;
  avatar?: string;
}

interface AddMemberModalProps {
  visible: boolean;
  groupID: string;
  currentMembers: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  visible,
  groupID,
  currentMembers,
  onClose,
  onSuccess,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (visible) {
      console.log('✅ Modal opened, fetching contacts...');
      fetchContacts();
      setSelectedMembers([]);
      setSearchQuery('');
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = contacts.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      console.log('📞 Calling /contacts API...');
      const response = await axiosInstance.get('/contacts');
      console.log('📦 Response received:', response.data);
      
      const rawContacts = response.data.contacts || [];
      console.log('📋 Raw contacts count:', rawContacts.length);
      
      // Map to Contact interface
      const mappedContacts: Contact[] = rawContacts.map((c: any) => {
        const contact = {
          userID: c.userID,
          name: c.name || c.alias || c.userID,
          avatar: c.anhDaiDien || c.avatar,
        };
        console.log('🔄 Mapped contact:', contact);
        return contact;
      });
      
      console.log('✅ Total mapped contacts:', mappedContacts.length);
      console.log('🚫 Current members to filter:', currentMembers);
      
      // Filter out current members
      const availableContacts = mappedContacts.filter(
        (c) => !currentMembers.includes(c.userID)
      );
      
      console.log('✅ Available contacts after filter:', availableContacts.length);
      console.log('📝 Available contacts:', availableContacts);
      
      setContacts(availableContacts);
      setFilteredContacts(availableContacts);
    } catch (error: any) {
      console.error('❌ Error fetching contacts:', error);
      console.error('❌ Error details:', error.response?.data);
      Alert.alert('Lỗi', 'Không thể tải danh sách liên hệ');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectMember = (userID: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userID)
        ? prev.filter((id) => id !== userID)
        : [...prev, userID]
    );
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn ít nhất một thành viên');
      return;
    }

    setAdding(true);
    try {
      await Promise.all(
        selectedMembers.map((userID) =>
          axiosInstance.post(`/groups/${groupID}/members`, { userID })
        )
      );

      Alert.alert(
        'Thành công',
        `Đã thêm ${selectedMembers.length} thành viên vào nhóm`
      );
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding members:', error);
      Alert.alert(
        'Lỗi',
        error.response?.data?.message || 'Không thể thêm thành viên'
      );
    } finally {
      setAdding(false);
    }
  };

  const renderContactItem = ({ item }: { item: Contact }) => {
    const isSelected = selectedMembers.includes(item.userID);

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => toggleSelectMember(item.userID)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Image
          source={{
            uri:
              item.avatar ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}`,
          }}
          style={styles.contactAvatar}
        />
        <Text style={styles.contactName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  console.log('🎨 Rendering modal with:', {
    visible,
    loading,
    contactsCount: contacts.length,
    filteredCount: filteredContacts.length,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={adding}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thêm thành viên</Text>
          <TouchableOpacity
            onPress={handleAddMembers}
            disabled={selectedMembers.length === 0 || adding}
          >
            {adding ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : (
              <Text
                style={[
                  styles.addButton,
                  selectedMembers.length === 0 && styles.addButtonDisabled,
                ]}
              >
                Thêm
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={18}
            color="#9ca3af"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm liên hệ..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!adding}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected count */}
        {selectedMembers.length > 0 && (
          <View style={styles.selectedBanner}>
            <Text style={styles.selectedText}>
              Đã chọn {selectedMembers.length} thành viên
            </Text>
          </View>
        )}

        {/* Section Header */}
        {!loading && filteredContacts.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Bạn bè chưa tham gia nhóm ({filteredContacts.length})
            </Text>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Đang tải danh sách...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#6b7280" />
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Không tìm thấy liên hệ'
                : 'Không có bạn bè nào để thêm vào nhóm'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? 'Thử tìm kiếm với từ khóa khác'
                : 'Tất cả bạn bè đã là thành viên nhóm'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.userID}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Không có dữ liệu</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2f35',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    fontSize: 15,
    fontWeight: '600',
    color: '#60a5fa',
  },
  addButtonDisabled: {
    color: '#6b7280',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    paddingVertical: 4,
  },
  selectedBanner: {
    backgroundColor: '#1e40af',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  selectedText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1f2937',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#d1d5db',
    textAlign: 'center',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6b7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#60a5fa',
    borderColor: '#60a5fa',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  contactName: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
});
