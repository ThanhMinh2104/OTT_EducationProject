import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Animated, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const socket = io(API_URL);

const isValidPhoneNumber = (p: string) => /^(0[35789])[0-9]{8}$/.test(p);
const isValidPassword = (p: string) => /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(p);

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Login'> };

const { width } = Dimensions.get('window');

const LoginPassword = ({ navigation }: Props) => {
  const [sdt, setSDT] = useState('');
  const [matKhau, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const handleLogin = async () => {
    setError(null);

    if (!isValidPhoneNumber(sdt)) {
      setError('Số điện thoại không hợp lệ! (Bắt đầu 03, 05, 07, 08, 09 và có 10 chữ số)');
      return;
    }
    if (!isValidPassword(matKhau)) {
      setError('Mật khẩu không hợp lệ! (Tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số)');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/login`, { sdt, matKhau });
      const { token, user: loginUser } = response.data;

      await AsyncStorage.setItem('token', token);

      const res = await axios.post(`${API_URL}/api/updateStatus`, {
        userID: loginUser.userID,
        trangThai: 'online',
      });

      await AsyncStorage.setItem('userID', res.data.user.userID);
      await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
      socket.emit('updateStatus', res.data.user);
      navigation.replace('Home');
    } catch {
      setError('Sai số điện thoại hoặc mật khẩu');
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
          {/* Background gradient top section */}
          <LinearGradient
            colors={['#60aef8', '#3b90f4', '#2572e9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            {/* Decorative circles */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            {/* Branding area */}
            <Animated.View style={[styles.brandingContainer, { transform: [{ scale: logoScale }] }]}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <Ionicons name="school-outline" size={32} color="#fff" />
              </View>

              {/* Title */}
              <Text style={styles.appTitle}>OTT</Text>
              <Text style={styles.appTitleAccent}>Education</Text>
              <Text style={styles.appSubtitle}>
                Hệ thống nhắn tin thời gian thực cho giáo dục
              </Text>
            </Animated.View>
          </LinearGradient>

          {/* Login Card - overlapping the gradient */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Đăng nhập</Text>
              <Text style={styles.cardSubtitle}>Chào mừng bạn quay trở lại! 👋</Text>
            </View>

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="phone-portrait-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập số điện thoại của bạn"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  value={sdt}
                  onChangeText={setSDT}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu của bạn"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={matKhau}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#60aef8', '#3b90f4', '#2572e9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnText}>Đang đăng nhập...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Đăng nhập</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotContainer}
            >
              <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.divider} />
            </View>

            {/* Signup Link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signupLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Footer */}
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

  // ── Header gradient ──
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // ── Decorative circles (matching web) ──
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
    top: '35%' as unknown as number,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  circle3: {
    position: 'absolute',
    bottom: -20,
    left: '25%' as unknown as number,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // ── Branding ──
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
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    lineHeight: 40,
  },
  appTitleAccent: {
    fontSize: 36,
    fontWeight: '800',
    color: '#67e8f9',
    marginBottom: 8,
    letterSpacing: 1,
    lineHeight: 40,
  },
  appSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
  },

  // ── Login Card ──
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

  // ── Input Fields ──
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

  // ── Error ──
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

  // ── Button ──
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },

  // ── Forgot Password ──
  forgotContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotLink: {
    color: '#3b90f4',
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Divider ──
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 14,
    letterSpacing: 1.5,
  },

  // ── Signup ──
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  signupLink: {
    color: '#3b90f4',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Footer ──
  footer: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 30,
  },
});

export default LoginPassword;