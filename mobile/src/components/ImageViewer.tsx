import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  FlatList,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const THUMB_SIZE = 56;
const THUMB_GAP = 6;
const THUMB_ACTIVE_BORDER = 2;

interface Props {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

const ImageViewer = ({ visible, images, initialIndex = 0, onClose }: Props) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const mainListRef = useRef<FlatList>(null);
  const thumbListRef = useRef<FlatList>(null);

  // Reset về initialIndex mỗi khi mở modal
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Scroll main carousel đến đúng ảnh
      setTimeout(() => {
        mainListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  // Auto-scroll thumbnail bar đến item active
  useEffect(() => {
    if (!visible || images.length <= 1) return;
    thumbListRef.current?.scrollToIndex({
      index: currentIndex,
      animated: true,
      viewPosition: 0.5, // center
    });
  }, [currentIndex, visible, images.length]);

  const handleThumbPress = useCallback((index: number) => {
    setCurrentIndex(index);
    mainListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const handleMainScroll = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) setCurrentIndex(index);
  }, [currentIndex]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          {images.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}

          {/* Spacer để counter căn giữa */}
          <View style={{ width: 44 }} />
        </View>

        {/* ── Main image carousel ── */}
        <FlatList
          ref={mainListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={handleMainScroll}
          onScrollToIndexFailed={(info) => {
            // Fallback: scroll sau khi list render xong
            setTimeout(() => {
              mainListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
              });
            }, 100);
          }}
          renderItem={({ item }) => (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: item }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          )}
          keyExtractor={(item, index) => `main-${index}-${item}`}
          style={{ flex: 1 }}
        />

        {/* ── Thumbnail bar phía dưới (kiểu Zalo) ── */}
        {images.length > 1 && (
          <View style={[styles.thumbBar, { paddingBottom: insets.bottom + 12 }]}>
            <FlatList
              ref={thumbListRef}
              data={images}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbList}
              getItemLayout={(_, index) => ({
                length: THUMB_SIZE + THUMB_GAP,
                offset: (THUMB_SIZE + THUMB_GAP) * index,
                index,
              })}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item, index }) => {
                const isActive = index === currentIndex;
                return (
                  <TouchableOpacity
                    onPress={() => handleThumbPress(index)}
                    activeOpacity={0.8}
                    style={[
                      styles.thumbWrapper,
                      isActive && styles.thumbWrapperActive,
                    ]}
                  >
                    <Image
                      source={{ uri: item }}
                      style={[
                        styles.thumb,
                        isActive ? styles.thumbActive : styles.thumbInactive,
                      ]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item, index) => `thumb-${index}-${item}`}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Main image
  imageWrapper: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width,
    height,
  },

  // Thumbnail bar
  thumbBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 10,
  },
  thumbList: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: THUMB_GAP,
    borderWidth: THUMB_ACTIVE_BORDER,
    borderColor: 'transparent',
  },
  thumbWrapperActive: {
    borderColor: '#0e9de8',
    // Shadow để nổi bật hơn
    shadowColor: '#0e9de8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 6,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbActive: {
    opacity: 1,
  },
  thumbInactive: {
    opacity: 0.5,
  },
});

export default ImageViewer;
