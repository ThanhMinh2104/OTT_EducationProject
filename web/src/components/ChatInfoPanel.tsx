import { useState, useEffect } from 'react';
import {
  FaTimes, FaDownload, FaFileAlt, FaLink,
  FaChevronLeft, FaChevronRight, FaTrash, FaExpand,
} from 'react-icons/fa';
import { getToken } from '../utils/auth';

const API = 'http://localhost:5000/api';

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
  trangThai?: string;
  sdt?: string;
}
interface Member { userID: string; role: string }
interface Message {
  messageID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
}
interface Chat {
  chatID: string;
  name: string;
  type: 'private' | 'group';
  avatar?: string;
  members: Member[];
  lastMessage: Message[];
}

interface Props {
  chat: Chat;
  user: User | null;
  memberInfo: User | null;
  messages: Message[];
  onClose: () => void;
  onHistoryDeleted: () => void;
}

type Tab = 'media' | 'files' | 'links';

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDate = (ts: string) => new Date(ts).toLocaleDateString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric',
});

// ── Fullscreen image viewer ────────────────────────────────────────────────
const ImageViewer = ({ urls, initialIndex, onClose }: {
  urls: string[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(urls.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10" onClick={onClose}>
        <FaTimes />
      </button>
      {urls.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }}
            disabled={idx === 0}
          >
            <FaChevronLeft />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(urls.length - 1, i + 1)); }}
            disabled={idx === urls.length - 1}
          >
            <FaChevronRight />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {idx + 1} / {urls.length}
          </span>
        </>
      )}
      <img
        src={urls[idx]}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={urls[idx]}
        download
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <FaDownload className="text-xs" /> Tải xuống
      </a>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
const ChatInfoPanel = ({ chat, memberInfo, messages, onClose, onHistoryDeleted }: Props) => {
  const [tab, setTab] = useState<Tab>('media');
  const [viewerUrls, setViewerUrls] = useState<string[] | null>(null);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Media từ messages (lazy — chỉ tính khi cần)
  const mediaImages = messages
    .filter((m) => m.type === 'image' && m.media_url?.length)
    .flatMap((m) => (m.media_url || []).map((url, i) => ({ url, timestamp: m.timestamp, id: `${m.messageID}_${i}` })));

  const mediaVideos = messages
    .filter((m) => m.type === 'video' && m.media_url?.length)
    .flatMap((m) => (m.media_url || []).map((url, i) => ({ url, timestamp: m.timestamp, id: `${m.messageID}_${i}` })));

  const mediaFiles = messages
    .filter((m) => m.type === 'file' && m.media_url?.length)
    .flatMap((m) => (m.media_url || []).map((url, i) => ({
      url, name: m.content || `file_${i}`, timestamp: m.timestamp, id: `${m.messageID}_${i}`,
    })));

  const mediaLinks = messages
    .filter((m) => m.type === 'text' && m.content?.match(/https?:\/\//))
    .map((m) => ({ url: m.content || '', timestamp: m.timestamp, id: m.messageID || m.timestamp }));

  const allImageUrls = mediaImages.map((i) => i.url);

  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API}/chats/${chat.chatID}/history`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        onHistoryDeleted();
        setShowDeleteConfirm(false);
      }
    } catch { /* ignore */ }
    finally { setIsDeleting(false); }
  };

  const chatName = chat.type === 'private' ? (memberInfo?.name || chat.name) : chat.name;
  const chatAvatar = chat.type === 'private'
    ? (memberInfo?.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${memberInfo?.userID}`)
    : (chat.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.chatID}`);

  return (
    <>
      <div
        className="w-[300px] border-l border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col shrink-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h3 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100 flex-1">Thông tin hội thoại</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Avatar + tên */}
        <div className="flex flex-col items-center py-5 px-4 border-b border-gray-100 dark:border-gray-700 shrink-0 gap-2">
          <div className="relative">
            <img src={chatAvatar} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-blue-100 dark:border-blue-800" />
            {chat.type === 'private' && (
              <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${memberInfo?.trangThai === 'online' ? 'bg-green-400' : 'bg-gray-300'}`} />
            )}
          </div>
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-[15px] text-center">{chatName}</p>
          {chat.type === 'private' && memberInfo?.sdt && (
            <p className="text-xs text-gray-400">{memberInfo.sdt}</p>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full ${memberInfo?.trangThai === 'online' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {chat.type === 'private'
              ? (memberInfo?.trangThai === 'online' ? 'Đang hoạt động' : 'Ngoại tuyến')
              : `${chat.members.length} thành viên`}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0">
          {(['media', 'files', 'links'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[12px] font-medium transition-colors border-b-2 ${tab === t ? 'text-[#0e9de8] border-[#0e9de8]' : 'text-gray-500 border-transparent hover:text-[#0e9de8]'}`}
            >
              {t === 'media' ? 'Ảnh/Video' : t === 'files' ? 'File' : 'Link'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700">
          {/* Ảnh/Video */}
          {tab === 'media' && (
            <>
              {mediaImages.length === 0 && mediaVideos.length === 0 ? (
                <EmptyState text="Chưa có ảnh/video" />
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {mediaImages.map((img, i) => (
                    <div key={img.id} className="relative group aspect-square cursor-pointer" onClick={() => { setViewerUrls(allImageUrls); setViewerIdx(i); }}>
                      <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                        <FaExpand className="text-white opacity-0 group-hover:opacity-100 text-sm transition-opacity" />
                      </div>
                    </div>
                  ))}
                  {mediaVideos.map((vid) => (
                    <div key={vid.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <video src={vid.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white text-xs">▶</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Files */}
          {tab === 'files' && (
            <>
              {mediaFiles.length === 0 ? (
                <EmptyState text="Chưa có file" />
              ) : (
                <div className="flex flex-col gap-2">
                  {mediaFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                      <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center shrink-0">
                        <FaFileAlt className="text-[#0e9de8] text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-medium text-gray-800 dark:text-gray-200 truncate">{f.name}</p>
                        <p className="text-[11px] text-gray-400">{formatDate(f.timestamp)}</p>
                      </div>
                      <a
                        href={f.url}
                        download={f.name}
                        target="_blank"
                        rel="noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#0e9de8] hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FaDownload className="text-xs" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Links */}
          {tab === 'links' && (
            <>
              {mediaLinks.length === 0 ? (
                <EmptyState text="Chưa có link" />
              ) : (
                <div className="flex flex-col gap-2">
                  {mediaLinks.map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <FaLink className="text-[#0e9de8] text-xs" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-blue-500 truncate">{l.url}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(l.timestamp)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-[13px] font-medium"
          >
            <FaTrash className="text-xs" />
            Xóa lịch sử trò chuyện
          </button>
        </div>
      </div>

      {/* Fullscreen image viewer */}
      {viewerUrls && (
        <ImageViewer
          urls={viewerUrls}
          initialIndex={viewerIdx}
          onClose={() => setViewerUrls(null)}
        />
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-[340px] mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <FaTrash className="text-red-500 text-lg" />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">Xóa lịch sử trò chuyện</h3>
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                Toàn bộ tin nhắn sẽ bị xóa khỏi thiết bị của bạn. Người khác vẫn thấy lịch sử chat.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteHistory}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
    <span className="text-3xl opacity-30">📂</span>
    <p className="text-sm">{text}</p>
  </div>
);

export default ChatInfoPanel;
