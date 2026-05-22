import React from 'react';
import './ImageGrid.css';

interface Message {
  messageID: string;
  media_url?: string[];
  [key: string]: any;
}

interface ImageGridProps {
  messages: Message[];
  onImageClick?: (url: string, allUrls: string[]) => void;
}

const ImageGrid: React.FC<ImageGridProps> = ({ messages, onImageClick }) => {
  const allImages = messages.flatMap(msg => {
    // Trích xuất danh sách URLs một cách an toàn (đề phòng media_url là string, mảng hoặc chuỗi JSON)
    let urls: any[] = [];
    if (Array.isArray(msg.media_url)) {
      urls = msg.media_url;
    } else if (typeof msg.media_url === 'string') {
      try {
        const parsed = JSON.parse(msg.media_url);
        if (Array.isArray(parsed)) {
          urls = parsed;
        } else {
          urls = [msg.media_url];
        }
      } catch {
        urls = [msg.media_url];
      }
    }

    return urls
      .map((u: any) => {
        if (typeof u !== 'string') return '';
        if (!u.includes('res.cloudinary.com')) return u;
        let fixed = u.includes('/raw/upload/') ? u.replace('/raw/upload/', '/image/upload/') : u;
        if (!fixed.includes('/f_auto')) fixed = fixed.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit/');
        return fixed;
      })
      .filter((u: string) => u && u.startsWith('http'));
  });
  const count = allImages.length;

  // Debug: log nếu có URL không hợp lệ
  if (process.env.NODE_ENV === 'development') {
    const rawUrls = messages.flatMap(msg => msg.media_url || []);
    if (rawUrls.length !== allImages.length) {
      console.warn('[ImageGrid] Filtered out invalid URLs:', rawUrls.filter((u: any) => typeof u !== 'string' || !u.startsWith('http')));
    }
    if (allImages.length > 0) {
      console.log('[ImageGrid] Rendering URLs:', allImages);
    }
  }

  if (count === 0) return null;

  const handleClick = (url: string) => {
    if (onImageClick) {
      onImageClick(url, allImages);
    }
  };

  const renderImg = (url: string, alt: string, className: string) => (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onClick={() => handleClick(url)}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );

  // 1 ảnh - full width
  if (count === 1) {
    return (
      <div className="image-grid image-grid-1">
        {renderImg(allImages[0], 'Image', 'grid-image')}
      </div>
    );
  }

  // 2 ảnh - 2 cột
  if (count === 2) {
    return (
      <div className="image-grid image-grid-2">
        {allImages.map((url, idx) => (
          <React.Fragment key={idx}>
            {renderImg(url, `Image ${idx + 1}`, 'grid-image')}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // 3 ảnh - 1 lớn + 2 nhỏ
  if (count === 3) {
    return (
      <div className="image-grid image-grid-3">
        {renderImg(allImages[0], 'Image 1', 'grid-image grid-image-large')}
        <div className="grid-small-column">
          {renderImg(allImages[1], 'Image 2', 'grid-image grid-image-small')}
          {renderImg(allImages[2], 'Image 3', 'grid-image grid-image-small')}
        </div>
      </div>
    );
  }

  // 4 ảnh - grid 2x2
  if (count === 4) {
    return (
      <div className="image-grid image-grid-4">
        {allImages.map((url, idx) => (
          <div key={idx} className="grid-image-wrapper">
            {renderImg(url, `Image ${idx + 1}`, 'grid-image')}
          </div>
        ))}
      </div>
    );
  }

  // 5+ ảnh - hiển thị 4 ảnh + overlay "+X"
  const remaining = count - 4;
  return (
    <div className="image-grid image-grid-4">
      {allImages.slice(0, 4).map((url, idx) => (
        <div key={idx} className="grid-image-wrapper">
          {renderImg(url, `Image ${idx + 1}`, 'grid-image')}
          {idx === 3 && remaining > 0 && (
            <div className="grid-overlay" onClick={() => handleClick(url)}>
              <span>+{remaining}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ImageGrid;
