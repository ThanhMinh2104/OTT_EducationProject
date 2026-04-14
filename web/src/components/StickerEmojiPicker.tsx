import { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface Props {
  onEmojiClick: (emojiData: EmojiClickData) => void;
  onStickerClick: (stickerUrl: string) => void;
  onGifClick: (gifUrl: string) => void;
  onClose: () => void;
}

// Giphy API key - Bạn cần đăng ký tại https://developers.giphy.com/
const GIPHY_API_KEY = 'iw8DsJkjCByct4EHovySloueKpn6ljwK'; // Thay bằng API key của bạn

interface GiphyGif {
  id: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
}

// Sample stickers - bạn có thể thay thế bằng sticker thật từ API hoặc assets
const SAMPLE_STICKERS = [
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002734/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002735/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002736/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002737/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002738/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002739/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002740/android/sticker.png',
  'https://stickershop.line-scdn.net/stickershop/v1/sticker/52002741/android/sticker.png',
];

const StickerEmojiPicker = ({ onEmojiClick, onStickerClick, onGifClick, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<'sticker' | 'emoji' | 'gif'>('sticker');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  // Fetch trending GIFs khi mở tab GIF
  useEffect(() => {
    if (activeTab === 'gif' && gifs.length === 0) {
      fetchTrendingGifs();
    }
  }, [activeTab]);

  // Search GIFs khi user nhập
  useEffect(() => {
    if (activeTab === 'gif' && searchQuery) {
      const timer = setTimeout(() => {
        searchGifs(searchQuery);
      }, 500);
      return () => clearTimeout(timer);
    } else if (activeTab === 'gif' && !searchQuery) {
      fetchTrendingGifs();
    }
  }, [searchQuery, activeTab]);

  const fetchTrendingGifs = async () => {
    setIsLoadingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const searchGifs = async (query: string) => {
    setIsLoadingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
      onClick={onClose}
    >
      <div 
        className="w-[40%] h-[70%] bg-[#1e2a3a] rounded-2xl shadow-2xl flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 flex-shrink-0">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('sticker')}
              className={`py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'sticker' ? 'text-[#4a9eff]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              STICKER
              {activeTab === 'sticker' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4a9eff]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('emoji')}
              className={`py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'emoji' ? 'text-[#4a9eff]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              EMOJI
              {activeTab === 'emoji' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4a9eff]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('gif')}
              className={`py-3 text-sm font-medium transition-colors relative ${
                activeTab === 'gif' ? 'text-[#4a9eff]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              GIF
              {activeTab === 'gif' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4a9eff]" />
              )}
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        {(activeTab === 'sticker' || activeTab === 'gif') && (
          <div className="p-4 flex-shrink-0">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'sticker' ? 'Tìm kiếm sticker' : 'Tìm kiếm GIF'}
                className="w-full pl-10 pr-4 py-2 bg-[#2a3a4a] text-white rounded-full text-sm outline-none placeholder:text-gray-500"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded">
          {activeTab === 'sticker' && (
            <div>
              <h3 className="text-white text-sm font-medium mb-3">Gần đây</h3>
              <div className="grid grid-cols-4 gap-3">
                {SAMPLE_STICKERS.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => onStickerClick(url)}
                    className="aspect-square bg-[#2a3a4a] rounded-lg hover:bg-[#3a4a5a] transition-colors p-2"
                  >
                    <img src={url} alt="sticker" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'emoji' && (
            <div className="emoji-picker-container h-full flex items-center justify-center">
              <EmojiPicker onEmojiClick={onEmojiClick} width="100%" height="100%" />
            </div>
          )}

          {activeTab === 'gif' && (
            <div>
              <h3 className="text-white text-sm font-medium mb-3">
                {searchQuery ? `Kết quả cho "${searchQuery}"` : 'Xu hướng'}
              </h3>
              {isLoadingGifs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4a9eff]"></div>
                </div>
              ) : gifs.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {gifs.map((gif) => (
                    <button
                      key={gif.id}
                      onClick={() => onGifClick(gif.images.original.url)}
                      className="aspect-square bg-[#2a3a4a] rounded-lg hover:ring-2 hover:ring-[#4a9eff] transition-all overflow-hidden"
                    >
                      <img 
                        src={gif.images.fixed_height.url} 
                        alt="gif" 
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">Không tìm thấy GIF nào</p>
                </div>
              )}
              <div className="mt-4 text-center">
                <a 
                  href="https://giphy.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-500 text-xs hover:text-gray-400"
                >
                  Powered by GIPHY
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StickerEmojiPicker;
