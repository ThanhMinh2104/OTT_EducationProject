import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaSearch, FaTimes, FaUser, FaCalendarAlt, FaChevronDown } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import './GroupSearchModal.css';

interface SearchResult {
  messageID: string;
  senderID: string;
  content?: string;
  timestamp: Date;
  senderInfo: {
    name: string;
    avatar?: string | null;
  };
}

interface GroupMember {
  userID: string;
  name: string;
  avatar?: string;
}

interface GroupSearchModalProps {
  groupID: string;
  members?: GroupMember[];
  onClose: () => void;
  onScrollToMessage?: (messageID: string) => void;
  highlightedMsgId?: string | null;
}

export const GroupSearchModal: React.FC<GroupSearchModalProps> = ({
  groupID,
  members = [],
  onClose,
  onScrollToMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSender, setSelectedSender] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showSenderDropdown, setShowSenderDropdown] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string, sender: string, from: string, to: string) => {
    if (!q.trim() && !sender && !from && !to) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (sender) params.set('senderID', sender);
      if (from) params.set('fromDate', from);
      if (to) params.set('toDate', to);
      const response = await axiosInstance.get(`/groups/${groupID}/search?${params}`);
      setResults(response.data);
    } catch (error) {
      console.error('Error searching messages:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [groupID]);

  const triggerSearch = (q: string, sender: string, from: string, to: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q, sender, from, to), 350);
  };

  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    triggerSearch(val, selectedSender, fromDate, toDate);
  };

  const handleSenderSelect = (uid: string) => {
    setSelectedSender(uid);
    setShowSenderDropdown(false);
    triggerSearch(searchQuery, uid, fromDate, toDate);
  };

  const handleDateChange = (field: 'from' | 'to', val: string) => {
    const newFrom = field === 'from' ? val : fromDate;
    const newTo = field === 'to' ? val : toDate;
    if (field === 'from') setFromDate(val);
    else setToDate(val);
    triggerSearch(searchQuery, selectedSender, newFrom, newTo);
  };

  const handleClearFilters = () => {
    setSelectedSender('');
    setFromDate('');
    setToDate('');
    triggerSearch(searchQuery, '', '', '');
  };

  const handleClickResult = (result: SearchResult) => {
    setClickedId(result.messageID);
    onScrollToMessage?.(result.messageID);
    setTimeout(() => setClickedId(null), 2000);
  };

  const highlightText = (text: string, keyword: string) => {
    if (!keyword.trim()) return text;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase()
        ? <mark key={i} className="gs-highlight">{part}</mark>
        : part
    );
  };

  const formatDate = (ts: Date) => {
    const d = new Date(ts);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const selectedSenderName = members.find(m => m.userID === selectedSender)?.name || '';
  const hasFilters = selectedSender || fromDate || toDate;

  return (
    <div className="gs-panel">
      {/* Header */}
      <div className="gs-header">
          <span className="gs-title">Tìm kiếm trong trò chuyện</span>
          <button className="gs-close" onClick={onClose}><FaTimes /></button>
        </div>

        {/* Search input */}
        <div className="gs-search-row">
          <FaSearch className="gs-search-icon" />
          <input
            ref={inputRef}
            className="gs-search-input"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={e => handleQueryChange(e.target.value)}
          />
          {searchQuery && (
            <button className="gs-clear-btn" onClick={() => handleQueryChange('')}>Xóa</button>
          )}
        </div>

        {/* Filters */}
        <div className="gs-filters">
          <span className="gs-filter-label">Lọc theo:</span>

          {/* Sender filter */}
          <div className="gs-filter-dropdown-wrap">
            <button
              className={`gs-filter-btn ${selectedSender ? 'gs-filter-active' : ''}`}
              onClick={() => { setShowSenderDropdown(v => !v); setShowDateFilter(false); }}
            >
              <FaUser size={11} />
              <span>{selectedSenderName || 'Người gửi'}</span>
              <FaChevronDown size={10} />
            </button>
            {showSenderDropdown && (
              <div className="gs-dropdown">
                <div className="gs-dropdown-item" onClick={() => handleSenderSelect('')}>
                  Tất cả
                </div>
                {members.map(m => (
                  <div
                    key={m.userID}
                    className={`gs-dropdown-item ${selectedSender === m.userID ? 'gs-dropdown-selected' : ''}`}
                    onClick={() => handleSenderSelect(m.userID)}
                  >
                    {m.avatar
                      ? <img src={m.avatar} className="gs-dropdown-avatar" alt="" />
                      : <div className="gs-dropdown-avatar gs-avatar-placeholder">{m.name[0]}</div>
                    }
                    {m.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date filter */}
          <div className="gs-filter-dropdown-wrap">
            <button
              className={`gs-filter-btn ${(fromDate || toDate) ? 'gs-filter-active' : ''}`}
              onClick={() => { setShowDateFilter(v => !v); setShowSenderDropdown(false); }}
            >
              <FaCalendarAlt size={11} />
              <span>Ngày gửi</span>
              <FaChevronDown size={10} />
            </button>
            {showDateFilter && (
              <div className="gs-dropdown gs-date-dropdown">
                <div className="gs-date-row">
                  <label>Từ ngày</label>
                  <input type="date" value={fromDate} onChange={e => handleDateChange('from', e.target.value)} className="gs-date-input" />
                </div>
                <div className="gs-date-row">
                  <label>Đến ngày</label>
                  <input type="date" value={toDate} onChange={e => handleDateChange('to', e.target.value)} className="gs-date-input" />
                </div>
              </div>
            )}
          </div>

          {hasFilters && (
            <button className="gs-clear-filters" onClick={handleClearFilters}>Xóa lọc</button>
          )}
        </div>

        {/* Results */}
        <div className="gs-results">
          {loading ? (
            <div className="gs-empty">Đang tìm kiếm...</div>
          ) : results.length === 0 ? (
            <div className="gs-empty">
              {(searchQuery || hasFilters) ? 'Không tìm thấy kết quả' : 'Nhập để tìm kiếm tin nhắn'}
            </div>
          ) : (
            <>
              <div className="gs-results-label">Tin nhắn</div>
              {results.map(r => (
                <div
                  key={r.messageID}
                  className={`gs-result-item ${clickedId === r.messageID ? 'gs-result-clicked' : ''}`}
                  onClick={() => handleClickResult(r)}
                >
                  <div className="gs-result-avatar">
                    {r.senderInfo?.avatar
                      ? <img src={r.senderInfo.avatar} alt="" />
                      : <div className="gs-avatar-placeholder">{r.senderInfo?.name?.[0] || '?'}</div>
                    }
                  </div>
                  <div className="gs-result-body">
                    <div className="gs-result-meta">
                      <span className="gs-result-name">{r.senderInfo?.name}</span>
                      <span className="gs-result-time">{formatDate(r.timestamp)}</span>
                    </div>
                    <div className="gs-result-content">
                      {highlightText(r.content || '', searchQuery)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
    </div>
  );
};
