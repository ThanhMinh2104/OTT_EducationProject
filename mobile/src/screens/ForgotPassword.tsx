import React, { useState } from 'react';
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

type ForgotPasswordProps = {
  navigation: StackNavigationProp<RootStackParamList, 'ForgotPassword'>;
};

// Kiểm tra định dạng số điện thoại Việt Nam
const isValidPhone = (p: string) => /^(0[35789])[0-9]{8}$/.test(p);

const ForgotPasswordScreen = ({ navigation }: ForgotPasswordProps) => {
  const [sdt, setSdt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    setError('');
    if (!isValidPhone(sdt)) {
      setError('Số điện thoại không hợp lệ!');
      return;
    }

    setLoading(true);
    try {
      // 1. Lấy email từ SĐT qua backend
      const resEmail = await axios.post(`${API_URL}/api/users/get-email-by-phone`, { sdt });
      const email = resEmail.data.email;

      // 2. Gửi mã OTP về email lấy được
      await axios.post(`${API_URL}/api/send-otp`, { email });

      // Lưu tạm thông tin để dùng cho các màn hình sau
      await AsyncStorage.setItem('resetSdt', sdt);
      await AsyncStorage.setItem('resetEmail', email);

      // Chuyển sang màn hình nhập mã OTP
      navigation.navigate('VerifyOtpReset');
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setError('Số điện thoại chưa được đăng ký!');
      } else {
        setError('Có lỗi xảy ra, vui lòng thử lại sau!');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Quên mật khẩu?</Text>
          <Text style={styles.subtitle}>
            OTP sẽ được gửi đến email đăng ký của bạn.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: 0912345678"
              keyboardType="phone-pad"
              value={sdt}
              maxLength={10}
              // CHÚ Ý: Chỉ lấy các ký tự là số
              onChangeText={(text) => setSdt(text.replace(/\D/g, ''))}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (loading || !sdt) && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading || !sdt}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Gửi mã xác thực</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Quay lại đăng nhập</Text>
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
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    color: '#ef4444',
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
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#3b90f4',
    fontSize: 14,
  },
});

export default ForgotPasswordScreen;
