import toast from 'react-hot-toast';

interface ToastMessageProps {
  avatar: string;
  senderName: string;
  message: string;
  chatID: string;
  onClickChat: (chatID: string) => void;
}

const ToastMessage = ({ avatar, senderName, message, chatID, onClickChat }: ToastMessageProps) => {
  return (
    <div
      onClick={() => {
        onClickChat(chatID);
        toast.dismiss();
      }}
      className="flex items-center gap-3 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-3 min-w-[320px] max-w-[380px] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all duration-200 border border-gray-100"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <img
          src={avatar}
          alt={senderName}
          className="w-12 h-12 rounded-full object-cover border-2 border-blue-100"
        />
        {/* Online indicator */}
        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-gray-900 truncate mb-0.5">
          {senderName}
        </p>
        <p className="text-[13px] text-gray-600 truncate">
          {message}
        </p>
      </div>

      {/* Zalo-style indicator */}
      <div className="shrink-0 w-2 h-2 bg-[#0068FF] rounded-full"></div>
    </div>
  );
};

export const showZaloToast = (
  avatar: string,
  senderName: string,
  message: string,
  chatID: string,
  onClickChat: (chatID: string) => void
) => {
  toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <ToastMessage
          avatar={avatar}
          senderName={senderName}
          message={message}
          chatID={chatID}
          onClickChat={onClickChat}
        />
      </div>
    ),
    {
      duration: 4000,
      position: 'bottom-right',
    }
  );
};
