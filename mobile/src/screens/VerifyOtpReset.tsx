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
  StatusBar,
  Animated,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type VerifyOtpResetProps = {
  navigation: StackNavigationProp<RootStackParamList, 'VerifyOtpReset'>;
};

const VerifyOtpResetScreen = ({ navigation }: VerifyOtpResetProps) => {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [sdt, setSdt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

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

    const getStoredSdt = async () => {
      const storedSdt = await AsyncStorage.getItem('resetSdt');
      if (storedSdt) setSdt(storedSdt);
    };
    getStoredSdt();
  }, []);

  const handleVerify = async () => {
    setError('');
    setResendMsg('');
    if (otp.length < 6) {
      setError('Mã OTP phải có 6 chữ số!');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/verify-otp-sms`, { sdt, otp });
      if (res.data.verified) {
        navigation.navigate('ConfirmPassword', { sdt });
      } else {
        setError('Mã OTP không đúng hoặc đã hết hạn!');
      }
    } catch (err) {
      setError('Có lỗi xảy ra khi xác thực OTP!');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResendMsg('');
    try {
      await axios.post(`${API_URL}/api/send-otp-sms`, { sdt });
      setResendMsg('Đã gửi lại mã OTP mới qua tin nhắn!');
    } catch (err) {
      setError('Gửi lại OTP thất bại!');
    } finally {
      setResending(false);
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
            style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
          >
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            <Animated.View style={[styles.brandingContainer, { transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color="#fff" />
              </View>
              <Text style={styles.appTitle}>Xác minh OTP</Text>
              <Text style={styles.appSubtitle}>
                Vui lòng nhập mã xác thực đã được gửi qua tin nhắn SMS đến số điện thoại của bạn.
              </Text>
            </Animated.View>
          </LinearGradient>

          {/* Form Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Nhập mã OTP</Text>
              <Text style={styles.cardSubtitle}>Mã được gửi đến: <Text style={styles.emailHighlight}>{sdt}</Text></Text>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.otpWrapper}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="● ● ● ● ● ●"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
                  editable={!loading}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {resendMsg ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                <Text style={styles.successText}>{resendMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || otp.length < 6}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#60aef8', '#3b90f4', '#2572e9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, (loading || otp.length < 6) && styles.btnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Tiếp tục</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.resendButton}
              onPress={handleResend}
              disabled={resending}
            >
              <Text style={styles.resendText}>
                {resending ? 'Đang gửi mã...' : 'Bạn không nhận được mã? Gửi lại'}
              </Text>
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
    paddingTop: 20,
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
    textAlign: 'center',
  },
  emailHighlight: {
    color: '#3b90f4',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
    alignItems: 'center',
  },
  otpWrapper: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 4,
  },
  otpInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 12,
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
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    color: '#16a34a',
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
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: '#3b90f4',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 15,
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
});

export default VerifyOtpResetScreen;
