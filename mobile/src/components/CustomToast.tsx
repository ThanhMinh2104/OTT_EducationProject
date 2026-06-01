import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface CustomToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onHide: () => void;
}

export const CustomToast: React.FC<CustomToastProps> = ({
  visible,
  type,
  title,
  message,
  duration = 3000,
  onHide,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-100);
      opacity.setValue(0);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  const getConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          color: '#10b981',
          bgColor: '#d1fae5',
          borderColor: '#6ee7b7',
        };
      case 'error':
        return {
          icon: 'close-circle' as const,
          color: '#ef4444',
          bgColor: '#fee2e2',
          borderColor: '#fca5a5',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          color: '#f59e0b',
          bgColor: '#fef3c7',
          borderColor: '#fcd34d',
        };
      case 'info':
        return {
          icon: 'information-circle' as const,
          color: '#3b82f6',
          bgColor: '#dbeafe',
          borderColor: '#93c5fd',
        };
    }
  };

  const config = getConfig();

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: config.bgColor,
              borderColor: config.borderColor,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
              <Ionicons name={config.icon} size={24} color="#fff" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{title}</Text>
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
            <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
});
