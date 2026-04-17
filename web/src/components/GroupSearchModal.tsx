import React, { useState } from 'react';
import axiosInstance from '../utils/axios';
import './GroupSearchModal.css';

interface SearchResult {
  messageID: string;
  senderID: string;
  content?: string;
  timestamp: Date;
  senderInfo: {
    name: string;
  };
}

interface GroupSearchModalProps {
  groupID: string;
  onClose: () => void;
}

export const GroupSearchModal: React.FC<GroupSearchModalProps> = ({ groupID, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axiosInstance.get(`/groups/${groupID}/search?q=${query}`);
      setResults(response.data);
    } catch (error) {
      console.error('Error searching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm tin nhắn..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          <button className="btn-close-search" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="search-results">
          {loading ? (
            <div className="search-loading">Đang tìm kiếm...</div>
          ) : results.length === 0 ? (
            <div className="search-empty">
              {searchQuery ? 'Không tìm thấy kết quả' : 'Nhập để tìm kiếm'}
            </div>
          ) : (
            results.map((result) => (
              <div key={result.messageID} className="search-result-item">
                <div className="result-sender">{result.senderInfo?.name}</div>
                <div className="result-content">{result.content}</div>
                <div className="result-time">
                  {new Date(result.timestamp).toLocaleString('vi-VN')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
