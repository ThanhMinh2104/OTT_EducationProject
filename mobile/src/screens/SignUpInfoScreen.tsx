import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';

const validateName = (name: string) => /^([A-ZÀ-Ỵ][a-zà-ỹ]*)(\s[A-ZÀ-Ỵ][a-zà-ỹ]*)+$/.test(name);
const validateDateFormat = (date: string) => /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d\d$/.test(date);
const validateAge = (dateString: string) => {
  if (!validateDateFormat(dateString)) return false;
  const [day, month, year] = dateString.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 18;
};
const isValidPassword = (p: string) => /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(p);

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'SignUpInfo'>;
  route: RouteProp<RootStackParamList, 'SignUpInfo'>;
};

const SignUpInfoScreen = ({ navigation, route }: Props) => {
  const { email, sdt } = route.params;
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [gender, setGender] = useState('Nam');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const valid =
      name.length > 0 && birth.length > 0 && password.length >= 8 && rePassword.length > 0 &&
      validateName(name) && validateDateFormat(birth) && validateAge(birth) &&
      isValidPassword(password) && password === rePassword;
    setEnabled(valid);

    if (name && !validateName(name)) setError('Họ tên không hợp lệ!');
    else if (birth && !validateDateFormat(birth)) setError('Ngày sinh không đúng định dạng dd/mm/yyyy!');
    else if (birth && validateDateFormat(birth) && !validateAge(birth)) setError('Bạn phải từ 18 tuổi trở lên.');
    else if (password && !isValidPassword(password)) setError('Mật khẩu không hợp lệ!');
    else if (password && rePassword && password !== rePassword) setError('Mật khẩu không khớp!');
    else setError('');
  }, [name, birth, password, rePassword]);

  const handleSignUp = async () => {
    if (!name || !birth || !password || !rePassword) { setError('Vui lòng nhập đầy đủ thông tin!'); return; }
    if (!enabled) return;
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/registerUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdt, name, ngaySinh: birth, matKhau: password, email, gioTinh: gender }),
      });
      if (!response.ok) throw new Error('Đăng ký thất bại');
      navigation.replace('Login');
    } catch {
      setError('Đăng ký thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.appTitle}>OTT Education</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Thông tin bổ sung</Text>
          <TextInput style={styles.input} placeholder="Tên hiển thị" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Ngày sinh (dd/mm/yyyy)" value={birth} onChangeText={setBirth} />
          <Text style={styles.label}>Giới tính</Text>
          <View style={styles.genderRow}>
            {['Nam', 'Nữ'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderBtn, gender === g && styles.genderSelected]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="Nhập lại mật khẩu" secureTextEntry value={rePassword} onChangeText={setRePassword} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.btnPrimary, !enabled && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={!enabled}
          >
            <Text style={styles.btnText}>Tạo tài khoản</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.backLink}>Quay lại</Text>
          </TouchableOpacity>
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
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  genderRow: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  genderBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, alignItems: 'center' },
  genderSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  genderText: { color: '#555', fontWeight: '500' },
  genderTextSelected: { color: '#fff' },
  error: { color: '#e53e3e', textAlign: 'center', marginBottom: 8, fontSize: 13 },
  btnPrimary: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { backgroundColor: '#a0c4f1' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  backLink: { color: '#666', textAlign: 'center', marginTop: 4, fontSize: 14 },
});

export default SignUpInfoScreen;
