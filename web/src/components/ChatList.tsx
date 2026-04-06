import { useState } from 'react';
import { FaSearch, FaUserPlus, FaUsers, FaAngleDown, FaEllipsisH } from 'react-icons/fa';
import '../styles/ChatList.css';

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  time?: string;
  unread?: number;
}

interface Props {
  user: unknown;
  onSelectChat: (chat: Chat) => void;
  selectedChatId: string | null;
}

// Dữ liệu mẫu để hiển thị giao diện
const MOCK_CHATS: Chat[] = [
  { id: '1', name: 'Nguyễn Thành Trung', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User123', lastMessage: 'Xin chào!', time: '10:30', unread: 2 },
];

const ChatList = ({ onSelectChat, selectedChatId }: Props) => {
  const [searchText, setSearchText] = useState('');

  const filtered = MOCK_CHATS.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="chat-list">
      {/* Search bar */}
      <div className="search-bar">
        <div className="search-box">
          <span className="search-icon"><FaSearch /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="search-icons">
          <button title="Thêm bạn"><FaUserPlus /></button>
          <button title="Tạo nhóm"><FaUsers /></button>
        </div>
      </div>

      {/* Tab menu */}
      <div className="tab-menu">
        <span className="active-tab">Tất cả</span>
        <span>Chưa đọc</span>
        <span>Phân loại</span>
        <button className="btn-icon"><FaAngleDown /></button>
        <button className="btn-icon"><FaEllipsisH /></button>
      </div>

      {/* Chat items */}
      <div className="chat-items">
        {filtered.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${selectedChatId === chat.id ? 'selected' : ''}`}
            onClick={() => onSelectChat(chat)}
          >
            <img src={chat.avatar} alt="avatar" className="avatar" />
            <div className="chat-info">
              <p className="chat-name">{chat.name}</p>
              <p className="chat-message">{chat.lastMessage}</p>
            </div>
            <div className="chat-meta">
              <span className="chat-time">{chat.time}</span>
              {(chat.unread ?? 0) > 0 && (
                <span className="unread-badge">{chat.unread}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
