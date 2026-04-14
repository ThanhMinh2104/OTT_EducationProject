import { useRef } from 'react';
import { FaTimes, FaFileAlt, FaFilePdf, FaFileWord, FaFileExcel } from 'react-icons/fa';

interface Props {
  files: File[];
  onConfirm: () => void;
  onCancel: () => void;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getDocIcon = (mime: string) => {
  if (mime === 'application/pdf') return <FaFilePdf className="text-red-500 text-3xl" />;
  if (mime.includes('word')) return <FaFileWord className="text-blue-500 text-3xl" />;
  if (mime.includes('excel') || mime.includes('spreadsheet')) return <FaFileExcel className="text-green-500 text-3xl" />;
  return <FaFileAlt className="text-gray-500 text-3xl" />;
};

const FilePreviewModal = ({ files, onConfirm, onCancel }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!files.length) return null;

  const isAllImages = files.every((f) => f.type.startsWith('image/'));
  const isVideo = files.length === 1 && files[0].type.startsWith('video/');
  const isDoc = files.length === 1 && !files[0].type.startsWith('image/') && !files[0].type.startsWith('video/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Xem trước trước khi gửi</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Ảnh grid */}
          {isAllImages && (
            <div className={`grid gap-2 ${files.length === 1 ? 'grid-cols-1' : files.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Video player */}
          {isVideo && (
            <div className="rounded-lg overflow-hidden bg-black">
              <video
                ref={videoRef}
                src={URL.createObjectURL(files[0])}
                controls
                className="w-full max-h-72"
              />
            </div>
          )}

          {/* Document info */}
          {isDoc && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              {getDocIcon(files[0].type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{files[0].name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatSize(files[0].size)}</p>
              </div>
            </div>
          )}

          {/* File count info */}
          {files.length > 1 && (
            <p className="text-xs text-gray-400 mt-3 text-center">{files.length} file được chọn</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#0e9de8] text-white text-sm font-medium hover:bg-[#0077c2] transition-colors"
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
