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
    contact.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl w-[90%] max-w-[420px] max-h-[80vh] flex flex-col shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-black">Tạo nhóm mới</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl text-gray-400">👥</div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-lg transition-all"
              >
                <FaCamera className="text-sm" />
              </button>
              {avatarPreview && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute top-0 right-0 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-gray-500">Nhấn để chọn ảnh đại diện nhóm</p>
          </div>

          {/* Group Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-gray-600">Tên nhóm</label>
            <input
              type="text"
              placeholder="Nhập tên nhóm"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError('');
              }}
              className="px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Member Count Info */}
          <div className="flex justify-between items-center px-3 py-2 bg-gray-100 rounded-md text-[13px] text-gray-600">
            <span>Đã chọn: {selectedMembers.size}/2+ thành viên</span>
            <span className="text-xs text-gray-500">(Nhóm phải có ít nhất 3 người)</span>
          </div>

          {/* Search Contacts */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full border border-transparent focus-within:bg-white focus-within:border-blue-500 transition-all">
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
            <div className="flex flex-wrap gap-1.5 p-2 bg-gray-100 rounded-md">
              {Array.from(selectedMembers).map((userID) => {
                const contact = contacts.find((c) => c.userID === userID);
                return (
                  <div key={userID} className="flex items-center gap-1.5 bg-blue-500 text-white px-2 py-1 rounded-xl text-xs font-medium">
                    <span>{contact?.name}</span>
                    <button
                      onClick={() => handleToggleMember(userID)}
                      className="w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center transition-all"
                    >
                      <FaTimes className="text-[10px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md max-h-[300px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
            {filteredContacts.length === 0 ? (
              <div className="flex items-center justify-center h-[100px] text-gray-500 text-[13px]">
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
                      <div className="text-xs text-gray-500 mt-0.5">
                        {contact.sdt}
                      </div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(contact.userID)}
                    onChange={() => {}}
                    className="w-[18px] h-[18px] cursor-pointer accent-blue-500"
                  />
                </div>
              ))
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
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
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
