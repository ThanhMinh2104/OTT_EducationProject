import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';

type VerifyOtpResetProps = {
  navigation: StackNavigationProp<RootStackParamList, 'VerifyOtpReset'>;
};

const VerifyOtpResetScreen = ({ navigation }: VerifyOtpResetProps) => {
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  // Lấy email đã lưu từ bước trước
  useEffect(() => {
    const getStoredEmail = async () => {
      const storedEmail = await AsyncStorage.getItem('resetEmail');
      if (storedEmail) setEmail(storedEmail);
    };
    getStoredEmail();
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
      const res = await axios.post(`${API_URL}/api/verify-otp`, { email, otp });
      if (res.data.verified) {
        const sdt = await AsyncStorage.getItem('resetSdt');
        // Xác thực xong -> Chuyển sang màn hình đặt mật khẩu mới
        navigation.navigate('ConfirmPassword', { sdt: sdt || '' });
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
      await axios.post(`${API_URL}/api/send-otp`, { email });
      setResendMsg('Đã gửi lại mã OTP mới vào email của bạn!');
    } catch (err) {
      setError('Gửi lại OTP thất bại!');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Xác thực OTP</Text>
          <Text style={styles.subtitle}>
            Nhập mã 6 chữ số được gửi đến email: {'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.otpInput}
              placeholder="● ● ● ● ● ●"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {resendMsg ? <Text style={styles.successText}>{resendMsg}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading || otp.length < 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Tiếp tục</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={styles.resendText}>
              {resending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#3b90f4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1d5dd6',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  emailText: {
    color: '#3b90f4',
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  otpInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#3b90f4',
    borderRadius: 12,
    padding: 15,
    fontSize: 24,
    color: '#333',
    textAlign: 'center',
    width: '80%',
    letterSpacing: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 15,
    textAlign: 'center',
  },
  successText: {
    color: '#10b981',
    fontSize: 13,
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3b90f4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  backText: {
    color: '#999',
    fontSize: 14,
  },
});

export default VerifyOtpResetScreen;
