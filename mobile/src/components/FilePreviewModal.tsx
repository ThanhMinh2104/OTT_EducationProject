import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface FilePreviewModalProps {
  visible: boolean;
  fileName: string;
  fileUrl: string;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  visible,
  fileName,
  fileUrl,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const getFileType = () => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image';
    if (['txt', 'md', 'json', 'xml', 'csv', 'log'].includes(ext)) return 'text';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
    return 'unsupported';
  };

  const fileType = getFileType();

  const handleDownload = async () => {
    try {
      setDownloading(true);

      // Create file URI in cache directory
      const fileUri = FileSystem.cacheDirectory + fileName;

      // Download file using legacy API
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);

      if (downloadResult.status === 200) {
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          // Share/Save file with original name
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: getMimeType(fileName),
            dialogTitle: `Lưu ${fileName}`,
            UTI: getUTI(fileName),
          });
          Alert.alert('Thành công', `Đã tải xuống ${fileName}`);
        } else {
          Alert.alert('Thành công', 'File đã được tải xuống');
        }
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Lỗi', 'Không thể tải file. Vui lòng thử lại.');
    } finally {
      setDownloading(false);
    }
  };

  const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  const getUTI = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const utiTypes: { [key: string]: string } = {
      pdf: 'com.adobe.pdf',
      jpg: 'public.jpeg',
      jpeg: 'public.jpeg',
      png: 'public.png',
      txt: 'public.plain-text',
      doc: 'com.microsoft.word.doc',
      docx: 'org.openxmlformats.wordprocessingml.document',
      xls: 'com.microsoft.excel.xls',
      xlsx: 'org.openxmlformats.spreadsheetml.sheet',
    };
    return utiTypes[ext || ''] || 'public.data';
  };

  const renderContent = () => {
    // If error, show fallback UI
    if (error) {
      return (
        <View style={styles.unsupportedContainer}>
          <Icon name="error-outline" size={80} color="#f44336" />
          <Text style={styles.unsupportedTitle}>Không thể xem trước file này</Text>
          <Text style={styles.unsupportedText}>
            {fileType === 'office' 
              ? 'Office files có thể không xem được trên mobile. Vui lòng tải xuống để xem.'
              : 'Loại file này không hỗ trợ xem trước trên mobile'}
          </Text>
          <TouchableOpacity 
            style={styles.downloadButton} 
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="file-download" size={20} color="#fff" />
                <Text style={styles.downloadButtonText}>Tải xuống để xem</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.downloadButton, { backgroundColor: '#666', marginTop: 12 }]} 
            onPress={() => {
              setError(false);
              setLoading(true);
            }}
          >
            <Icon name="refresh" size={20} color="#fff" />
            <Text style={styles.downloadButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // PDF - Use Google Docs Viewer
    if (fileType === 'pdf') {
      return (
        <WebView
          source={{ uri: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true` }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
        />
      );
    }

    // Images - Direct display
    if (fileType === 'image') {
      return (
        <WebView
          source={{ uri: fileUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
        />
      );
    }

    // Text files - Fetch and display
    if (fileType === 'text') {
      return (
        <WebView
          source={{ uri: fileUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
        />
      );
    }

    // Office files - Use Google Docs Viewer
    if (fileType === 'office') {
      return (
        <>
          <WebView
            source={{ uri: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true` }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error:', nativeEvent);
              setError(true);
              setLoading(false);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView HTTP error:', nativeEvent.statusCode);
              if (nativeEvent.statusCode >= 400) {
                setError(true);
                setLoading(false);
              }
            }}
          />
          {/* Show hint for office files */}
          {loading && (
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>
                💡 Nếu không tải được, hãy nhấn nút tải xuống
              </Text>
            </View>
          )}
        </>
      );
    }

    // Unsupported
    return (
      <View style={styles.unsupportedContainer}>
        <Icon name="insert-drive-file" size={80} color="#999" />
        <Text style={styles.unsupportedTitle}>Không thể xem trước file này</Text>
        <Text style={styles.unsupportedText}>
          Loại file này không hỗ trợ xem trước trên mobile
        </Text>
        <TouchableOpacity 
          style={styles.downloadButton} 
          onPress={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="file-download" size={20} color="#fff" />
              <Text style={styles.downloadButtonText}>Tải xuống</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
            <Text style={styles.fileType}>
              {fileType === 'pdf' && 'PDF Document'}
              {fileType === 'image' && 'Hình ảnh'}
              {fileType === 'text' && 'Text File'}
              {fileType === 'office' && 'Office Document'}
              {fileType === 'unsupported' && 'File'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={handleDownload} 
              style={styles.iconButton}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <Icon name="file-download" size={24} color="#333" />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading && !error && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
          )}
          
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={60} color="#f44336" />
              <Text style={styles.errorTitle}>Không thể tải file</Text>
              <Text style={styles.errorText}>
                Vui lòng kiểm tra kết nối hoặc tải xuống để xem
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => {
                setError(false);
                setLoading(true);
              }}>
                <Text style={styles.retryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          )}

          {!error && renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fileType: {
    fontSize: 12,
    color: '#666',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  unsupportedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  unsupportedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  hintText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default FilePreviewModal;
