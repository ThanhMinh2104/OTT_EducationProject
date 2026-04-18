import { FaUserSecret } from 'react-icons/fa';

interface StrangerFolderProps {
  unreadCount: number;
  lastMessageTime: string;
  onClick: () => void;
  isSelected: boolean;
}

const getTimeDisplay = (timestamp: string): string => {
  const d = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Vài giây';
  if (diffMins < 60) return diffMins === 1 ? '1 phút' : `${diffMins} phút`;
  if (diffHours < 24) return diffHours === 1 ? '1 giờ' : `${diffHours} giờ`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return d.toLocaleDateString('vi-VN', { weekday: 'short' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const StrangerFolderItem = ({ unreadCount, lastMessageTime, onClick, isSelected }: StrangerFolderProps) => {
  return (
    <div
      className={`flex items-center px-3.5 py-2.5 cursor-pointer border-b border-gray-50 relative transition-colors group ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {/* Avatar với icon người lạ */}
      <div className="relative mr-3 shrink-0">
        <div className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
          <FaUserSecret className="text-white text-[22px]" />
        </div>
      </div>

      {/* Nội dung */}
      <div className="flex-1 flex flex-col overflow-hidden gap-0.5 min-w-0">
        <p className="text-[14.5px] font-semibold text-gray-900 m-0 truncate">
          Tin nhắn từ người lạ
        </p>
        <p className="text-[13px] text-gray-400 m-0 truncate">
          Chưa có trong danh bạ
        </p>
      </div>

      {/* Meta: time + badge */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
        <span className="text-[11px] text-gray-400">
          {lastMessageTime ? getTimeDisplay(lastMessageTime) : ''}
        </span>
        {unreadCount > 0 && (
          <span className="bg-[#0e9de8] text-white text-[11px] font-bold rounded-[10px] px-1.5 py-0.5 min-w-[20px] text-center leading-[1.4]">
            {unreadCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default StrangerFolderItem;
