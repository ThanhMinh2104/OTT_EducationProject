import { useState, useEffect } from 'react';
import { FaTimes, FaPaperPlane } from 'react-icons/fa';
import { io, Socket } from 'socket.io-client';
import axiosInstance from '../utils/axios';

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

interface Member {
  userID: string;
  role: string;
}

interface Chat {
  chatID: string;
  name: string;
  avatar?: string;
  type: 'private' | 'group';
  members: Member[];
}

interface MemberInfo {
  userID: string;
  name: string;
  anhDaiDien?: string;
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
  const [memberCache, setMemberCache] = useState<Record<string, MemberInfo>>({});
  const [selectedChatID, setSelectedChatID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.post('/chats/userID');
        const data: Chat[] = Array.isArray(response.data) ? response.data : [];
        setChats(data);

        // Fetch tên thật cho các chat private
        const privateChats = data.filter((c) => c.type === 'private');
        await Promise.all(
          privateChats.map(async (c) => {
            const otherId = c.members.find((m) => m.userID !== user?.userID)?.userID;
            if (!otherId) return;
            try {
              const res = await fetch(`${API}/usersID`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userID: otherId }),
              });
              const info: MemberInfo = await res.json();
              setMemberCache((prev) => ({ ...prev, [otherId]: info }));
            } catch {
              /* ignore */
            }
          })
        );
      } catch (error) {
        console.error('Error fetching chats:', error);
        setChats([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, [user?.userID]);

  const getDisplayName = (chat: Chat): string => {
    if (chat.type === 'private') {
      const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
      if (otherId && memberCache[otherId]) return memberCache[otherId].name;
    }
    return chat.name;
  };

  const getDisplayAvatar = (chat: Chat): string => {
    if (chat.type === 'private') {
      const otherId = chat.members.find((m) => m.userID !== user?.userID)?.userID;
      if (otherId && memberCache[otherId]?.anhDaiDien) return memberCache[otherId].anhDaiDien!;
    }
    return chat.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.chatID}`;
  };

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Chuyển tiếp tin nhắn</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Tin nhắn gốc:</p>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="text-sm text-gray-800 break-words">
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
                      ? 'bg-blue-50 border border-[#0e9de8]'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <img
                    src={getDisplayAvatar(chat)}
                    alt={getDisplayName(chat)}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{getDisplayName(chat)}</p>
                    <p className="text-xs text-gray-500">
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
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium text-sm"
          >
            Hủy
          </button>
          <button
            onClick={handleForward}
            disabled={!selectedChatID || isSending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0e9de8] text-gray-900 rounded-lg hover:bg-[#0077c2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
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
