import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../utils/axios';
import { API_URL } from '../utils/config';

interface EditGroupInfoModalProps {
  visible: boolean;
  groupID: string;
  currentName: string;
  currentAvatar?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditGroupInfoModal: React.FC<EditGroupInfoModalProps> = ({
  visible,
  groupID,
  currentName,
  currentAvatar,
  onClose,
  onSuccess,
}) => {
  const [groupName, setGroupName] = useState(currentName);
  const [avatarUri, setAvatarUri] = useState<string | undefined>(currentAvatar);
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State cho preview ảnh trước khi xác nhận
  const [pendingImageUri, setPendingImageUri] = useState<string | undefined>(undefined);
  const [pendingImageFile, setPendingImageFile] = useState<any>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Thông báo', 'Bạn cần cấp quyền truy cập thư viện ảnh');
        return;
      }

      // Bỏ allowsEditing để tránh native cropper bị lỗi trên Android
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Kiểm tra kích thước file (max 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Lỗi', 'Kích thước ảnh không được vượt quá 5MB');
          return;
        }

        // Hiển thị preview để người dùng xác nhận
        setPendingImageUri(asset.uri);
        setPendingImageFile({
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `avatar_${Date.now()}.jpg`,
        });
        setShowImagePreview(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const handleConfirmImage = () => {
    // Người dùng xác nhận ảnh
    setAvatarUri(pendingImageUri);
    setAvatarFile(pendingImageFile);
    setShowImagePreview(false);
    setPendingImageUri(undefined);
    setPendingImageFile(null);
  };

  const handleCancelImage = () => {
    // Người dùng hủy chọn ảnh
    setShowImagePreview(false);
    setPendingImageUri(undefined);
    setPendingImageFile(null);
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Tên nhóm không được để trống');
      return;
    }

    setIsUploading(true);
    try {
      let avatarUrl = currentAvatar;

      // Upload avatar nếu có thay đổi
      if (avatarFile) {
        const token = await AsyncStorage.getItem('token');
        const formData = new FormData();
        // React Native yêu cầu append object với uri/name/type
        formData.append('files', {
          uri: avatarFile.uri,
          name: avatarFile.name || `avatar_${Date.now()}.jpg`,
          type: avatarFile.type || 'image/jpeg',
        } as any);

        const uploadRes = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Upload ảnh thất bại');
        }

        const uploadData = await uploadRes.json();
        if (uploadData.urls && uploadData.urls.length > 0) {
          avatarUrl = uploadData.urls[0];
        }
      }

      // Cập nhật thông tin nhóm
      await axiosInstance.put(`/groups/${groupID}`, {
        name: groupName.trim(),
        avatar: avatarUrl,
      });

      Alert.alert('Thành công', 'Đã cập nhật thông tin nhóm');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating group info:', error);
      Alert.alert('Lỗi', error.response?.data?.message || error.message || 'Lỗi khi cập nhật thông tin nhóm');
    } finally {
      setIsUploading(false);
    }
  };

  // Modal xác nhận ảnh
  if (showImagePreview && pendingImageUri) {
    return (
      <Modal visible={true} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.previewContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Xác nhận ảnh đại diện</Text>
            </View>

            <View style={styles.previewImageWrapper}>
              <Image
                source={{ uri: pendingImageUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.previewHint}>Sử dụng ảnh này làm ảnh đại diện nhóm?</Text>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancelImage}
              >
                <Text style={styles.cancelButtonText}>Chọn lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleConfirmImage}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chỉnh sửa thông tin nhóm</Text>
            <TouchableOpacity onPress={onClose} disabled={isUploading}>
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri: avatarUri || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupID}`,
                  }}
                  style={styles.avatar}
                />
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handlePickImage}
                  disabled={isUploading}
                >
                  <Ionicons name="camera" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              {avatarFile && (
                <View style={styles.avatarChangedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                  <Text style={styles.avatarChangedText}>Ảnh mới đã được chọn</Text>
                </View>
              )}
              <Text style={styles.avatarHint}>Nhấn vào icon camera để thay đổi ảnh</Text>
            </View>

            {/* Group Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Tên nhóm</Text>
              <TextInput
                style={styles.input}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Nhập tên nhóm..."
                placeholderTextColor="#9ca3af"
                maxLength={100}
                editable={!isUploading}
              />
              <Text style={styles.charCount}>{groupName.length}/100 ký tự</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isUploading}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                (isUploading || !groupName.trim()) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isUploading || !groupName.trim()}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                </>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  previewContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  previewImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewHint: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#60a5fa',
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
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  avatarChangedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  avatarChangedText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
