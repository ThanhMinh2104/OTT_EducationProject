import React from 'react';

interface ConfirmModalProps {
  show: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  show,
  title,
  message,
  confirmText = 'CÓ',
  cancelText = 'KHÔNG',
  onConfirm,
  onCancel,
  isDanger = false
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
      {/* Overlay mờ phía sau */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-300" 
        onClick={onCancel}
      />
      
      {/* Nội dung Modal */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden transform transition-all animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h3 className="text-[17px] font-bold text-[#1a1a1a] text-center">
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-[14.5px] text-[#4a4a4a] text-center leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer (Buttons) - Thiết kế kiểu Zalo: 2 nút ngang nhau */}
        <div className="flex border-t border-gray-100 h-12">
          <button
            onClick={onCancel}
            className="flex-1 text-[15px] font-medium text-gray-500 hover:bg-gray-50 transition-colors uppercase tracking-tight"
          >
            {cancelText}
          </button>
          
          <div className="w-[1px] bg-gray-100" /> {/* Vạch ngăn cách dọc */}
          
          <button
            onClick={onConfirm}
            className={`flex-1 text-[15px] font-bold transition-colors uppercase tracking-tight ${
              isDanger ? 'text-red-500 hover:bg-red-50' : 'text-[#0068ff] hover:bg-blue-50'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
