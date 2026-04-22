import React, { useEffect, useState, useRef } from 'react';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
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

interface PinnedNote {
  noteID: string;
  groupID: string;
  creatorID: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
}

type PinnedItem = (PinnedMessage & { itemType: 'message' }) | (PinnedNote & { itemType: 'note' });

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
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPinnedItems();

    // Listen to socket events for real-time updates
    const handlePinNotification = (data: any) => {
      console.log('📌 PinnedMessagesPanel - Pin notification received:', data);
      fetchPinnedItems();
    };

    const handleUnpinNotification = (data: any) => {
      console.log('📌 PinnedMessagesPanel - Unpin notification received:', data);
      fetchPinnedItems();
    };

    const handleNotePinToggled = (data: any) => {
      console.log('📝 PinnedMessagesPanel - Note pin toggled:', data);
      fetchPinnedItems();
    };

    socket.on('ghim_group_notification', handlePinNotification);
    socket.on('unghim_group_notification', handleUnpinNotification);
    socket.on('note_pin_toggled', handleNotePinToggled);

    return () => {
      socket.off('ghim_group_notification', handlePinNotification);
      socket.off('unghim_group_notification', handleUnpinNotification);
      socket.off('note_pin_toggled', handleNotePinToggled);
    };
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

  const fetchPinnedItems = async () => {
    try {
      setLoading(true);
      
      // Fetch pinned messages
      const messagesRes = await axiosInstance.get(`/groups/${groupID}/messages?page=1&limit=100`);
      const pinnedMessages = messagesRes.data.messages
        .filter((msg: any) => msg.pinnedInfo)
        .map((msg: any) => ({ ...msg, itemType: 'message' as const }));
      
      // Fetch pinned notes
      const notesRes = await axiosInstance.get(`/groups/${groupID}/notes`);
      const pinnedNotes = (notesRes.data.notes || [])
        .filter((note: any) => note.isPinned)
        .map((note: any) => ({ ...note, itemType: 'note' as const }));
      
      // Combine and sort by pinned time
      const allPinned = [...pinnedMessages, ...pinnedNotes].sort((a, b) => {
        const timeA = a.itemType === 'message' 
          ? new Date(a.pinnedInfo?.pinnedAt || 0).getTime()
          : new Date(a.createdAt || 0).getTime();
        const timeB = b.itemType === 'message'
          ? new Date(b.pinnedInfo?.pinnedAt || 0).getTime()
          : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      
      setPinnedItems(allPinned);
    } catch (error) {
      console.error('Error fetching pinned items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (item: PinnedItem) => {
    try {
      if (item.itemType === 'message') {
        await axiosInstance.post(`/groups/${groupID}/messages/${item.messageID}/unpin`);
        toast.success('Đã bỏ ghim tin nhắn');
      } else {
        await axiosInstance.post(`/groups/${groupID}/notes/${item.noteID}/toggle-pin`);
        toast.success('Đã bỏ ghim ghi chú');
      }
      fetchPinnedItems();
      setShowMenu(false);
    } catch (error) {
      toast.error('Không thể bỏ ghim');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép');
    setShowMenu(false);
  };

  const handleItemClick = (item: PinnedItem) => {
    if (item.itemType === 'message') {
      onScrollToMessage?.(item.messageID);
    } else {
      // Open board modal to view note
      onViewBoard?.('notes');
    }
  };

  if (pinnedItems.length === 0 && !loading) return null;

  const latestItem = pinnedItems[0];
  const otherCount = pinnedItems.length - 1;

  // Get display info for latest item
  const getItemDisplayInfo = (item: PinnedItem) => {
    if (item.itemType === 'message') {
      let content = item.content || (item.type === 'image' ? '[Hình ảnh]' : '[Tệp tin]');
      
      if (item.content?.startsWith('POLL_NOTIF|')) {
        const parts = item.content.split('|');
        const [_, action, pollID, pollName, userName] = parts;
        let actionText = 'đã tham gia bình chọn:';
        if (action === 'CREATE') actionText = 'đã tạo bình chọn:';
        if (action === 'LEAVE') actionText = 'đã bỏ bình chọn:';
        if (action === 'CHANGE') actionText = 'đã đổi lựa chọn:';
        if (action === 'LOCK') actionText = 'đã khóa bình chọn:';
        if (action === 'SHARE') actionText = 'đã chia sẻ bình chọn:';
        content = `${actionText} ${pollName}`;
      } else if (item.content?.startsWith('##POLL_')) {
        const parts = item.content.split('|');
        const type = parts[0];
        const question = parts[2];
        if (type === '##POLL_CREATED##') content = `đã tạo bình chọn: ${question}`;
        else if (type === '##POLL_VOTED##') content = `đã tham gia bình chọn: ${question}`;
        else if (type === '##POLL_CLOSED##') content = `đã khóa bình chọn: ${question}`;
        else if (type === '##POLL_DELETED##') content = `bình chọn đã bị xóa: ${question}`;
        else if (type === '##POLL_OPTION_ADDED##') content = `đã thêm lựa chọn vào bình chọn: ${question}`;
      }

      return {
        type: 'Tin nhắn',
        icon: '💬',
        name: item.senderInfo?.name || 'Người dùng',
        content: content
      };
    } else {
      return {
        type: 'Ghi chú',
        icon: '📝',
        name: item.creatorInfo?.name || 'Người dùng',
        content: item.content
      };
    }
  };

  const latestInfo = latestItem ? getItemDisplayInfo(latestItem) : null;

  return (
    <div className="pinned-messages-container">
      <div className="pinned-icon-wrapper">
        {latestInfo?.icon}
      </div>

      <div className="pinned-main-content" onClick={() => latestItem && handleItemClick(latestItem)}>
        <div className="pinned-type-label">{latestInfo?.type}</div>
        <div className="pinned-text-preview">
          <span className="font-semibold">{latestInfo?.name}: </span>
          {latestInfo?.content}
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
                {pinnedItems.map((item) => {
                  const info = getItemDisplayInfo(item);
                  const itemKey = item.itemType === 'message' ? item.messageID : item.noteID;
                  const itemTime = item.itemType === 'message' 
                    ? item.pinnedInfo?.pinnedAt 
                    : item.createdAt;
                  
                  return (
                    <div 
                      key={itemKey} 
                      className="popover-item"
                      onClick={() => {
                        handleItemClick(item);
                        setShowDropdown(false);
                      }}
                    >
                      <div className="popover-icon">
                        {info.icon}
                      </div>
                      <div className="popover-content">
                        <div className="font-semibold text-[13px]">{info.name}</div>
                        <div className="text-[13px] text-gray-600 truncate">{info.content}</div>
                        <div className="popover-info">
                          {new Date(itemTime || 0).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                onClick={() => handleCopy(latestInfo?.content || '')}
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
                onClick={() => latestItem && handleUnpin(latestItem)}
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
