import { FaPhone, FaPhoneSlash } from 'react-icons/fa';

interface Props {
  callerInfo: { name: string; avatar?: string };
  onAccept: () => void;
  onReject: () => void;
}

const IncomingCallModal = ({ callerInfo, onAccept, onReject }: Props) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[320px] p-6 flex flex-col items-center gap-4 animate-bounce-in">
        <img
          src={callerInfo.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + callerInfo.name}
          alt="caller"
          className="w-20 h-20 rounded-full object-cover border-4 border-[#0e9de8]/30"
        />
        <div className="text-center">
          <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{callerInfo.name}</p>
          <p className="text-sm text-gray-400 mt-1 animate-pulse">Cuộc gọi video đến...</p>
        </div>
        <div className="flex gap-6 mt-2">
          <button
            onClick={onReject}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-xl transition-colors shadow-lg"
            title="Từ chối"
          >
            <FaPhoneSlash />
          </button>
          <button
            onClick={onAccept}
            className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white text-xl transition-colors shadow-lg"
            title="Nghe máy"
          >
            <FaPhone />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
