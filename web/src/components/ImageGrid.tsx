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
  // Gom tất cả URLs từ các messages
  const allImages = messages.flatMap(msg => msg.media_url || []);
  const count = allImages.length;

  if (count === 0) return null;

  const handleClick = (url: string) => {
    if (onImageClick) {
      onImageClick(url, allImages);
    }
  };

  // 1 ảnh - full width
  if (count === 1) {
    return (
      <div className="image-grid image-grid-1">
        <img
          src={allImages[0]}
          alt="Image"
          onClick={() => handleClick(allImages[0])}
          className="grid-image"
        />
      </div>
    );
  }

  // 2 ảnh - 2 cột
  if (count === 2) {
    return (
      <div className="image-grid image-grid-2">
        {allImages.map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt={`Image ${idx + 1}`}
            onClick={() => handleClick(url)}
            className="grid-image"
          />
        ))}
      </div>
    );
  }

  // 3 ảnh - 1 lớn + 2 nhỏ
  if (count === 3) {
    return (
      <div className="image-grid image-grid-3">
        <img
          src={allImages[0]}
          alt="Image 1"
          onClick={() => handleClick(allImages[0])}
          className="grid-image grid-image-large"
        />
        <div className="grid-small-column">
          <img
            src={allImages[1]}
            alt="Image 2"
            onClick={() => handleClick(allImages[1])}
            className="grid-image grid-image-small"
          />
          <img
            src={allImages[2]}
            alt="Image 3"
            onClick={() => handleClick(allImages[2])}
            className="grid-image grid-image-small"
          />
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
            <img
              src={url}
              alt={`Image ${idx + 1}`}
              onClick={() => handleClick(url)}
              className="grid-image"
            />
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
          <img
            src={url}
            alt={`Image ${idx + 1}`}
            onClick={() => handleClick(url)}
            className="grid-image"
          />
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
