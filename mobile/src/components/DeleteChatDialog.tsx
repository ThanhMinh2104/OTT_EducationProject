import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DeleteChatDialogProps {
  visible: boolean;
  chatName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteChatDialog: React.FC<DeleteChatDialogProps> = ({
  visible,
  chatName,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={isDeleting ? undefined : onCancel}
        />
        
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="trash-outline" size={32} color="#ef4444" />
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Xóa cuộc trò chuyện?</Text>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatName}
            </Text>
            <Text style={styles.message}>
              Toàn bộ nội dung trò chuyện sẽ bị xóa khỏi danh sách của bạn.
            </Text>
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
              <Text style={styles.note}>
                Tin nhắn vẫn tồn tại với người khác. Khi có tin nhắn mới, cuộc trò chuyện sẽ xuất hiện lại.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
              onPress={onConfirm}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.deleteButtonText}>Xóa</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 24,
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0068ff',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  note: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
