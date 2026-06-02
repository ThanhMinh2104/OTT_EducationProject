import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Animated,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'ForgotPassword'> };

const isPhone = (v: string) => /^(0[35789])[0-9]{8}$/.test(v);

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [sdt, setSdt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const isValid = isPhone(sdt);

  const handleSendOTP = async () => {
    setError('');
    if (!isValid) {
      setError('Vui lòng nhập số điện thoại hợp lệ (VD: 0912345678).');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/send-otp-sms`, { sdt, checkExists: true });
      await AsyncStorage.setItem('resetSdt', sdt);
      navigation.navigate('VerifyOtpReset');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Không tìm thấy tài khoản với số điện thoại này!');
      } else {
        setError('Có lỗi xảy ra, vui lòng thử lại sau!');
      }
    } finally {
      setLoading(false);
    }
  };

  const iconName = 'phone-portrait-outline';

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#2572e9" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#60aef8', '#3b90f4', '#2572e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />
            <Animated.View style={[styles.brandingContainer, { transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoContainer}>
                <Ionicons name="lock-open-outline" size={32} color="#fff" />
              </View>
              <Text style={styles.appTitle}>Quên mật khẩu</Text>
              <Text style={styles.appSubtitle}>Chúng tôi sẽ giúp bạn lấy lại tài khoản của mình.</Text>
            </Animated.View>
          </LinearGradient>

          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Xác thực tài khoản</Text>
              <Text style={styles.cardSubtitle}>Nhập SĐT để nhận mã OTP qua tin nhắn</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name={iconName} size={20} color={isValid ? '#3b90f4' : '#9ca3af'} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="VD: 0912345678"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={sdt}
                  onChangeText={(t) => setSdt(t.trim())}
                  editable={!loading}
                />
              </View>
              {sdt.length > 0 && (
                <Text style={[styles.hint, isValid && styles.hintValid]}>
                  {isValid ? '✓ Số điện thoại hợp lệ' : 'Nhập SĐT hợp lệ (10 số, bắt đầu 03/05/07/08/09)'}
                </Text>
              )}
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity onPress={handleSendOTP} disabled={loading || !sdt} activeOpacity={0.85}>
              <LinearGradient
                colors={['#60aef8', '#3b90f4', '#2572e9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btnPrimary, (loading || !sdt) && styles.btnDisabled]}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnText}>Đang xử lý...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Gửi mã xác thực</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>© 2025 OTT Education. All rights reserved.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7ff' },
  scrollContent: { flexGrow: 1 },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  circle1: { position: 'absolute', top: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
  circle2: { position: 'absolute', top: '35%', right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  circle3: { position: 'absolute', bottom: -20, left: '25%', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
  brandingContainer: { alignItems: 'center' },
  logoContainer: { width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appTitle: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 1, marginBottom: 8 },
  appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', paddingHorizontal: 16, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
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
    borderColor: 'rgba(59,144,244,0.08)',
  },
  cardHeader: { alignItems: 'center', marginBottom: 28 },
  cardTitle: { fontSize: 26, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#9ca3af' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, overflow: 'hidden' },
  inputIconContainer: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: Platform.OS === 'ios' ? 16 : 14, paddingHorizontal: 8, fontSize: 15, color: '#1f2937' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  hintValid: { color: '#16a34a' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, color: '#dc2626', fontSize: 13, lineHeight: 18 },
  btnPrimary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: '#3b90f4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.6 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { color: '#3b90f4', fontSize: 14, fontWeight: '500' },
  footer: { textAlign: 'center', color: '#9ca3af', fontSize: 11, marginTop: 4, marginBottom: 30 },
});

export default ForgotPasswordScreen;
