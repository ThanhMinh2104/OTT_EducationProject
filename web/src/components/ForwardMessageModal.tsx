import { useState, useEffect } from 'react';
import { FaTimes, FaPaperPlane } from 'react-icons/fa';
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:5000');
const API = 'http://localhost:5000/api';

interface Message {
  messageID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
  senderInfo?: { name: string; avatar?: string | null };
  forwardedFrom?: string;
}

interface Chat {
  chatID: string;
  name: string;
  avatar?: string;
  type: 'private' | 'group';
}

interface User {
  name?: string;
  userID?: string;
}

interface Props {
  message: Message;
  onClose: () => void;
  user: User | null;
}

const ForwardMessageModal = ({ message, onClose, user }: Props) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatID, setSelectedChatID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    // Fetch list of chats
    const fetchChats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API}/chats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await response.json();
        setChats(data || []);
      } catch (error) {
        console.error('Error fetching chats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, []);

  const handleForward = async () => {
    if (!selectedChatID || !user?.userID || !message.messageID) return;

    setIsSending(true);
    try {
      socket.emit('forward_message', {
        originalMessageID: message.messageID,
        targetChatID: selectedChatID,
        senderID: user.userID,
        senderInfo: {
          name: user.name || 'Người dùng',
          avatar: null,
        },
      });

      onClose();
    } catch (error) {
      console.error('Error forwarding message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const selectedChat = chats.find((c) => c.chatID === selectedChatID);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Chuyển tiếp tin nhắn</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tin nhắn gốc:</p>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-800 dark:text-gray-100 break-words">
              {message.content || '[Media]'}
            </p>
            {message.media_url && message.media_url.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                + {message.media_url.length} tệp đính kèm
              </p>
            )}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-center text-gray-400 text-sm">Đang tải danh sách cuộc trò chuyện...</p>
          ) : chats.length === 0 ? (
            <p className="text-center text-gray-400 text-sm">Không có cuộc trò chuyện nào</p>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <button
                  key={chat.chatID}
                  onClick={() => setSelectedChatID(chat.chatID)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedChatID === chat.chatID
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-[#0e9de8]'
                      : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <img
                    src={chat.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + chat.chatID}
                    alt={chat.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {chat.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {chat.type === 'private' ? 'Tin nhắn riêng' : 'Nhóm'}
                    </p>
                  </div>
                  {selectedChatID === chat.chatID && (
                    <div className="w-5 h-5 rounded-full bg-[#0e9de8] flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium text-sm"
          >
            Hủy
          </button>
          <button
            onClick={handleForward}
            disabled={!selectedChatID || isSending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0e9de8] text-white rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            <FaPaperPlane className="text-xs" />
            {isSending ? 'Đang gửi...' : 'Chuyển tiếp'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal;