import { FaComments } from 'react-icons/fa';
import '../styles/ChatWindow.css';

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
      <div className="chat-window">
        <div className="default-message">
          <div className="welcome-icon">
            <FaComments />
          </div>
          <h2>Chào mừng, {user?.name}!</h2>
          <p>Chọn một cuộc trò chuyện để bắt đầu nhắn tin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-content">
        <div className="content1">
          {/* Header */}
          <div className="header">
            <img
              src={selectedChat.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User123'}
              alt="avatar"
              className="avatar"
            />
            <div className="header-info">
              <h2>{selectedChat.name}</h2>
              <p><span className="online-dot" />Đang hoạt động</p>
            </div>
          </div>

          {/* Messages area */}
          <div className="messages">
            <div className="default-message" style={{ flex: 1 }}>
              <p style={{ color: '#aaa', fontSize: 14 }}>
                nố nồ nô 
              </p>
            </div>
          </div>

          {/* Input area */}
          <div className="chat-input">
            <div className="input-icons left">
              {/* placeholder icons */}
            </div>
            <input type="text" placeholder="Nhập tin nhắn..." />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
