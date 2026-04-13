import { useEffect, useState } from 'react';
import { FaPhoneSlash, FaTimes } from 'react-icons/fa';

interface Props {
  type: 'rejected' | 'missed';
  callerName: string;
  onClose: () => void;
}

const CallNotification = ({ type, callerName, onClose }: Props) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[10000] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 pr-12 flex items-center gap-3 border border-gray-200 dark:border-gray-700 min-w-[300px]">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            type === 'rejected'
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-orange-100 dark:bg-orange-900/30'
          }`}
        >
          <FaPhoneSlash
            className={`text-xl ${type === 'rejected' ? 'text-red-500' : 'text-orange-500'}`}
          />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            {type === 'rejected' ? 'Cuộc gọi bị từ chối' : 'Cuộc gọi nhỡ'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {type === 'rejected'
              ? `${callerName} đã từ chối cuộc gọi`
              : `${callerName} không trả lời`}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <FaTimes className="text-xs" />
        </button>
      </div>
    </div>
  );
};

export default CallNotification;
