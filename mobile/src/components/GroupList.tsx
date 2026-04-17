import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';

interface Group {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
}

interface GroupListProps {
  onSelectGroup: (groupID: string) => void;
  selectedGroupID?: string;
}

export const GroupList: React.FC<GroupListProps> = ({ onSelectGroup, selectedGroupID }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách nhóm');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm');
      return;
    }

    try {
      const response = await axiosInstance.post('/groups/create', {
        name: newGroupName,
        description: '',
        avatar: null,
        memberIDs: [],
      });

      setGroups([...groups, response.data.group]);
      setNewGroupName('');
      setShowCreateModal(false);
      onSelectGroup(response.data.group.groupID);
    } catch (error: any) {
      console.error('Error creating group:', error);
      const message = error.response?.data?.message || 'Không thể tạo nhóm';
      Alert.alert('Lỗi', message);
    }
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={[
        styles.groupItem,
        selectedGroupID === item.groupID && styles.groupItemActive,
      ]}
      onPress={() => onSelectGroup(item.groupID)}
    >
      <View style={styles.groupAvatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.groupDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nhóm</Text>
        <TouchableOpacity
          style={styles.btnCreate}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.btnCreateText}>+</Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Bạn chưa tham gia nhóm nào</Text>
          <TouchableOpacity
            style={styles.btnCreateGroup}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.btnCreateGroupText}>Tạo nhóm mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={(item) => item.groupID}
          scrollEnabled={true}
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tạo nhóm mới</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Tên nhóm"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirm}
                onPress={handleCreateGroup}
              >
                <Text style={styles.btnConfirmText}>Tạo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  btnCreate: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCreateText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
  },
  groupItemActive: {
    backgroundColor: '#e7f3ff',
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 12,
    color: '#65676b',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#65676b',
    marginBottom: 16,
  },
  btnCreateGroup: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0084ff',
    borderRadius: 6,
  },
  btnCreateGroupText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e4e6eb',
    borderRadius: 6,
  },
  btnCancelText: {
    color: '#000',
    fontWeight: '600',
  },
  btnConfirm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0084ff',
    borderRadius: 6,
  },
  btnConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
