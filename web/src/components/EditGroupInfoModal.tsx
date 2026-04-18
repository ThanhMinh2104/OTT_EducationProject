import { useState, useRef } from 'react';
import { FaTimes, FaCamera, FaCheck } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface Props {
  groupID: string;
  currentName: string;
  currentAvatar?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EditGroupInfoModal = ({ groupID, currentName, currentAvatar, onClose, onSuccess }: Props) => {
  const [groupName, setGroupName] = useState(currentName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(currentAvatar);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Vui lòng chọn file ảnh');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Kích thước ảnh không được vượt quá 5MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      toast.error('Tên nhóm không được để trống');
      return;
    }

    setIsUploading(true);
    try {
      let avatarUrl = currentAvatar;

      // Upload avatar nếu có thay đổi
      if (avatarFile) {
        const formData = new FormData();
        formData.append('files', avatarFile);

        const uploadRes = await axiosInstance.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadRes.data.urls && uploadRes.data.urls.length > 0) {
          avatarUrl = uploadRes.data.urls[0];
        }
      }

      // Cập nhật thông tin nhóm
      await axiosInstance.put(`/groups/${groupID}`, {
        name: groupName.trim(),
        avatar: avatarUrl,
      });

      toast.success('Đã cập nhật thông tin nhóm');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating group info:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi cập nhật thông tin nhóm');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-[#2a2f35] rounded-2xl w-full max-w-md shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <h2 className="text-lg font-bold text-white">Chỉnh sửa thông tin nhóm</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
            >
              <FaTimes />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <img
                  src={avatarPreview || `https://api.dicebear.com/7.x/identicon/svg?seed=${groupID}`}
                  alt="Group avatar"
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-400"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
                  title="Thay đổi ảnh đại diện"
                >
                  <FaCamera className="text-sm" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <p className="text-xs text-gray-400 text-center">
                Click vào icon camera để thay đổi ảnh đại diện
              </p>
            </div>

            {/* Group Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tên nhóm
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nhập tên nhóm..."
                maxLength={100}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <p className="text-xs text-gray-400 mt-1">
                {groupName.length}/100 ký tự
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-700">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={isUploading || !groupName.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <FaCheck className="text-sm" />
                  Lưu
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditGroupInfoModal;
