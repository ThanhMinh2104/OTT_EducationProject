import { useState, useRef } from 'react';
import { FaComments, FaTrash, FaShare } from 'react-icons/fa';
import { io, Socket } from 'socket.io-client';
import ForwardMessageModal from './ForwardMessageModal';

const socket: Socket = io('http://localhost:5000');

interface Message {
  messageID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
  status?: string;
  senderInfo?: { name: string; avatar?: string | null };
  forwardedFrom?: string;
}

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  chatID?: string;
}

interface User {
  name?: string;
  userID?: string;
}

interface Props {
  selectedChat: Chat | null;
  user: User | null;
}

const ChatWindow = ({ selectedChat, user }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<Message | null>(null);

  const handleDeleteLocal = (msg: Message) => {
    if (!msg.messageID || !user?.userID) return;
    
    socket.emit('delete_message_local', {
      messageID: msg.messageID,
      userID: user.userID,
      chatID: selectedChat?.chatID || selectedChat?.id,
    });
    
    setActionMsgId(null);
  };

  const handleForwardClick = (msg: Message) => {
    setSelectedMessageForForward(msg);
    setShowForwardModal(true);
    setActionMsgId(null);
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-gray-100 dark:bg-gray-800">
        <div className="flex-1 flex flex-col justify-center items-center gap-4 bg-gradient-to-br from-blue-50 to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <div className="w-20 h-20 bg-gradient-to-br from-[#0e9de8] to-[#0077c2] dark:from-blue-600 dark:to-blue-800 rounded-full flex items-center justify-center text-white text-4xl shadow-[0_4px_16px_rgba(14,157,232,0.35)]">
            <FaComments />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0">
            Chào mừng, {user?.name}!
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 m-0">
            Chọn một cuộc trò chuyện để bắt đầu nhắn tin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-100 dark:bg-gray-800" onClick={() => setActionMsgId(null)}>
      <div className="flex-1 flex w-full h-full">
        <div className="flex-1 h-full bg-white dark:bg-gray-900 flex flex-col">
          {/* Header */}
          <div className="flex items-center px-4.5 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <img
              src={selectedChat.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User123'}
              alt="avatar"
              className="w-[42px] h-[42px] rounded-full object-cover mr-3 border-2 border-blue-100 dark:border-blue-800"
            />
            <div>
              <h2 className="text-[15px] font-bold m-0 mb-0.5 text-gray-900 dark:text-gray-100">
                {selectedChat.name}
              </h2>
              <p className="text-xs text-green-500 dark:text-green-400 m-0 flex items-center gap-1">
                <span className="w-[7px] h-[7px] bg-green-500 dark:bg-green-400 rounded-full inline-block" />
                Đang hoạt động
              </p>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-2.5 bg-gray-100 dark:bg-gray-800 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded">
            {messages.map((msg) => {
              const isMine = msg.senderID === user?.userID;
              const msgKey = msg.messageID || msg.timestamp;

              return (
                <div key={msgKey} className={`flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && (
                    <img
                      src={msg.senderInfo?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.senderID}
                      alt="av"
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1"
                    />
                  )}

                  <div className={`flex flex-col max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className="relative">
                      <div
                        className={`px-3 py-2 rounded-2xl shadow-sm cursor-pointer select-text ${
                          isMine
                            ? 'bg-[#0e9de8] text-white rounded-br-sm'
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-sm'
                        }`}
                        onContextMenu={(e) => { e.preventDefault(); setActionMsgId(msgKey as string); }}
                      >
                        <span className="text-sm whitespace-pre-wrap break-words">{msg.content}</span>
                      </div>

                      {/* Action menu */}
                      {actionMsgId === msgKey && (
                        <div
                          className={`absolute z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[160px] ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => handleForwardClick(msg)}>
                            <FaShare className="text-gray-400 text-xs" /> Chuyển tiếp
                          </button>
                          {isMine && (
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              onClick={() => handleDeleteLocal(msg)}>
                              <FaTrash className="text-xs" /> Xóa phía tôi
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input area */}
          <div className="flex items-center px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 gap-2.5">
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-[22px] outline-none text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-[#0e9de8] dark:focus:border-blue-500 focus:bg-white dark:focus:bg-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Forward Modal */}
      {showForwardModal && selectedMessageForForward && (
        <ForwardMessageModal
          message={selectedMessageForForward}
          onClose={() => {
            setShowForwardModal(false);
            setSelectedMessageForForward(null);
          }}
          user={user}
        />
      )}
    </div>
  );
};

export default ChatWindow;