import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axios';
import './MediaGalleryModal.css';

interface MediaItem {
  url: string;
  messageID: string;
  senderID: string;
  timestamp: Date;
  type: string;
}

interface MediaGalleryModalProps {
  groupID: string;
  onClose: () => void;
}

export const MediaGalleryModal: React.FC<MediaGalleryModalProps> = ({ groupID, onClose }) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, [groupID]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/groups/${groupID}/media?type=image&limit=100`);
      setMedia(response.data.media);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="media-gallery-modal-overlay" onClick={onClose}>
      <div className="media-gallery-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="gallery-header">
          <h3>📸 Thư viện ảnh</h3>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="gallery-loading">Đang tải...</div>
        ) : media.length === 0 ? (
          <div className="gallery-empty">Chưa có ảnh nào</div>
        ) : (
          <div className="gallery-grid">
            {media.map((item) => (
              <div
                key={item.messageID}
                className="gallery-item"
                onClick={() => setSelectedImage(item.url)}
              >
                <img src={item.url} alt="media" />
              </div>
            ))}
          </div>
        )}

        {selectedImage && (
          <div className="image-viewer-overlay" onClick={() => setSelectedImage(null)}>
            <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
              <img src={selectedImage} alt="full" />
              <button className="btn-close-viewer" onClick={() => setSelectedImage(null)}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
