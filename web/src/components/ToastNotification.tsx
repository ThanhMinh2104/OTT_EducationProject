import { useState, useEffect, useRef, useCallback } from 'react';
import { FaTimes, FaVolumeUp } from 'react-icons/fa';

export interface ToastData {
  id: string;
  chatID: string;
  senderName: string;
  senderAvatar?: string | null;
  message: string;
  chatName?: string;
  isGroup?: boolean;
}

interface Props {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  onClickChat: (chatID: string) => void;
}

const DURATION = 4000;

const getMessagePreview = (msg: string, type?: string): string => {
  if (!type || type === 'text' || type === 'emoji') return msg || '';
  if (type === 'image') return '📷 Hình ảnh';
  if (type === 'video') return '🎥 Video';
  if (type === 'audio') return '🎵 Tin nhắn thoại';
  if (type === 'file') return '📎 File';
  return msg || 'Tin nhắn mới';
};

const Toast = ({ toast, onDismiss, onClickChat }: {
  toast: ToastData;
  onDismiss: (id: string) => void;
  onClickChat: (chatID: string) => void;
}) => {
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Slide in
    requestAnimationFrame(() => setVisible(true));

    const step = 100 / (DURATION / 50);
    intervalRef.current = setInterval(() => {
      setProgress((p) => Math.max(0, p - step));
    }, 50);

    timerRef.current = setTimeout(() => dismiss(), DURATION);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const handleClick = () => {
    dismiss();
    onClickChat(toast.chatID);
  };

  return (
    <div
      className={`relative w-[340px] bg-white dark:bg-gray-800 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      onClick={handleClick}
    >
      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 h-[3px] bg-[#0e9de8] transition-none rounded-full"
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-start gap-3 px-4 py-3.5 pt-4">
        {/* Avatar */}
        <div className="relative shrink-0">
          <img
            src={toast.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${toast.senderName}`}
            alt={toast.senderName}
            className="w-10 h-10 rounded-full object-cover border-2 border-blue-100 dark:border-blue-800"
          />
          {/* App icon badge */}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0e9de8] rounded-full flex items-center justify-center">
            <span className="text-white text-[8px]">💬</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              {toast.senderName}
              {toast.isGroup && toast.chatName && (
                <span className="text-gray-400 font-normal"> · {toast.chatName}</span>
              )}
            </p>
            <span className="text-[11px] text-gray-400 shrink-0">Vừa xong</span>
          </div>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate leading-snug">
            {toast.message}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors mt-0.5"
        >
          <FaTimes className="text-[10px]" />
        </button>
      </div>

      {/* Hover hint */}
      <div className="px-4 pb-2.5 -mt-1">
        <p className="text-[11px] text-[#0e9de8] font-medium">Nhấn để mở cuộc trò chuyện →</p>
      </div>
    </div>
  );
};

const ToastNotification = ({ toasts, onDismiss, onClickChat }: Props) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} onClickChat={onClickChat} />
        </div>
      ))}
    </div>
  );
};

export default ToastNotification;
