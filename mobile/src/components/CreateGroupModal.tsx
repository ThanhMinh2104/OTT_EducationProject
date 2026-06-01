import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from '../utils/axios';

interface Contact {
  userID: string;
  name: string;
  anhDaiDien?: string;
  soDienThoai?: string;
  alias?: string;
}

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (groupID: string) => void;
  currentUser: any;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onGroupCreated,
  currentUser,
}) => {
  const [groupName, setGroupName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarUri, setAvatarUri] = useState<string>('');

  useEffect(() => {
    if (visible) {
      fetchContacts();
    }
  }, [visible]);

  const fetchContacts = async () => {
    try {
      const response = await axiosInstance.post('/contacts/friends', {});
      setContacts(response.data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  const handleToggleMember = (userID: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(userID)) {
      newSelected.delete(userID);
    } else {
      newSelected.add(userID);
    }
    setSelectedMembers(newSelected);
    setError('');
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Lỗi', 'Cần quyền truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setError('');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUri('');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedMembers.size < 2) {
      setError('Nhóm phải có ít nhất 3 thành viên (bao gồm bạn). Vui lòng chọn ít nhất 2 thành viên khác');
      return;
    }

    try {
      setLoading(true);

      let avatarUrl = null;
      if (avatarUri) {
        try {
          const formData = new FormData();
          const filename = avatarUri.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';

          formData.append('files', {
            uri: avatarUri,
            name: filename,
            type,
          } as any);

          const uploadResponse = await axiosInstance.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          avatarUrl = uploadResponse.data.urls?.[0];
        } catch (uploadErr: any) {
          console.error('Upload avatar error:', uploadErr);
          setError('Lỗi upload ảnh: ' + (uploadErr.response?.data?.message || uploadErr.message));
          setLoading(false);
          return;
        }
      }

      const response = await axiosInstance.post('/groups/create', {
        name: groupName,
        description: '',
        avatar: avatarUrl,
        memberIDs: Array.from(selectedMembers),
      });

      Alert.alert('Thành công', 'Tạo nhóm thành công! 🎉');
      onGroupCreated(response.data.group.groupID);
      handleClose();
    } catch (err: any) {
      console.error('Create group error:', err);
      const message = err.response?.data?.message || err.message || 'Lỗi tạo nhóm';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setSelectedMembers(new Set());
    setSearchText('');
    setError('');
    setAvatarUri('');
    onClose();
  };

  const filteredContacts = contacts.filter((contact) =>
    (contact.name || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const renderContact = ({ item }: { item: Contact }) => {
    const isSelected = selectedMembers.has(item.userID);
    return (
      <TouchableOpacity
        style={[styles.contactItem, isSelected && styles.contactItemSelected]}
        onPress={() => handleToggleMember(item.userID)}
        activeOpacity={0.7}
      >
        <Image
          source={{
            uri: item.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}`,
          }}
          style={styles.contactAvatar}
        />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.alias?.trim() ? item.alias : item.name}
          </Text>
          {item.soDienThoai && (
            <Text style={styles.contactPhone}>{item.soDienThoai}</Text>
          )}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const screenHeight = Dimensions.get('window').height;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContainer, { maxHeight: screenHeight * 0.85 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tạo nhóm mới</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="people" size={40} color="#ccc" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handlePickAvatar}
                >
                  <Ionicons name="camera" size={16} color="#fff" />
                </TouchableOpacity>
                {avatarUri && (
                  <TouchableOpacity
                    style={styles.removeAvatarButton}
                    onPress={handleRemoveAvatar}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.avatarHint}>Nhấn để chọn ảnh đại diện nhóm</Text>
            </View>

            {/* Group Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Tên nhóm</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tên nhóm"
                value={groupName}
                onChangeText={(text) => {
                  setGroupName(text);
                  setError('');
                }}
              />
            </View>

            {/* Error Message - hiển thị ở trên để dễ thấy */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Member Count */}
            <View style={styles.memberCount}>
              <Text style={styles.memberCountText}>
                Đã chọn: {selectedMembers.size}/2+ thành viên
              </Text>
              <Text style={styles.memberCountHint}>(Nhóm phải có ít nhất 3 người)</Text>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm thành viên..."
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* Selected Members Tags */}
            {selectedMembers.size > 0 && (
              <View style={styles.selectedTags}>
                {Array.from(selectedMembers).map((userID) => {
                  const contact = contacts.find((c) => c.userID === userID);
                  return (
                    <View key={userID} style={styles.tag}>
                      <Text style={styles.tagText}>{contact?.name}</Text>
                      <TouchableOpacity onPress={() => handleToggleMember(userID)}>
                        <Ionicons name="close-circle" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Contacts List */}
            <View style={styles.contactsList}>
              {filteredContacts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Không tìm thấy thành viên</Text>
                </View>
              ) : (
                filteredContacts.map((item) => {
                  const isSelected = selectedMembers.has(item.userID);
                  return (
                    <TouchableOpacity
                      key={item.userID}
                      style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                      onPress={() => handleToggleMember(item.userID)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{
                          uri: item.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}`,
                        }}
                        style={styles.contactAvatar}
                      />
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName} numberOfLines={1}>
                          {item.alias?.trim() ? item.alias : item.name}
                        </Text>
                        {item.soDienThoai && (
                          <Text style={styles.contactPhone}>{item.soDienThoai}</Text>
                        )}
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={handleCreateGroup}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.createButtonText}>Tạo nhóm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  removeAvatarButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 12,
    color: '#9ca3af',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  memberCount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  memberCountText: {
    fontSize: 13,
    color: '#6b7280',
  },
  memberCountHint: {
    fontSize: 11,
    color: '#9ca3af',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  contactsList: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  contactItemSelected: {
    backgroundColor: '#eff6ff',
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
  },
  contactPhone: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
