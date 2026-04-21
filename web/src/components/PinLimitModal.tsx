import { FaTimes } from 'react-icons/fa';

interface PinnedItem {
  id: string;
  type: 'message' | 'note';
  content: string;
  senderName?: string;
  creatorName?: string;
  timestamp?: string;
}

interface PinLimitModalProps {
  show: boolean;
  onClose: () => void;
  pinnedItems: PinnedItem[];
  onReplace: (itemId: string) => void;
}

const PinLimitModal = ({ show, onClose, pinnedItems, onReplace }: PinLimitModalProps) => {
  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-9999 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl w-[90%] max-w-[480px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-[slideUp_0.3s_ease-out] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="m-0 text-base font-semibold text-gray-900">
            Cập nhật danh sách ghim
          </h3>
          <button 
            className="bg-transparent border-none text-gray-500 cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-gray-700"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="m-0 mb-4 text-sm text-gray-600 leading-relaxed">
            Đã đạt giới hạn 3 ghim. Ghim cũ dưới đây sẽ được bỏ để cập nhật nội dung mới.
          </p>

          <div className="flex flex-col gap-3">
            {pinnedItems.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg transition-all hover:bg-gray-100 hover:border-gray-300"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                  {item.type === 'message' ? (
                    <span className="text-xl">📌</span>
                  ) : (
                    <span className="text-xl">📝</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 mb-1">
                    {item.type === 'message' ? 'Tin nhắn' : 'Ghi chú'}
                  </div>
                  <div className="text-xs text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.content.length > 50 
                      ? item.content.substring(0, 50) + '...' 
                      : item.content}
                  </div>
                </div>
                <button
                  className="px-4 py-1.5 bg-transparent border border-[#0a84ff] rounded-md text-[#0a84ff] text-[13px] font-medium cursor-pointer transition-all shrink-0 hover:bg-[#0a84ff]/10"
                  onClick={() => onReplace(item.id)}
                >
                  Thay đổi
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
          <button 
            className="w-full py-2.5 px-5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all bg-gray-200 text-gray-700 hover:bg-gray-300"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PinLimitModal;
