import React, { useEffect, useState, useRef } from 'react';
import axiosInstance from '../utils/axios';
import { FaChevronDown, FaEllipsisH, FaRegEnvelope, FaThumbtack } from 'react-icons/fa';
import './PinnedMessagesPanel.css';
import toast from 'react-hot-toast';

interface PinnedMessage {
  messageID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  pinnedInfo?: {
    pinnedAt: string;
    pinnedBy: string;
  };
  senderInfo: {
    name: string;
    avatar?: string;
  };
}

interface PinnedMessagesPanelProps {
  groupID: string;
  onClose: () => void;
  onViewBoard?: (tab?: string) => void;
  onScrollToMessage?: (messageID: string) => void;
}

export const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({
  groupID,
  onClose,
  onViewBoard,
  onScrollToMessage
}) => {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPinnedMessages();
  }, [groupID]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPinnedMessages = async () => {
    try {
      setLoading(true);
      // Backend filter pinned messages
      const response = await axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=100`);
      const pinned = response.data.messages
        .filter((msg: any) => msg.pinnedInfo)
        .sort((a: any, b: any) => new Date(b.pinnedInfo?.pinnedAt || 0).getTime() - new Date(a.pinnedInfo?.pinnedAt || 0).getTime());
      
      setPinnedMessages(pinned);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageID: string) => {
    try {
      await axiosInstance.post(`/groups/${groupID}/unpin`, { messageID });
      toast.success('Đã bỏ ghim tin nhắn');
      fetchPinnedMessages();
      setShowMenu(false);
    } catch (error) {
      toast.error('Không thể bỏ ghim tin nhắn');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép');
    setShowMenu(false);
  };

  if (pinnedMessages.length === 0 && !loading) return null;

  const latestMsg = pinnedMessages[0];
  const otherCount = pinnedMessages.length - 1;

  return (
    <div className="pinned-messages-container">
      <div className="pinned-icon-wrapper">
        <FaRegEnvelope />
      </div>

      <div className="pinned-main-content" onClick={() => latestMsg && onScrollToMessage?.(latestMsg.messageID)}>
        <div className="pinned-type-label">Tin nhắn</div>
        <div className="pinned-text-preview">
          <span className="font-semibold">{latestMsg?.senderInfo?.name}: </span>
          {latestMsg?.content || (latestMsg?.type === 'image' ? '[Hình ảnh]' : '[Tệp tin]')}
        </div>
      </div>

      <div className="pinned-right-actions">
        {otherCount > 0 && (
          <div className="relative" ref={dropdownRef}>
            <div className="pinned-count-dropdown" onClick={() => setShowDropdown(!showDropdown)}>
              +{otherCount} ghim <FaChevronDown size={10} />
            </div>

            {showDropdown && (
              <div className="pinned-list-popover custom-scrollbar">
                {pinnedMessages.map((msg) => (
                  <div 
                    key={msg.messageID} 
                    className="popover-item"
                    onClick={() => {
                      onScrollToMessage?.(msg.messageID);
                      setShowDropdown(false);
                    }}
                  >
                    <div className="popover-icon">
                       <FaThumbtack size={14} style={{ transform: 'rotate(45deg)' }} />
                    </div>
                    <div className="popover-content">
                      <div className="font-semibold text-[13px]">{msg.senderInfo?.name}</div>
                      <div className="text-[13px] text-gray-600 truncate">{msg.content || `[${msg.type}]`}</div>
                      <div className="popover-info">
                        {new Date(msg.pinnedInfo?.pinnedAt || 0).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={menuRef}>
          <button className="pinned-more-btn" onClick={() => setShowMenu(!showMenu)}>
            <FaEllipsisH />
          </button>

          {showMenu && (
            <div className="pinned-action-menu">
              <button 
                className="pinned-menu-item" 
                onClick={() => handleCopy(latestMsg?.content || '')}
              >
                Copy
              </button>
              <button 
                className="pinned-menu-item" 
                onClick={() => {
                  onViewBoard?.('all');
                  setShowMenu(false);
                }}
              >
                Mở bảng tin nhóm
              </button>
              <button 
                className="pinned-menu-item danger"
                onClick={() => handleUnpin(latestMsg.messageID)}
              >
                Bỏ ghim
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
