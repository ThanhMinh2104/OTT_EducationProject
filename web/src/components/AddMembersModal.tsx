import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';
import './AddMembersModal.css';

interface Contact {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface AddMembersModalProps {
  groupID: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddMembersModal: React.FC<AddMembersModalProps> = ({
  groupID,
  onClose,
  onSuccess,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      // Lấy danh sách bạn bè và thông tin nhóm
      const [friendsRes, groupRes] = await Promise.all([
        axiosInstance.post('/contacts/friends', {}),
        axiosInstance.get(`/groups/${groupID}`)
      ]);
      
      const existingMemberIDs = new Set(
        groupRes.data.members?.map((m: any) => m.userID) || []
      );
      
      // Lọc bạn bè chưa trong nhóm
      const availableFriends = friendsRes.data.filter(
        (friend: any) => !existingMemberIDs.has(friend.userID)
      );
      
      // Map sang format Contact
      const contactsList = availableFriends.map((friend: any) => ({
        userID: friend.userID,
        name: friend.alias || friend.name,
        anhDaiDien: friend.anhDaiDien
      }));
      
      setContacts(contactsList);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleMember = (userID: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(userID)) {
      newSelected.delete(userID);
    } else {
      newSelected.add(userID);
    }
    setSelectedMembers(newSelected);
  };

  const handleAddMembers = async () => {
    if (selectedMembers.size === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    try {
      // Gửi tất cả userIDs cùng lúc
      await axiosInstance.post(`/groups/${groupID}/members`, { 
        userIDs: Array.from(selectedMembers) 
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error adding members:', error);
      alert(error.response?.data?.message || 'Lỗi thêm thành viên');
    }
  };

  return (
    <div className="add-members-modal-overlay" onClick={onClose}>
      <div className="add-members-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Thêm thành viên</h3>

        <input
          type="text"
          className="search-contacts"
          placeholder="Tìm kiếm liên hệ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {selectedMembers.size > 0 && (
          <div className="selected-members">
            {Array.from(selectedMembers).map((userID) => {
              const contact = contacts.find(c => c.userID === userID);
              return (
                <div key={userID} className="member-tag">
                  {contact?.name || userID}
                  <span
                    className="member-tag-remove"
                    onClick={() => handleToggleMember(userID)}
                  >
                    ✕
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="contacts-list">
          {loading ? (
            <div className="text-center py-4 text-gray-500">Đang tải...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {searchQuery ? 'Không tìm thấy liên hệ' : 'Không có liên hệ nào'}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div key={contact.userID} className="contact-item">
                <input
                  type="checkbox"
                  className="contact-checkbox"
                  checked={selectedMembers.has(contact.userID)}
                  onChange={() => handleToggleMember(contact.userID)}
                />
                <img
                  src={contact.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.userID}`}
                  alt={contact.name}
                  className="contact-avatar"
                />
                <span className="contact-name">{contact.name}</span>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Hủy</button>
          <button onClick={handleAddMembers} className="btn-primary">
            Thêm ({selectedMembers.size})
          </button>
        </div>
      </div>
    </div>
  );
};
