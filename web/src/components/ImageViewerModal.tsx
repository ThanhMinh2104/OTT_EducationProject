import { useState, useEffect } from 'react';
import { FaTimes, FaChevronLeft, FaChevronRight, FaDownload } from 'react-icons/fa';

interface Props {
  images: { url: string; timestamp: string; messageID?: string }[];
  initialIndex: number;
  onClose: () => void;
}

const ImageViewerModal = ({ images, initialIndex, onClose }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

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
      year: 'numeric' 
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-900 transition-colors z-10"
      >
        <FaTimes className="text-xl" />
      </button>

      {/* Main content */}
      <div className="w-full h-full flex" onClick={(e) => e.stopPropagation()}>
        {/* Left: Main image */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-900 transition-colors"
              >
                <FaChevronLeft className="text-xl" />
              </button>

              <button
                onClick={handleNext}
                className="absolute right-[320px] top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-900 transition-colors"
              >
                <FaChevronRight className="text-xl" />
              </button>
            </>
          )}

          {/* Main image */}
          <img
            src={images[currentIndex].url}
            alt="Preview"
            className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg"
          />

          {/* Image info */}
          <div className="mt-4 flex items-center gap-4 text-gray-900/80">
            <span className="text-sm">
              {currentIndex + 1} / {images.length}
            </span>
            <span className="text-sm">
              {formatDate(images[currentIndex].timestamp)}
            </span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
            >
              <FaDownload className="text-xs" />
              Tải xuống
            </button>
          </div>
        </div>

        {/* Right: Thumbnail sidebar */}
        <div className="w-[300px] bg-[#1a1d21] border-l border-white/10 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-white/10">
            <h3 className="text-gray-900 font-semibold text-base">Ảnh/Video</h3>
            <p className="text-gray-900/60 text-sm mt-1">{images.length} ảnh</p>
          </div>

          {/* Thumbnails */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {images.map((img, index) => (
              <div
                key={img.messageID || index}
                onClick={() => setCurrentIndex(index)}
                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all ${
                  index === currentIndex
                    ? 'ring-2 ring-[#0e9de8] scale-[1.02]'
                    : 'hover:ring-2 hover:ring-white/30'
                }`}
              >
                <img
                  src={img.url}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-24 object-cover"
                />
                
                {/* Date overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs">
                    {formatDate(img.timestamp)}
                  </p>
                </div>

                {/* Current indicator */}
                {index === currentIndex && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-[#0e9de8] rounded-full" />
                )}
              </div>
            ))}
          </div>

          {/* Navigation arrows in sidebar */}
          {images.length > 1 && (
            <div className="p-3 border-t border-white/10 flex items-center justify-center gap-2">
              <button
                onClick={handlePrevious}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-900 transition-colors flex items-center justify-center gap-2"
              >
                <FaChevronLeft className="text-sm" />
                <span className="text-sm">Trước</span>
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-900 transition-colors flex items-center justify-center gap-2"
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
