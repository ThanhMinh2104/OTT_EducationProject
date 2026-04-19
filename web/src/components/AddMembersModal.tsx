import React, { useEffect, useState, useCallback } from 'react';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';
import './AddMembersModal.css';
interface Contact {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface AddMembersModalProps {
  groupID: string;
  currentUserID: string;
  onClose: () => void;
  onSuccess: () => void;
  onBlockedNotification?: (message: string) => void;
}

export const AddMembersModal: React.FC<AddMembersModalProps> = ({
  groupID,
  onClose,
  onSuccess,
  onBlockedNotification,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const [friendsRes, groupRes] = await Promise.all([
        axiosInstance.post('/contacts/friends', {}),
        axiosInstance.get(`/groups/${groupID}`),
      ]);

      const existingMemberIDs = new Set(
        groupRes.data.members?.map((m: { userID: string }) => m.userID) || []
      );

      const availableFriends = friendsRes.data.filter(
        (friend: { userID: string }) => !existingMemberIDs.has(friend.userID)
      );

      setContacts(
        availableFriends.map((friend: { userID: string; alias?: string; name: string; anhDaiDien?: string }) => ({
          userID: friend.userID,
          name: friend.alias || friend.name,
          anhDaiDien: friend.anhDaiDien,
        }))
      );
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [groupID]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleMember = (userID: string) => {
    const next = new Set(selectedMembers);
    if (next.has(userID)) next.delete(userID);
    else next.add(userID);
    setSelectedMembers(next);
  };

  const handleAddMembers = async () => {
    if (selectedMembers.size === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }

    let addedCount = 0;

    for (const uid of selectedMembers) {
      try {
        const res = await axiosInstance.post(`/groups/${groupID}/members`, { userID: uid });
        if (res.data?.requireApproval) {
          // Người mời thấy toast, không thêm vào addedCount
          toast.success('Cần được phê duyệt từ Trưởng nhóm');
        } else {
          addedCount++;
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { errorCode?: string } } };
        if (err.response?.data?.errorCode === 'USER_BLOCKED') {
          const name = contacts.find((c) => c.userID === uid)?.name || uid;
          await axiosInstance.post(`/groups/${groupID}/private-notification`, {
            content: `${name} đã bị trưởng/phó nhóm chặn tham gia nhóm`,
          });
          onBlockedNotification?.(`${name} đã bị trưởng/phó nhóm chặn tham gia nhóm`);
        }
      }
    }

    if (addedCount > 0) onSuccess();
    onClose();
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
              const contact = contacts.find((c) => c.userID === userID);
              return (
                <div key={userID} className="member-tag">
                  {contact?.name || userID}
                  <span className="member-tag-remove" onClick={() => handleToggleMember(userID)}>
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
