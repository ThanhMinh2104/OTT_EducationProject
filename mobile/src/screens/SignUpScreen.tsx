import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';

type Props = { navigation: StackNavigationProp<RootStackParamList, 'SignUp'> };

const SignUpScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [sdt, setSDT] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    setEnabled(phoneRegex.test(sdt) && emailRegex.test(email));
  }, [sdt, email]);

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setError('');
      const responseSDT = await axios.post(`${API_URL}/api/users/checksdt`, { sdt });
      if (responseSDT.data.exists) { setError('Số điện thoại đã được đăng ký!'); return; }

      const otpRes = await axios.post(`${API_URL}/api/send-otp`, { email });
      await AsyncStorage.setItem('otpCode', otpRes.data.otp);
      await AsyncStorage.setItem('emailForSignIn', email);
      await AsyncStorage.setItem('sdt', sdt);
      navigation.navigate('VerifyOtp');
    } catch (err) {
      setError('Có lỗi xảy ra: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.appTitle}>OTT Education</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Đăng ký</Text>
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            keyboardType="phone-pad"
            value={sdt}
            onChangeText={setSDT}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.btnPrimary, (!enabled || loading) && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={!enabled || loading}
          >
            <Text style={styles.btnText}>{loading ? 'Đang gửi...' : 'Tiếp tục'}</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.gray}>Bạn đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0f4f8' },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  appTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a73e8', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  error: { color: '#e53e3e', textAlign: 'center', marginBottom: 8, fontSize: 13 },
  btnPrimary: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { backgroundColor: '#a0c4f1' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  link: { color: '#1a73e8', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  gray: { color: '#666', fontSize: 14 },
});

export default SignUpScreen;
