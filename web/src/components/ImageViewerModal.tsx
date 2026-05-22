import { useState, useEffect, useRef, useCallback } from 'react';
import { FaTimes, FaChevronLeft, FaChevronRight, FaDownload } from 'react-icons/fa';

interface Props {
  images: { url: string; timestamp: string; messageID?: string }[];
  initialIndex: number;
  onClose: () => void;
}

const ImageViewerModal = ({ images, initialIndex, onClose }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll sidebar đến thumbnail đang active
  useEffect(() => {
    const thumb = thumbnailRefs.current[currentIndex];
    const container = scrollContainerRef.current;
    if (!thumb || !container) return;

    const thumbTop = thumb.offsetTop;
    const thumbHeight = thumb.offsetHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    const isAbove = thumbTop < containerScrollTop;
    const isBelow = thumbTop + thumbHeight > containerScrollTop + containerHeight;

    if (isAbove || isBelow) {
      container.scrollTo({
        top: thumbTop - containerHeight / 2 + thumbHeight / 2,
        behavior: 'smooth',
      });
    }
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext, onClose]);

  const handleDownload = async () => {
    try {
      const response = await fetch(images[currentIndex].url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Nút đóng */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <FaTimes className="text-xl" />
      </button>

      <div className="w-full h-full flex" onClick={(e) => e.stopPropagation()}>
        {/* Bên trái: Ảnh phóng to */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <FaChevronLeft className="text-xl" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-[320px] top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <FaChevronRight className="text-xl" />
              </button>
            </>
          )}

          <img
            src={images[currentIndex].url}
            alt="Preview"
            className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg"
          />

          <div className="mt-4 flex items-center gap-4 text-white/85">
            <span className="text-sm">{currentIndex + 1} / {images.length}</span>
            <span className="text-sm">{formatDate(images[currentIndex].timestamp)}</span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm text-white/90"
            >
              <FaDownload className="text-xs" />
              Tải xuống
            </button>
          </div>
        </div>

        {/* Bên phải: Danh sách ảnh thu nhỏ */}
        <div className="w-[300px] bg-[#1a1d21] border-l border-white/10 flex flex-col">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-semibold text-base">Ảnh/Video</h3>
            <p className="text-white/60 text-sm mt-1">{images.length} ảnh</p>
          </div>

          {/* Danh sách thumbnail - có ref để auto-scroll */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-2"
          >
            {images.map((img, index) => {
              const isActive = index === currentIndex;
              return (
                <div
                  key={img.messageID || index}
                  ref={(el) => { thumbnailRefs.current[index] = el; }}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
                    isActive
                      ? 'ring-2 ring-[#0e9de8] scale-[1.02] shadow-[0_0_0_2px_#0e9de8]'
                      : 'hover:ring-2 hover:ring-white/30'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`Thumbnail ${index + 1}`}
                    className={`w-full h-24 object-cover transition-opacity duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                    }`}
                  />

                  {/* Overlay tối cho ảnh không active */}
                  {!isActive && (
                    <div className="absolute inset-0 bg-black/20 hover:bg-transparent transition-colors" />
                  )}

                  {/* Gradient + timestamp */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-white text-xs">{formatDate(img.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nút điều hướng */}
          {images.length > 1 && (
            <div className="p-3 border-t border-white/10 flex items-center justify-center gap-2">
              <button
                onClick={handlePrevious}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center gap-2"
              >
                <FaChevronLeft className="text-sm" />
                <span className="text-sm">Trước</span>
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-sm">Sau</span>
                <FaChevronRight className="text-sm" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageViewerModal;
