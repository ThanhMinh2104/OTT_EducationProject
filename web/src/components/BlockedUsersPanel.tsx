import { useState, useEffect } from 'react';
import { FaUserSlash, FaSpinner } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface BlockedUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
}

interface Props {
  onUnblockSuccess?: () => void;
}

const BlockedUsersPanel = ({ onUnblockSuccess }: Props) => {
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchBlocked = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/contacts/blocked');
      setBlockedList(res.data);
    } catch (err) {
      console.error('Fetch blocked error:', err);
      toast.error('Không thể tải danh sách chặn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocked();
  }, []);

  const handleUnblock = async (targetUserID: string) => {
    setProcessingId(targetUserID);
    try {
      await axiosInstance.post('/contacts/unblock', { targetUserID });
      toast.success('Đã bỏ chặn');
      setBlockedList(prev => prev.filter(u => u.userID !== targetUserID));
      onUnblockSuccess?.();
    } catch {
      toast.error('Có lỗi xảy ra khi bỏ chặn');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <FaSpinner className="animate-spin text-[#0e9de8] text-2xl" />
        <span className="text-sm text-gray-400">Đang tải danh sách chặn...</span>
      </div>
    );
  }

  if (blockedList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-10 text-center gap-4">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
          <FaUserSlash className="text-gray-200 text-3xl" />
        </div>
        <div>
          <h3 className="text-gray-800 font-bold text-sm mb-1">Danh sách chặn trống</h3>
          <p className="text-gray-400 text-xs">Bạn chưa chặn người dùng nào.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-10">
      <div className="px-5 py-3 bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm shadow-sm border-b border-gray-100">
        <span className="text-xs font-bold text-[#0e9de8]">TÀI KHOẢN ĐÃ CHẶN ({blockedList.length})</span>
      </div>
      
      <div className="divide-y divide-gray-50">
        {blockedList.map((user) => (
          <div key={user.userID} className="flex items-center px-5 py-4 hover:bg-red-50/10 transition-colors group">
            <img
              src={user.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userID}`}
              alt={user.name}
              className="w-11 h-11 rounded-full object-cover bg-gray-100"
            />
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-800 truncate">{user.name}</p>
              <p className="text-[12px] text-gray-400 truncate mt-0.5">{user.sdt}</p>
            </div>
            <button
              onClick={() => handleUnblock(user.userID)}
              disabled={processingId === user.userID}
              className="px-4 py-1.5 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-lg hover:bg-[#0e9de8] hover:text-white transition-all disabled:opacity-50"
            >
              {processingId === user.userID ? 'Đang xử lý...' : 'Bỏ chặn'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlockedUsersPanel;
