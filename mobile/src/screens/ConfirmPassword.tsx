import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import axios from 'axios';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';

type ConfirmPasswordProps = {
  navigation: StackNavigationProp<RootStackParamList, 'ConfirmPassword'>;
  route: RouteProp<RootStackParamList, 'ConfirmPassword'>;
};

// Kiểm tra mật khẩu: tối thiểu 8 ký tự, có chữ và số
const isValidPassword = (p: string) => /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(p);

const ConfirmPasswordScreen = ({ navigation, route }: ConfirmPasswordProps) => {
  const { sdt } = route.params;

  const [matKhauMoi, setMatKhauMoi] = useState('');
  const [xacNhan, setXacNhan] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State cho Modal thông báo thành công
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Xử lý đếm ngược khi Modal hiện lên
  useEffect(() => {
    if (showSuccessModal) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleGoToLogin();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showSuccessModal]);

  const handleGoToLogin = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowSuccessModal(false);
    navigation.navigate('Login');
  };

  const handleConfirm = async () => {
    setError('');
    if (!isValidPassword(matKhauMoi)) {
      setError('Mật khẩu tối thiểu 8 ký tự, bao gồm cả chữ và số!');
      return;
    }
    if (matKhauMoi !== xacNhan) {
      setError('Mật khẩu xác nhận không khớp!');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/users/doimatkhau`, {
        sdt,
        matKhauMoi
      });

      // Hiển thị Modal Thay vì dùng Alert
      setShowSuccessModal(true);
    } catch (err) {
      setError('Đổi mật khẩu thất bại, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>Mật khẩu mới</Text>
          <Text style={styles.subtitle}>
            Vui lòng tạo mật khẩu mới cho tài khoản của bạn.
          </Text>

          {/* Mật khẩu mới */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Mật khẩu mới</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Nhập mật khẩu mới"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showNew}
                value={matKhauMoi}
                onChangeText={setMatKhauMoi}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.textButton}>
                <Text style={styles.toggleText}>{showNew ? 'Ẩn' : 'Hiện'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Xác nhận mật khẩu */}
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showConfirm}
                value={xacNhan}
                onChangeText={setXacNhan}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.textButton}>
                <Text style={styles.toggleText}>{showConfirm ? 'Ẩn' : 'Hiện'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (loading || !matKhauMoi) && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={loading || !matKhauMoi}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Xác nhận đổi mật khẩu</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL THÔNG BÁO THÀNH CÔNG */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Thành công!</Text>
            <Text style={styles.modalBody}>Mật khẩu của bạn đã được thay đổi. Bạn sẽ được chuyển tới trang đăng nhập sau:</Text>
            <Text style={styles.countdownText}>{countdown} giây</Text>

            <TouchableOpacity style={styles.modalButton} onPress={handleGoToLogin}>
              <Text style={styles.modalButtonText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff8ff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1d4ed8',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#1e293b',
  },
  textButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  // STYLES CHO MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  successIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  countdownText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563eb',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default ConfirmPasswordScreen;
