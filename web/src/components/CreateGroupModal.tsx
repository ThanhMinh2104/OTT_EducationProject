import { useState, useEffect, useRef } from 'react';
import { FaSearch, FaTimes, FaCamera } from 'react-icons/fa';
import toast from 'react-hot-toast';
import axiosInstance from '../utils/axios';

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
  const [groupAvatar, setGroupAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Kích thước ảnh không được vượt quá 5MB');
        return;
      }
      setGroupAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleRemoveAvatar = () => {
    setGroupAvatar(null);
    setAvatarPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      if (groupAvatar) {
        try {
          const formData = new FormData();
          formData.append('files', groupAvatar);
          const uploadResponse = await axiosInstance.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          avatarUrl = uploadResponse.data.urls?.[0]; // Sửa từ files thành urls
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

      toast.success('Tạo nhóm thành công! 🎉');
      onGroupCreated(response.data.group.groupID);
      onClose();
    } catch (err: any) {
      console.error('Create group error:', err);
      const message = err.response?.data?.message || err.message || 'Lỗi tạo nhóm';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    contact.alias?.toLowerCase().includes(searchText.toLowerCase()) ||
    contact.sdt?.includes(searchText)
  );

  return (
    <div 
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl w-[90%] max-w-[460px] flex flex-col shadow-2xl animate-slideUp"
        style={{ height: 'min(90vh, 620px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-base font-semibold text-black">Tạo nhóm mới</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Top section: Avatar + Group name (compact, horizontal) */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-2xl text-gray-400">👥</div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow transition-all"
            >
              <FaCamera className="text-[9px]" />
            </button>
            {avatarPreview && (
              <button
                onClick={handleRemoveAvatar}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow transition-all"
              >
                <FaTimes className="text-[8px]" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Group name input */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Nhập tên nhóm"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <p className="text-[11px] text-gray-400 mt-1 pl-1">
              Đã chọn: <span className="font-semibold text-blue-500">{selectedMembers.size}</span> thành viên
              <span className="text-gray-400"> (cần ít nhất 2)</span>
            </p>
          </div>
        </div>

        {/* Search + Selected tags + Contacts list — flex-1 to fill remaining space */}
        <div className="flex-1 flex flex-col min-h-0 px-5 pt-3 pb-2">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full border border-transparent focus-within:bg-white focus-within:border-blue-500 transition-all flex-shrink-0">
            <FaSearch className="text-gray-500 text-[13px] flex-shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 bg-transparent border-none text-[13px] outline-none"
            />
          </div>

          {/* Selected Members Tags */}
          {selectedMembers.size > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pt-2 pb-1 flex-shrink-0 max-h-[72px] overflow-y-auto">
              {Array.from(selectedMembers).map((userID) => {
                const contact = contacts.find((c) => c.userID === userID);
                return (
                  <div key={userID} className="flex items-center gap-1 bg-blue-500 text-white px-2 py-0.5 rounded-xl text-xs font-medium">
                    <span>{contact?.name}</span>
                    <button
                      onClick={() => handleToggleMember(userID)}
                      className="w-3.5 h-3.5 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center transition-all"
                    >
                      <FaTimes className="text-[9px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contacts List — takes all remaining space */}
          <div className="flex-1 overflow-y-auto mt-2 border border-gray-200 rounded-lg min-h-0">
            {filteredContacts.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[80px] text-gray-500 text-[13px]">
                <p>Không tìm thấy thành viên</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.userID}
                  className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                    selectedMembers.has(contact.userID) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleToggleMember(contact.userID)}
                >
                  <img
                    src={contact.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.userID}`}
                    alt={contact.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-black truncate">
                      {contact.alias?.trim() ? contact.alias : contact.name}
                    </div>
                    {contact.sdt && (
                      <div className="text-xs text-gray-500 mt-0.5">{contact.sdt}</div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(contact.userID)}
                    onChange={() => {}}
                    className="w-[18px] h-[18px] cursor-pointer accent-blue-500 flex-shrink-0"
                  />
                </div>
              ))
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs leading-relaxed flex-shrink-0">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 bg-white rounded-md text-[13px] font-semibold text-black hover:bg-gray-100 transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-500 rounded-md text-[13px] font-semibold text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Đang tạo...' : 'Tạo nhóm'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.2s ease-out; }
      `}</style>
    </div>
  );
};
