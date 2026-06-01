import React, { useEffect, useState } from 'react';
import { FaTrash, FaInfoCircle } from 'react-icons/fa';

interface DeleteChatDialogProps {
  visible: boolean;
  chatName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteChatDialog: React.FC<DeleteChatDialogProps> = ({
  visible,
  chatName,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    if (visible) {
      // Animate in
      setTimeout(() => setScale(1), 10);
    } else {
      setScale(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={isDeleting ? undefined : onCancel}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl mx-4 transition-transform duration-200"
        style={{
          transform: `scale(${scale})`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center pt-8 pb-4">
          <div className="w-18 h-18 rounded-full bg-red-100 flex items-center justify-center">
            <FaTrash className="text-red-500 text-3xl" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Xóa cuộc trò chuyện?
          </h2>
          <p className="text-base font-semibold text-blue-600 text-center mb-4 truncate">
            {chatName}
          </p>
          <p className="text-sm text-gray-600 text-center leading-relaxed mb-4">
            Toàn bộ nội dung trò chuyện sẽ bị xóa khỏi danh sách của bạn.
          </p>
          <div className="flex items-start gap-2 bg-gray-100 p-3 rounded-xl">
            <FaInfoCircle className="text-gray-500 text-base mt-0.5 shrink-0" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Tin nhắn vẫn tồn tại với người khác. Khi có tin nhắn mới, cuộc trò chuyện sẽ xuất hiện lại.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <>
                <FaTrash className="text-sm" />
                <span>Xóa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
