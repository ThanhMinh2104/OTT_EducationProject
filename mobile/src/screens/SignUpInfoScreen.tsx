import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, StatusBar, Animated, Modal, Alert, FlatList,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { API_URL } from '../utils/config';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const months = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

function WheelPicker({ items, selectedIndex, onChange }: { items: string[]; selectedIndex: number; onChange: (i: number) => void }) {
  const ref = useRef<FlatList>(null);
  const [idx, setIdx] = useState(selectedIndex);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.scrollToIndex({ index: selectedIndex, animated: false });
    }, 50);
  }, []);

  return (
    <View style={wp.container}>
      <View style={wp.selector} pointerEvents="none" />
      <FlatList
        ref={ref}
        data={items}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
        ListHeaderComponent={<View style={{ height: ITEM_HEIGHT * 2 }} />}
        ListFooterComponent={<View style={{ height: ITEM_HEIGHT * 2 }} />}
        onMomentumScrollEnd={(e) => {
          const newIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          const clamped = Math.max(0, Math.min(newIdx, items.length - 1));
          setIdx(clamped);
          onChange(clamped);
        }}
        renderItem={({ item, index }) => (
          <View style={[wp.item, index === idx && wp.itemSelected]}>
            <Text style={[wp.text, index === idx && wp.textSelected]}>{item}</Text>
          </View>
        )}
      />
    </View>
  );
}

