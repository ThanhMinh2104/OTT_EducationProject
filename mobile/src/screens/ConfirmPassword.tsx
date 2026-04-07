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
  StatusBar,
  Animated,
} from 'react-native';
import axios from 'axios';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
        matKhauMoi,
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đổi mật khẩu thất bại, vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#2572e9" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Gradient */}
          <LinearGradient
            colors={['#60aef8', '#3b90f4', '#2572e9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            <Animated.View style={[styles.brandingContainer, { transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoContainer}>
                <Ionicons name="lock-closed-outline" size={32} color="#fff" />
              </View>
              <Text style={styles.appTitle}>Mật khẩu mới</Text>
              <Text style={styles.appSubtitle}>
                Vui lòng tạo mật khẩu mới mạnh để bảo vệ tài khoản của bạn.
              </Text>
            </Animated.View>
          </LinearGradient>

          {/* Form Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Đặt mật khẩu</Text>
              <Text style={styles.cardSubtitle}>Mật khẩu mới phải khác mật khẩu cũ</Text>
            </View>

            {/* Mật khẩu mới */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu mới</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                   <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu mới"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showNew}
                  value={matKhauMoi}
                  onChangeText={setMatKhauMoi}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeIcon}>
                  <Ionicons name={showNew ? "eye-outline" : "eye-off-outline"} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Xác nhận mật khẩu */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Xác nhận mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                   <Ionicons name="shield-checkmark-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showConfirm}
                  value={xacNhan}
                  onChangeText={setXacNhan}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                  <Ionicons name={showConfirm ? "eye-outline" : "eye-off-outline"} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={(loading || !matKhauMoi) ? styles.btnDisabled : null}
              onPress={handleConfirm}
              disabled={loading || !matKhauMoi}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#60aef8', '#3b90f4', '#2572e9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, (loading || !matKhauMoi) && styles.btnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Xác nhận đổi mật khẩu</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Quay lại</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>© 2025 OTT Education. All rights reserved.</Text>
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
                <Ionicons name="checkmark" size={32} color="#fff" />
              </View>
              <Text style={styles.modalTitle}>Thành công!</Text>
              <Text style={styles.modalBody}>Mật khẩu của bạn đã được thay đổi. Bạn sẽ được chuyển tới trang đăng nhập sau:</Text>
              <Text style={styles.countdownText}>{countdown} giây</Text>
              
              <TouchableOpacity onPress={handleGoToLogin} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#60aef8', '#3b90f4', '#2572e9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Đăng nhập ngay</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f7ff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle2: {
    position: 'absolute',
    top: '35%',
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle3: {
    position: 'absolute',
    bottom: -20,
    left: '25%',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandingContainer: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 20,
    marginTop: -30,
    marginBottom: 20,
    shadowColor: '#3b90f4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 144, 244, 0.08)',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    overflow: 'hidden',
  },
  inputIconContainer: {
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    paddingHorizontal: 8,
    fontSize: 15,
    color: '#1f2937',
  },
  eyeIcon: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },
  btnPrimary: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#3b90f4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 30,
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
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
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
