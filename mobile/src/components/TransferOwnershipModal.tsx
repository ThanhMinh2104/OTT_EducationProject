import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../utils/config';

interface Member {
  userID: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
}

interface Props {
  visible: boolean;
  groupID: string;
  members: Member[];
  currentUserID: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferOwnershipModal: React.FC<Props> = ({
  visible,
  groupID,
  members,
  currentUserID,
  onClose,
  onSuccess,
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null);
  const [leaveAfterTransfer, setLeaveAfterTransfer] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  // Filter members (không bao gồm owner hiện tại)
  const eligibleMembers = members.filter(m => m.userID !== currentUserID);

  const filteredMembers = eligibleMembers.filter(m =>
    m.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleTransfer = async () => {
    if (!selectedUserID) {
      Alert.alert('Thông báo', 'Vui lòng chọn thành viên làm trưởng nhóm mới');
      return;
    }

    const selectedMember = members.find(m => m.userID === selectedUserID);
    if (!selectedMember) return;

    Alert.alert(
      'Xác nhận chuyển quyền',
      `Bạn có chắc muốn chuyển quyền trưởng nhóm cho ${selectedMember.name}?${
        leaveAfterTransfer ? '\n\nBạn sẽ tự động rời khỏi nhóm sau khi chuyển quyền.' : ''
      }`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: 'destructive',
          onPress: async () => {
            setIsTransferring(true);
            try {
              const token = await AsyncStorage.getItem('token');

              // 1. Chuyển quyền owner
              const transferRes = await fetch(
                `${API_URL}/api/groups/${groupID}/members/${selectedUserID}/role`,
                {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ role: 'owner' }),
                }
              );

              if (!transferRes.ok) {
                const error = await transferRes.json();
                throw new Error(error.message || 'Không thể chuyển quyền');
              }

              // 2. Nếu chọn rời nhóm, gọi API leave
              if (leaveAfterTransfer) {
                const leaveRes = await fetch(`${API_URL}/api/groups/${groupID}/leave`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                });

                if (!leaveRes.ok) {
                  const error = await leaveRes.json();
                  throw new Error(error.message || 'Không thể rời nhóm');
                }

                Alert.alert(
                  'Thành công',
                  `Đã chuyển quyền trưởng nhóm cho ${selectedMember.name} và rời khỏi nhóm`,
                  [{ text: 'OK', onPress: () => onSuccess() }]
                );
              } else {
                Alert.alert(
                  'Thành công',
                  `Đã chuyển quyền trưởng nhóm cho ${selectedMember.name}`,
                  [{ text: 'OK', onPress: () => onSuccess() }]
                );
              }

              onClose();
            } catch (error: any) {
              Alert.alert('Lỗi', error.message || 'Không thể thực hiện thao tác');
            } finally {
              setIsTransferring(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Chọn trưởng nhóm mới trước khi rời</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm"
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#888"
            />
          </View>

          {/* Member List */}
          <FlatList
            data={filteredMembers}
            keyExtractor={item => item.userID}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.memberItem}
                onPress={() => setSelectedUserID(item.userID)}
              >
                <View style={styles.radioButton}>
                  {selectedUserID === item.userID && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Image
                  source={{
                    uri:
                      item.avatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{item.name}</Text>
                  {item.role === 'admin' && (
                    <Text style={styles.memberRole}>Phó nhóm</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Không tìm thấy thành viên</Text>
              </View>
            }
            style={styles.list}
          />

          {/* Leave after transfer option */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setLeaveAfterTransfer(!leaveAfterTransfer)}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.optionTitle}>Rời nhóm trong im lặng</Text>
              <Text style={styles.optionSubtitle}>
                Chỉ trưởng/phó nhóm biết bạn rời nhóm.
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                leaveAfterTransfer && styles.toggleActive,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  leaveAfterTransfer && styles.toggleThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                (!selectedUserID || isTransferring) && styles.confirmButtonDisabled,
              ]}
              onPress={handleTransfer}
              disabled={!selectedUserID || isTransferring}
            >
              {isTransferring ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Chọn và tiếp tục</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  list: {
    maxHeight: 300,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0084ff',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  memberRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  optionLeft: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#0084ff',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  confirmButton: {
    backgroundColor: '#0084ff',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