const wp = StyleSheet.create({
  container: { flex: 1, height: ITEM_HEIGHT * VISIBLE_ITEMS, overflow: 'hidden' },
  selector: { position: 'absolute', top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT, left: 0, right: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#d1d5db', zIndex: 1 },
  item: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  itemSelected: {},
  text: { fontSize: 15, color: '#9ca3af' },
  textSelected: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
});

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
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birth, setBirth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDay, setTempDay] = useState(0);    // index
  const [tempMonth, setTempMonth] = useState(0); // index
  const [tempYear, setTempYear] = useState(24);  // index (2000)
  const [password, setPassword] = useState('');
  const [rePassword, setRePassword] = useState('');
  const [gender, setGender] = useState('Nam');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRePassword, setShowRePassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };


  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const valid =
      name.length > 0 && birth.length > 0 && password.length >= 8 && rePassword.length > 0 &&
      validateName(name) && validateDateFormat(birth) && validateAge(birth) &&
      isValidPassword(password) && password === rePassword;
    setEnabled(valid);

    if (name && !validateName(name)) setError('Họ tên không hợp lệ! Ít nhất 2 từ, mỗi từ bắt đầu chữ hoa.');
    else if (birth && !validateDateFormat(birth)) setError('Ngày sinh không đúng định dạng dd/mm/yyyy!');
    else if (birth && validateDateFormat(birth) && !validateAge(birth)) setError('Bạn phải từ 18 tuổi trở lên.');
    else if (password && !isValidPassword(password)) setError('Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số.');
    else if (password && rePassword && password !== rePassword) setError('Mật khẩu không khớp!');
    else setError('');
  }, [name, birth, password, rePassword]);

  const handleSignUp = async () => {
    if (!enabled) return;
    if (!agreeTerms) {
      setError('Bạn phải đồng ý với điều khoản sử dụng!');
      return;
    }
    setError('');
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/registerUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sdt, 
          name, 
          ngaySinh: birth, 
          matKhau: password, 
          email, 
          gioTinh: gender,
          dongYDieuKhoan: true
        }),
      });
      if (!response.ok) throw new Error('Đăng ký thất bại');
      Alert.alert('Thành công', 'Đăng ký thành công! Chào mừng bạn đến với OTT Education 🎉');
      navigation.replace('Login');
    } catch {
      setError('Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#2572e9" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <LinearGradient colors={['#60aef8', '#3b90f4', '#2572e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerGradient}>
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />
            <Animated.View style={[styles.brandingContainer, { transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoContainer}>
                <Ionicons name="school-outline" size={32} color="#fff" />
              </View>
              <Text style={styles.appTitle}>OTT</Text>
              <Text style={styles.appTitleAccent}>Education</Text>
              <Text style={styles.appSubtitle}>Hoàn thiện thông tin để tạo tài khoản</Text>
            </Animated.View>
          </LinearGradient>

          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
              <Text style={styles.cardSubtitle}>Điền đầy đủ để hoàn tất đăng ký 📝</Text>
            </View>

            {/* Tên */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Họ và tên</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="person-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput style={styles.input} placeholder="Nguyễn Văn A" placeholderTextColor="#9ca3af" value={name} onChangeText={setName} editable={!loading} />
              </View>
            </View>

            {/* Ngày sinh */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ngày sinh</Text>
              <TouchableOpacity
                style={styles.inputWrapper}
                onPress={() => {
                  if (birthDate) {
                    setTempDay(birthDate.getDate() - 1);
                    setTempMonth(birthDate.getMonth());
                    setTempYear(years.indexOf(String(birthDate.getFullYear())));
                  } else {
                    setTempDay(0); setTempMonth(0); setTempYear(24);
                  }
                  setShowDatePicker(true);
                }}
                disabled={loading}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
                </View>
                <Text style={[styles.input, !birth && { color: '#9ca3af' }]}>
                  {birth || 'Chọn ngày sinh'}
                </Text>
                <View style={styles.eyeIcon}>
                  <Ionicons name="chevron-down-outline" size={18} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Date Picker */}
            <Modal
              visible={showDatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)} />
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.modalCancel}>Hủy</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Chọn ngày sinh</Text>
                    <TouchableOpacity onPress={() => {
                      const d = tempDay + 1;
                      const m = tempMonth + 1;
                      const y = parseInt(years[tempYear]);
                      const date = new Date(y, tempMonth, d);
                      setBirthDate(date);
                      setBirth(`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`);
                      setShowDatePicker(false);
                    }}>
                      <Text style={styles.modalDone}>Xong</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.pickerRow}>
                    <WheelPicker items={days} selectedIndex={tempDay} onChange={setTempDay} />
                    <WheelPicker items={months} selectedIndex={tempMonth} onChange={setTempMonth} />
                    <WheelPicker items={years} selectedIndex={tempYear} onChange={setTempYear} />
                  </View>
                </View>
              </View>
            </Modal>

            {/* Giới tính */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Giới tính</Text>
              <View style={styles.genderRow}>
                {['Nam', 'Nữ'].map((g) => (
                  <TouchableOpacity key={g} onPress={() => setGender(g)} style={[styles.genderBtn, gender === g && styles.genderBtnActive]}>
                    <Ionicons name={g === 'Nam' ? 'male-outline' : 'female-outline'} size={18} color={gender === g ? '#fff' : '#6b7280'} />
                    <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Mật khẩu */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput style={styles.input} placeholder="Tối thiểu 8 ký tự" placeholderTextColor="#9ca3af" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} editable={!loading} />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nhập lại mật khẩu */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nhập lại mật khẩu</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                </View>
                <TextInput style={styles.input} placeholder="Nhập lại mật khẩu" placeholderTextColor="#9ca3af" secureTextEntry={!showRePassword} value={rePassword} onChangeText={setRePassword} editable={!loading} />
                <TouchableOpacity onPress={() => setShowRePassword(!showRePassword)} style={styles.eyeIcon} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showRePassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Checkbox điều khoản */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 16 }}>
              <TouchableOpacity 
                onPress={() => setAgreeTerms(!agreeTerms)}
                style={{ marginRight: 10, marginTop: 2 }}
              >
                <Ionicons 
                  name={agreeTerms ? 'checkbox' : 'square-outline'} 
                  size={24} 
                  color={agreeTerms ? '#2572e9' : '#9ca3af'} 
                />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 }}>
                Tôi đồng ý với{' '}
                <Text 
                  onPress={() => setShowTermsModal(true)}
                  style={{ color: '#2572e9', fontWeight: '600', textDecorationLine: 'underline' }}
                >
                  Điều khoản sử dụng
                </Text>
                {' '}và{' '}
                <Text 
                  onPress={() => setShowTermsModal(true)}
                  style={{ color: '#2572e9', fontWeight: '600', textDecorationLine: 'underline' }}
                >
                  Chính sách bảo mật
                </Text>
              </Text>
            </View>

            <TouchableOpacity onPress={handleSignUp} disabled={!enabled || loading || !agreeTerms} activeOpacity={0.85}>
              <LinearGradient colors={['#60aef8', '#3b90f4', '#2572e9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.btnPrimary, (!enabled || loading || !agreeTerms) && styles.btnDisabled]}>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnText}>Đang tạo tài khoản...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Tạo tài khoản</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.backContainer}>
              <Ionicons name="arrow-back-outline" size={16} color="#3b90f4" />
              <Text style={styles.backLink}>Quay lại</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>© 2025 OTT Education. All rights reserved.</Text>
        </ScrollView>

        {/* Modal điều khoản */}
        <Modal
          visible={showTermsModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowTermsModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 16, maxHeight: '80%', overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>Điều khoản sử dụng</Text>
                <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>1. Chấp nhận điều khoản</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 16, lineHeight: 20 }}>
                  Bằng việc đăng ký và sử dụng dịch vụ, bạn đồng ý tuân thủ các điều khoản sau.
                </Text>

                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>2. Quy định sử dụng</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>2.1. Hành vi được phép:</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Sử dụng dịch vụ cho mục đích cá nhân, hợp pháp</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Giao tiếp lịch sự, tôn trọng người khác</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 12, lineHeight: 20 }}>• Bảo mật thông tin tài khoản của bạn</Text>

                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>2.2. Hành vi bị cấm:</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Spam, gửi tin nhắn quấy rối</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Chia sẻ nội dung vi phạm pháp luật</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Mạo danh người khác</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 16, lineHeight: 20 }}>• Sử dụng bot, script tự động</Text>

                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>3. Xử lý vi phạm</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Vi phạm nhẹ: Cảnh báo</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 4, lineHeight: 20 }}>• Vi phạm trung bình: Khóa tạm thời (7-30 ngày)</Text>
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 16, lineHeight: 20 }}>• Vi phạm nghiêm trọng: Khóa vĩnh viễn</Text>

                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 16 }}>Cập nhật lần cuối: 2024</Text>
              </ScrollView>

              <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowTermsModal(false);
                    setAgreeTerms(true);
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#60aef8', '#3b90f4', '#2572e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Đồng ý và đóng</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7ff' },
  scrollContent: { flexGrow: 1 },
  headerGradient: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 60, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden' },
  circle1: { position: 'absolute', top: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
  circle2: { position: 'absolute', top: '35%' as unknown as number, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  circle3: { position: 'absolute', bottom: -20, left: '25%' as unknown as number, width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.1)' },
  brandingContainer: { alignItems: 'center' },
  logoContainer: { width: 56, height: 56, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appTitle: { fontSize: 36, fontWeight: '800', color: '#ffffff', letterSpacing: 1, lineHeight: 40 },
  appTitleAccent: { fontSize: 36, fontWeight: '800', color: '#67e8f9', marginBottom: 8, letterSpacing: 1, lineHeight: 40 },
  appSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', paddingHorizontal: 16, lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 28, marginHorizontal: 20, marginTop: -30, marginBottom: 20, shadowColor: '#3b90f4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10, borderWidth: 1, borderColor: 'rgba(59,144,244,0.08)' },
  cardHeader: { alignItems: 'center', marginBottom: 28 },
  cardTitle: { fontSize: 26, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  cardSubtitle: { fontSize: 14, color: '#9ca3af' },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14, overflow: 'hidden' },
  inputIconContainer: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: Platform.OS === 'ios' ? 16 : 14, paddingHorizontal: 8, fontSize: 15, color: '#1f2937' },
  eyeIcon: { paddingHorizontal: 14, paddingVertical: 14 },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  genderBtnActive: { backgroundColor: '#3b90f4', borderColor: '#3b90f4' },
  genderText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  genderTextActive: { color: '#fff' },
  errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 12, marginBottom: 16 },
  errorText: { flex: 1, color: '#dc2626', fontSize: 13, lineHeight: 18 },
  btnPrimary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: '#3b90f4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  btnDisabled: { opacity: 0.5 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  backContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16 },
  backLink: { color: '#3b90f4', fontSize: 14, fontWeight: '500' },
  footer: { textAlign: 'center', color: '#9ca3af', fontSize: 11, marginTop: 4, marginBottom: 30 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  modalCancel: { fontSize: 15, color: '#9ca3af' },
  modalDone: { fontSize: 15, color: '#3b90f4', fontWeight: '600' },
  pickerRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8 },
});

export default SignUpInfoScreen;
