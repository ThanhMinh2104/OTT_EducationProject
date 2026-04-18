import React from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';

interface Message {
  messageID?: string;
  media_url?: string[];
  [key: string]: any;
}

interface ImageGridProps {
  messages: Message[];
  onImageClick?: (url: string, allUrls: string[]) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = Math.min(SCREEN_WIDTH * 0.7, 300);

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
      <View style={styles.container}>
        <TouchableOpacity onPress={() => handleClick(allImages[0])} activeOpacity={0.9}>
          <Image
            source={{ uri: allImages[0] }}
            style={styles.singleImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    );
  }

  // 2 ảnh - 2 cột
  if (count === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.twoImageRow}>
          {allImages.map((url, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleClick(url)}
              activeOpacity={0.9}
              style={styles.twoImageItem}
            >
              <Image
                source={{ uri: url }}
                style={styles.twoImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // 3 ảnh - 1 lớn + 2 nhỏ
  if (count === 3) {
    return (
      <View style={styles.container}>
        <View style={styles.threeImageContainer}>
          <TouchableOpacity
            onPress={() => handleClick(allImages[0])}
            activeOpacity={0.9}
            style={styles.threeImageLarge}
          >
            <Image
              source={{ uri: allImages[0] }}
              style={styles.largeImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <View style={styles.threeImageSmallColumn}>
            <TouchableOpacity
              onPress={() => handleClick(allImages[1])}
              activeOpacity={0.9}
              style={styles.threeImageSmall}
            >
              <Image
                source={{ uri: allImages[1] }}
                style={styles.smallImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleClick(allImages[2])}
              activeOpacity={0.9}
              style={styles.threeImageSmall}
            >
              <Image
                source={{ uri: allImages[2] }}
                style={styles.smallImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 4+ ảnh - grid 2x2
  const remaining = count - 4;
  const imageSize = (MAX_WIDTH - 4) / 2; // Tính size cho mỗi ảnh trong grid 2x2
  
  return (
    <View style={styles.container}>
      <View style={styles.fourImageGrid}>
        {/* Hàng 1 */}
        <View style={styles.gridRow}>
          <TouchableOpacity
            onPress={() => handleClick(allImages[0])}
            activeOpacity={0.9}
            style={[styles.fourImageItem, { width: imageSize, height: imageSize }]}
          >
            <Image
              source={{ uri: allImages[0] }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleClick(allImages[1])}
            activeOpacity={0.9}
            style={[styles.fourImageItem, { width: imageSize, height: imageSize }]}
          >
            <Image
              source={{ uri: allImages[1] }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
        
        {/* Hàng 2 */}
        <View style={styles.gridRow}>
          <TouchableOpacity
            onPress={() => handleClick(allImages[2])}
            activeOpacity={0.9}
            style={[styles.fourImageItem, { width: imageSize, height: imageSize }]}
          >
            <Image
              source={{ uri: allImages[2] }}
              style={styles.gridImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleClick(allImages[3])}
            activeOpacity={0.9}
            style={[styles.fourImageItem, { width: imageSize, height: imageSize }]}
          >
            <Image
              source={{ uri: allImages[3] }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            {remaining > 0 && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>+{remaining}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: MAX_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // 1 ảnh
  singleImage: {
    width: MAX_WIDTH,
    height: MAX_WIDTH,
    borderRadius: 12,
  },

  // 2 ảnh
  twoImageRow: {
    flexDirection: 'row',
    gap: 4,
  },
  twoImageItem: {
    flex: 1,
  },
  twoImage: {
    width: '100%',
    height: 150,
  },

  // 3 ảnh
  threeImageContainer: {
    flexDirection: 'row',
    gap: 4,
    height: 200,
  },
  threeImageLarge: {
    flex: 1,
  },
  largeImage: {
    width: '100%',
    height: '100%',
  },
  threeImageSmallColumn: {
    flex: 1,
    gap: 4,
  },
  threeImageSmall: {
    flex: 1,
  },
  smallImage: {
    width: '100%',
    height: '100%',
  },

  // 4+ ảnh
  fourImageGrid: {
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  fourImageItem: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
});

export default ImageGrid;
