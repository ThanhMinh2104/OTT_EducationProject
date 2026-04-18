import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import './GroupList.css';

interface Group {
  groupID: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerID: string;
}

interface Contact {
  userID: string;
  name: string;
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGroups();
    fetchContacts();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      // Giả sử có endpoint để lấy danh sách contacts
      const response = await axiosInstance.get('/contacts');
      setContacts(response.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
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
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }

    if (selectedMembers.size < 2) {
      alert('Nhóm phải có ít nhất 3 thành viên (bao gồm bạn). Vui lòng chọn ít nhất 2 thành viên khác');
      return;
    }

    try {
      const response = await axiosInstance.post('/groups/create', {
        name: newGroupName,
        description: '',
        avatar: null,
        memberIDs: Array.from(selectedMembers),
      });

      setGroups([...groups, response.data.group]);
      setNewGroupName('');
      setSelectedMembers(new Set());
      setShowCreateModal(false);
      onSelectGroup(response.data.group.groupID);
    } catch (error: any) {
      console.error('Error creating group:', error);
      const message = error.response?.data?.message || 'Lỗi tạo nhóm';
      alert(message);
    }
  };

  return (
    <div className="group-list">
      <div className="group-list-header">
        <h3>Nhóm</h3>
        <button
          className="btn-create-group"
          onClick={() => setShowCreateModal(true)}
          title="Tạo nhóm mới"
        >
          +
        </button>
      </div>

      {loading ? (
        <div className="loading">Đang tải...</div>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa tham gia nhóm nào</p>
          <button onClick={() => setShowCreateModal(true)}>Tạo nhóm mới</button>
        </div>
      ) : (
        <div className="groups-container">
          {groups.map((group) => (
            <div
              key={group.groupID}
              className={`group-item ${selectedGroupID === group.groupID ? 'active' : ''}`}
              onClick={() => onSelectGroup(group.groupID)}
            >
              <div className="group-avatar">
                {group.avatar ? (
                  <img src={group.avatar} alt={group.name} />
                ) : (
                  <div className="avatar-placeholder">{group.name.charAt(0)}</div>
                )}
              </div>
              <div className="group-info">
                <h4>{group.name}</h4>
                {group.description && <p>{group.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Tạo nhóm mới</h3>
            <p style={{ fontSize: '12px', color: '#65676b', marginBottom: '12px' }}>
              Nhóm phải có ít nhất 3 thành viên (bao gồm bạn)
            </p>
            <input
              type="text"
              placeholder="Tên nhóm"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{ marginBottom: '12px' }}
            />

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#65676b' }}>
                Chọn thành viên ({selectedMembers.size}/2+)
              </label>
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '8px',
                  marginTop: '8px',
                }}
              >
                {contacts.map((contact) => (
                  <div
                    key={contact.userID}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleToggleMember(contact.userID)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.has(contact.userID)}
                      onChange={() => {}}
                      style={{ marginRight: '8px' }}
                    />
                    <span>{contact.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)}>Hủy</button>
              <button onClick={handleCreateGroup} className="btn-primary">
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
