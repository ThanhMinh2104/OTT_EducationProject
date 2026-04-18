import { useState, useEffect } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import './CreateGroupModal.css';

interface Contact {
  userID: string;
  name: string;
  anhDaiDien?: string;
  sdt?: string;
  alias?: string;
}

interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated: (groupID: string) => void;
  currentUser: any;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
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

  useEffect(() => {
    fetchContacts();
  }, []);

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
      const response = await axiosInstance.post('/groups/create', {
        name: groupName,
        description: '',
        avatar: null,
        memberIDs: Array.from(selectedMembers),
      });

      onGroupCreated(response.data.group.groupID);
      onClose();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Lỗi tạo nhóm';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="create-group-modal-overlay" onClick={onClose}>
      <div className="create-group-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="create-group-modal-header">
          <h3>Tạo nhóm mới</h3>
          <button className="btn-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="create-group-modal-body">
          {/* Group Name Input */}
          <div className="form-group">
            <label>Tên nhóm</label>
            <input
              type="text"
              placeholder="Nhập tên nhóm"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError('');
              }}
              className="form-input"
            />
          </div>

          {/* Member Count Info */}
          <div className="member-count-info">
            <span>Đã chọn: {selectedMembers.size}/2+ thành viên</span>
            <span className="text-xs text-gray-500">(Nhóm phải có ít nhất 3 người)</span>
          </div>

          {/* Search Contacts */}
          <div className="search-contacts">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Selected Members Tags */}
          {selectedMembers.size > 0 && (
            <div className="selected-members-tags">
              {Array.from(selectedMembers).map((userID) => {
                const contact = contacts.find((c) => c.userID === userID);
                return (
                  <div key={userID} className="member-tag">
                    <span>{contact?.name}</span>
                    <button
                      onClick={() => handleToggleMember(userID)}
                      className="tag-remove-btn"
                    >
                      <FaTimes />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contacts List */}
          <div className="contacts-list">
            {filteredContacts.length === 0 ? (
              <div className="empty-contacts">
                <p>Không tìm thấy thành viên</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.userID}
                  className={`contact-item ${selectedMembers.has(contact.userID) ? 'selected' : ''}`}
                  onClick={() => handleToggleMember(contact.userID)}
                >
                  <img
                    src={contact.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.userID}`}
                    alt={contact.name}
                    className="contact-avatar"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#000' }}>
                      {contact.alias?.trim() ? contact.alias : contact.name}
                    </div>
                    {contact.sdt && (
                      <div style={{ fontSize: '12px', color: '#65676b', marginTop: '2px' }}>
                        {contact.sdt}
                      </div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(contact.userID)}
                    onChange={() => {}}
                    className="contact-checkbox"
                  />
                </div>
              ))
            )}
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Modal Footer */}
        <div className="create-group-modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Hủy
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={loading}
            className="btn-create"
          >
            {loading ? 'Đang tạo...' : 'Tạo nhóm'}
          </button>
        </div>
      </div>
    </div>
  );
};
