import { useState } from 'react';
import { FaSearch, FaUserPlus, FaUsers, FaAngleDown, FaEllipsisH } from 'react-icons/fa';
import AddFriendModal from './AddFriendModal';

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  time?: string;
  unread?: number;
}

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string } | null;
  onSelectChat: (chat: Chat) => void;
  selectedChatId: string | null;
}

// Dữ liệu mẫu để hiển thị giao diện
const MOCK_CHATS: Chat[] = [
  {
    id: '1',
    name: 'Nguyễn Thành Trung',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User123',
    lastMessage: 'Xin chào!',
    time: '10:30',
    unread: 2,
  },
];

const ChatList = ({ user, onSelectChat, selectedChatId }: Props) => {
  const [searchText, setSearchText] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);

  const filtered = MOCK_CHATS.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="w-[310px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen flex-shrink-0">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-3 py-1.5 flex-1 rounded-full focus-within:bg-blue-50 dark:focus-within:bg-blue-900/30 focus-within:outline-1 focus-within:outline-[#0e9de8] transition-colors">
          <span className="text-gray-400 dark:text-gray-500 mr-1.5 text-[13px]">
            <FaSearch />
          </span>
          <input
            type="text"
            className="border-none bg-transparent outline-none w-full text-[13.5px] text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            placeholder="Tìm kiếm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <button
            title="Thêm bạn"
            onClick={() => setShowAddFriendModal(true)}
            className="bg-none border-none cursor-pointer text-[17px] text-gray-600 dark:text-gray-400 w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#0e9de8] dark:hover:text-blue-400 transition-colors"
          >
            <FaUserPlus />
          </button>
          <button
            title="Tạo nhóm"
            className="bg-none border-none cursor-pointer text-[17px] text-gray-600 dark:text-gray-400 w-[34px] h-[34px] rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#0e9de8] dark:hover:text-blue-400 transition-colors"
          >
            <FaUsers />
          </button>
        </div>
      </div>

      {/* Tab menu */}
      <div className="flex items-center px-3 border-b border-gray-100 dark:border-gray-700 gap-0.5 h-10">
        <span className="cursor-pointer px-2.5 py-2 text-[13px] font-semibold text-[#0e9de8] dark:text-blue-400 border-b-2 border-[#0e9de8] dark:border-blue-400 whitespace-nowrap">
          Tất cả
        </span>
        <span className="cursor-pointer px-2.5 py-2 text-[13px] font-medium text-gray-500 dark:text-gray-400 border-b-2 border-transparent hover:text-[#0e9de8] dark:hover:text-blue-400 whitespace-nowrap transition-colors">
          Chưa đọc
        </span>
        <span className="cursor-pointer px-2.5 py-2 text-[13px] font-medium text-gray-500 dark:text-gray-400 border-b-2 border-transparent hover:text-[#0e9de8] dark:hover:text-blue-400 whitespace-nowrap transition-colors">
          Phân loại
        </span>
        <button className="bg-none border-none cursor-pointer text-gray-500 dark:text-gray-400 text-[13px] px-1.5 py-1 rounded ml-auto hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <FaAngleDown />
        </button>
        <button className="bg-none border-none cursor-pointer text-gray-500 dark:text-gray-400 text-[13px] px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <FaEllipsisH />
        </button>
      </div>

      {/* Chat items */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded">
        {filtered.map((chat) => (
          <div
            key={chat.id}
            className={`flex items-center px-3.5 py-2.5 cursor-pointer border-b border-gray-50 dark:border-gray-800 relative transition-colors ${selectedChatId === chat.id ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            onClick={() => onSelectChat(chat)}
          >
            <img
              src={chat.avatar}
              alt="avatar"
              className="w-[46px] h-[46px] rounded-full object-cover flex-shrink-0 mr-3 bg-gray-200 dark:bg-gray-700 shadow-sm"
            />
            <div className="flex-1 flex flex-col overflow-hidden gap-0.5">
              <p className="text-[14.5px] font-semibold text-gray-900 dark:text-gray-100 m-0 truncate">
                {chat.name}
              </p>
              <p className="text-[13px] text-gray-400 dark:text-gray-500 m-0 truncate">
                {chat.lastMessage}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
              <span className="text-[11px] text-gray-300 dark:text-gray-600">{chat.time}</span>
              {(chat.unread ?? 0) > 0 && (
                <span className="bg-[#0e9de8] dark:bg-blue-600 text-white text-[11px] font-bold rounded-[10px] px-1.5 py-0.5 min-w-[20px] text-center leading-[1.4]">
                  {chat.unread}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddFriendModal && (
        <AddFriendModal
          onClose={() => setShowAddFriendModal(false)}
          currentUser={user}
          onStartChat={(chat) => onSelectChat(chat)}
        />
      )}
    </div>
  );
};

export default ChatList;
