import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';
import './PinnedMessagesPanel.css';

interface PinnedMessage {
  messageID: string;
  senderID: string;
  content?: string;
  timestamp: Date;
  senderInfo: {
    name: string;
  };
}

interface PinnedMessagesPanelProps {
  groupID: string;
  onClose: () => void;
}

export const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({
  groupID,
  onClose,
}) => {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPinnedMessages();
  }, [groupID]);

  const fetchPinnedMessages = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=100`);
      const pinned = response.data.messages.filter((msg: any) => msg.pinnedInfo);
      setPinnedMessages(pinned);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pinned-messages-panel">
      <div className="panel-header">
        <h3>📌 Tin nhắn đã ghim</h3>
        <button className="btn-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="panel-content">
        {loading ? (
          <div className="empty-pinned">Đang tải...</div>
        ) : pinnedMessages.length === 0 ? (
          <div className="empty-pinned">Chưa có tin nhắn nào được ghim</div>
        ) : (
          pinnedMessages.map((msg) => (
            <div key={msg.messageID} className="pinned-message">
              <div className="pinned-sender">{msg.senderInfo?.name}</div>
              <div className="pinned-content">{msg.content}</div>
              <div className="pinned-time">
                {new Date(msg.timestamp).toLocaleString('vi-VN')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
