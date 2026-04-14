/**
 * Image Optimizer - tối ưu hóa hình ảnh
 * Dùng WebP format, compress, lazy load
 */

type ImageSize = 'small' | 'medium' | 'large' | 'full';

const SIZES = {
  small: { width: 48, height: 48 },
  medium: { width: 96, height: 96 },
  large: { width: 200, height: 200 },
  full: { width: 800, height: 800 },
};

/**
 * Tối ưu hóa URL hình ảnh từ Cloudinary
 * Thêm transformation: resize, quality, format
 */
export const getOptimizedImageUrl = (
  url: string | undefined | null,
  size: ImageSize = 'medium',
  quality: number = 80
): string => {
  // Fallback avatar nếu không có URL
  if (!url) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
  }

  // Nếu là Cloudinary URL, thêm transformation
  if (url.includes('cloudinary.com')) {
    const { width, height } = SIZES[size];
    const transformation = `w_${width},h_${height},c_fill,q_${quality},f_auto`;
    return url.replace('/upload/', `/upload/${transformation}/`);
  }

  // Nếu là dicebear URL, không cần optimize
  if (url.includes('dicebear.com')) {
    return url;
  }

  // Cho các URL khác, trả về như cũ
  return url;
};

/**
 * Tạo srcset cho responsive images
 */
export const getImageSrcSet = (url: string | undefined | null): string => {
  if (!url || !url.includes('cloudinary.com')) {
    return '';
  }

  return [
    `${getOptimizedImageUrl(url, 'small')} 48w`,
    `${getOptimizedImageUrl(url, 'medium')} 96w`,
    `${getOptimizedImageUrl(url, 'large')} 200w`,
  ].join(', ');
};

/**
 * Preload image để tránh flashing
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

export default {
  getOptimizedImageUrl,
  getImageSrcSet,
  preloadImage,
};
