import { FaComments } from 'react-icons/fa';

interface Chat {
  id: string;
  name: string;
  avatar?: string;
}

interface User {
  name?: string;
}

interface Props {
  selectedChat: Chat | null;
  user: User | null;
}

const ChatWindow = ({ selectedChat, user }: Props) => {
  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gray-100">
        <div className="flex-1 flex flex-col justify-center items-center gap-4 bg-gradient-to-br from-blue-50 to-gray-50">
          <div className="w-20 h-20 bg-linear-to-br from-[#0e9de8] to-[#0077c2] rounded-full flex items-center justify-center text-white text-4xl shadow-[0_4px_16px_rgba(14,157,232,0.35)]">
            <FaComments />
          </div>
          <h2 className="text-xl font-bold text-gray-900 m-0">Chào mừng, {user?.name}!</h2>
          <p className="text-sm text-gray-400 m-0">Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-100">
      <div className="flex-1 flex w-full h-full">
        <div className="flex-1 h-full bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center px-4.5 py-3 border-b border-gray-100 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <img
              src={selectedChat.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User123'}
              alt="avatar"
              className="w-[42px] h-[42px] rounded-full object-cover mr-3 border-2 border-blue-100"
            />
            <div>
              <h2 className="text-[15px] font-bold m-0 mb-0.5 text-gray-900">{selectedChat.name}</h2>
              <p className="text-xs text-green-500 m-0 flex items-center gap-1">
                <span className="w-[7px] h-[7px] bg-green-500 rounded-full inline-block" />
                Đang hoạt động
              </p>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-2.5 bg-gray-100 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded">
            <div className="flex-1 flex flex-col justify-center items-center">
              <p className="text-gray-300 text-sm">nố nồ nô</p>
            </div>
          </div>

          {/* Input area */}
          <div className="flex items-center px-4 py-2.5 border-t border-gray-100 bg-white gap-2.5">
            <div className="input-icons left" />
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-[22px] outline-none text-sm bg-gray-50 focus:border-[#0e9de8] focus:bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
