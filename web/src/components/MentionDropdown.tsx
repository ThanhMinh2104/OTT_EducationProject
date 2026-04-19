import React, { useState, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { FaSmile, FaImage, FaStickyNote } from 'react-icons/fa';
import { AiOutlineGif } from 'react-icons/ai';

interface User {
  userID: string;
  name: string;
  avatar?: string;
  role?: string;
}

interface MentionDropdownProps {
  isOpen: boolean;
  members: User[];
  query: string;
  onSelect: (item: User | 'all' | 'gif' | 'sticker' | 'bot') => void;
  onClose: () => void;
  coords: { x: number; y: number };
  existingMentionIDs: string[]; // Danh sách các ID đã được tag
  disableAll?: boolean; // Nếu true, ẩn tùy chọn @All (dùng cho chat 1-1)
}

export interface MentionDropdownHandle {
  handleKeyDown: (e: React.KeyboardEvent | KeyboardEvent) => boolean;
}

const MentionDropdown = forwardRef<MentionDropdownHandle, MentionDropdownProps>(({
  isOpen,
  members,
  query,
  onSelect,
  onClose,
  coords,
  existingMentionIDs,
  disableAll,
}, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lọc thành viên dựa trên từ khóa tìm kiếm VÀ chưa được tag
  const filteredMembers = useMemo(() => {
    return members.filter((m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) &&
      !existingMentionIDs.includes(m.userID)
    );
  }, [members, query, existingMentionIDs]);

  // Các tùy chọn đặc biệt (@All, @GIF, @STICKER, @BOT)
  const hasAnyMentions = existingMentionIDs.some(id => id !== 'gif' && id !== 'sticker' && id !== 'bot');

  const showAll = !disableAll && (query === '' || 'all'.includes(query.toLowerCase())) && !existingMentionIDs.includes('all');
  const showGif = (query === '' || 'gif'.includes(query.toLowerCase())) && !existingMentionIDs.includes('gif') && !hasAnyMentions;
  const showSticker = (query === '' || 'sticker'.includes(query.toLowerCase())) && !existingMentionIDs.includes('sticker') && !hasAnyMentions;
  const showBot = (query === '' || 'bot'.includes(query.toLowerCase())) && !existingMentionIDs.includes('bot') && !hasAnyMentions;

  // Tổng hợp tất cả các mục để điều hướng bàn phím
  const allOptions = useMemo(() => {
    const options: any[] = [];
    if (showAll) options.push({ id: 'all', type: 'special' });
    filteredMembers.forEach((m) => options.push({ ...m, type: 'member' }));
    if (showBot) options.push({ id: 'bot', type: 'command' });
    if (showGif) options.push({ id: 'gif', type: 'command' });
    if (showSticker) options.push({ id: 'sticker', type: 'command' });
    return options;
  }, [filteredMembers, showAll, showGif, showSticker, showBot]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, allOptions.length]);

  // Expose hàm handleKeyDown cho cha gọi
  useImperativeHandle(ref, () => ({
    handleKeyDown: (e: React.KeyboardEvent | KeyboardEvent) => {
      if (!isOpen || allOptions.length === 0) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % allOptions.length);
        return true;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + allOptions.length) % allOptions.length);
        return true;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = allOptions[selectedIndex];
        if (selected) {
          if (selected.type === 'member') onSelect(selected);
          else onSelect(selected.id);
        }
        return true;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return true;
      }
      return false;
    }
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!isOpen || allOptions.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="fixed bg-white border border-gray-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-72 max-h-80 overflow-y-auto z-[9999] animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: coords.x,
        bottom: window.innerHeight - coords.y + 10,
      }}
    >
      {/* Sticky header - Sửa bg thành trắng đặc để không bị mờ khi cuộn */}
      <div className="px-3 py-2 border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nhắc tên, tìm sticker,gif</span>
      </div>

      <div className="p-1">
        {allOptions.map((option, index) => {
          const isSelected = index === selectedIndex;

          if (option.id === 'all') {
            return (
              <button
                key="all"
                onClick={() => onSelect('all')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#0068ff] flex items-center justify-center text-white shrink-0 shadow-sm font-bold text-sm">
                  @
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">Báo cho cả nhóm</p>
                  <p className="text-[11px] text-gray-400 leading-tight">@All</p>
                </div>
              </button>
            );
          }

          if (option.type === 'member') {
            return (
              <button
                key={option.userID}
                onClick={() => onSelect(option)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
              >
                <img
                  src={option.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${option.userID}`}
                  alt={option.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100"
                />
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{option.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {option.role === 'owner' ? 'Trưởng nhóm' : option.role === 'admin' ? 'Phó nhóm' : 'Thành viên'}
                  </p>
                </div>
              </button>
            );
          }

          if (option.id === 'bot') {
            return (
              <button
                key="bot"
                onClick={() => onSelect('bot')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border-t border-gray-50 mt-0.5 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-500 font-bold text-sm">
                  🤖
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700 leading-tight">Bot chat AI</p>
                  <p className="text-[11px] text-gray-400 leading-tight">@Bot</p>
                </div>
              </button>
            );
          }

          if (option.id === 'gif' || option.id === 'sticker') {
            const isGif = option.id === 'gif';
            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border-t border-gray-50 mt-0.5 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isGif ? 'bg-orange-100 text-orange-500' : 'bg-green-100 text-green-500'
                  }`}>
                  {isGif ? <AiOutlineGif size={22} /> : <FaStickyNote size={14} />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700 leading-tight">
                    {isGif ? 'Tìm GIF từ Tenor' : 'Tìm sticker'}
                  </p>
                  <p className="text-[11px] text-gray-400 leading-tight">
                    {isGif ? '@GIF' : '@STICKER'}
                  </p>
                </div>
              </button>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
});

MentionDropdown.displayName = 'MentionDropdown';

export default MentionDropdown;
