import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, Image, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { io } from 'socket.io-client';
import { API_URL } from '../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const socket = io(API_URL);

const isValidPhone = (p: string) => /^(0[35789][0-9]{8}|(\+84)[35789][0-9]{8})$/.test(p);
const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e);
const validateName = (name: string) =>
  /^([A-ZÀ-Ỵ][a-zà-ỹ]*)(\s[A-ZÀ-Ỵ][a-zà-ỹ]*)+$/.test(name.trim().replace(/\s+/g, ' '));
const isValidDOB = (dob: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
};

export interface User {
  userID: string;
  name: string;
  email: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  ngaysinh?: string;
  gioTinh?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  setUser: (u: User) => void;
}

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const years = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

const UserProfileModal = ({ visible, onClose, user, setUser }: Props) => {
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    userID: '', name: '', email: '', phone: '',
    avatar: '', dobDay: '', dobMonth: '', dobYear: '', gender: 'Nam',
  });
  const [pwForm, setPwForm] = useState({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [otpModal, setOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const dob = user.ngaysinh ? new Date(user.ngaysinh) : null;
    setProfile({
      userID: user.userID || '',
      name: user.name || '',
      email: user.email || '',
      phone: user.sdt || '',
      avatar: user.anhDaiDien || '',
      dobDay: dob ? String(dob.getDate()).padStart(2, '0') : '',
      dobMonth: dob ? String(dob.getMonth() + 1).padStart(2, '0') : '',
      dobYear: dob ? String(dob.getFullYear()) : '',
      gender: user.gioTinh || 'Nam',
    });
    setIsEditing(false);
    setImageUri(null);
    setActiveTab('info');
    setPwForm({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
    setPwError('');
  }, [user, visible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setProfile((prev) => ({ ...prev, avatar: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    setErrorMessage('');
    if (!validateName(profile.name)) { setErrorMessage('Tên không hợp lệ! Ít nhất 2 từ, mỗi từ bắt đầu chữ hoa.'); return; }
    if (!isValidPhone(profile.phone)) { setErrorMessage('Số điện thoại không hợp lệ!'); return; }
    if (!isValidEmail(profile.email)) { setErrorMessage('Email không hợp lệ!'); return; }

    const dob = `${profile.dobYear}-${profile.dobMonth}-${profile.dobDay}`;
    if (!isValidDOB(dob)) { setErrorMessage('Ngày sinh không hợp lệ hoặc chưa đủ 18 tuổi.'); return; }

    let avatarUrl = profile.avatar;
    if (imageUri) {
      const token = await AsyncStorage.getItem('token');
      const form = new FormData();
      const filename = imageUri.split('/').pop() || 'avatar.jpg';
      form.append('files', { uri: imageUri, name: filename, type: 'image/jpeg' } as any);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      avatarUrl = data.urls[0];
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/users/${profile.userID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: profile.name, email: profile.email, sdt: profile.phone,
          ngaysinh: dob, gioTinh: profile.gender, anhDaiDien: avatarUrl,
        }),
      });
      const data = await res.json();
      if (data.error) { setErrorMessage(data.error); return; }

      socket.emit('updateUser', data.user);
      setUser(data.user);
      setIsEditing(false);
      Alert.alert('Thành công', 'Cập nhật thông tin thành công!');
      onClose();
    } catch {
      setErrorMessage('Lỗi hệ thống khi cập nhật thông tin.');
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (!pwForm.matKhauCu || !pwForm.matKhauMoi || !pwForm.xacNhan) {
      setPwError('Vui lòng điền đầy đủ thông tin.'); return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(pwForm.matKhauMoi)) {
      setPwError('Mật khẩu mới tối thiểu 8 ký tự, gồm cả chữ và số.'); return;
    }
    if (pwForm.matKhauMoi !== pwForm.xacNhan) {
      setPwError('Xác nhận mật khẩu không khớp.'); return;
    }
    try {
      setPwLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/users/${user?.userID}/request-password-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ matKhauCu: pwForm.matKhauCu }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.message); return; }
      setOtpEmail(data.email);
      setOtpValue('');
      setOtpError('');
      setOtpModal(true);
    } catch {
      setPwError('Lỗi hệ thống, vui lòng thử lại.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleVerifyOtpAndSave = async () => {
    setOtpError('');
    if (!otpValue || otpValue.length !== 6) {
      setOtpError('Vui lòng nhập mã OTP 6 chữ số.'); return;
    }
    try {
      setOtpLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/users/${user?.userID}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ matKhauMoi: pwForm.matKhauMoi, otp: otpValue, email: otpEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpError(data.message); return; }
      setOtpModal(false);
      await AsyncStorage.clear();
      Alert.alert('Thành công', 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      onClose();
    } catch {
      setOtpError('Lỗi hệ thống, vui lòng thử lại.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnWrap}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'info' && styles.tabBtnActive]}
              onPress={() => { setActiveTab('info'); setErrorMessage(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>Thông tin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'password' && styles.tabBtnActive]}
              onPress={() => { setActiveTab('password'); setIsEditing(false); setPwError(''); }}
            >
              <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>Đổi mật khẩu</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {activeTab === 'info' ? (
            <>
            {/* Avatar */}
            <TouchableOpacity onPress={isEditing ? pickImage : undefined} activeOpacity={isEditing ? 0.7 : 1}>
              <View style={styles.avatarWrap}>
                <Image
                  source={{ uri: profile.avatar || 'https://via.placeholder.com/90' }}
                  style={styles.avatar}
                />
                {isEditing && (
                  <View style={styles.avatarEditBadge}>
                    <Text style={styles.avatarEditIcon}>✏</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName}>{profile.name}</Text>

            {isEditing ? (
              /* ===== EDIT FORM ===== */
              <View style={styles.editForm}>
                {[
                  { label: 'Tên', key: 'name', keyboard: 'default' as const },
                  { label: 'Email', key: 'email', keyboard: 'email-address' as const },
                  { label: 'Số điện thoại', key: 'phone', keyboard: 'phone-pad' as const },
                ].map(({ label, key, keyboard }) => (
                  <View key={key} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      value={(profile as any)[key]}
                      keyboardType={keyboard}
                      autoCapitalize="none"
                      onChangeText={(v) => setProfile((p) => ({ ...p, [key]: v }))}
                      placeholderTextColor="#bbb"
                    />
                  </View>
                ))}

                <Text style={styles.fieldLabel}>Ngày sinh</Text>
                <View style={styles.dateRow}>
                  {[
                    { key: 'dobDay', label: 'Ngày', options: days },
                    { key: 'dobMonth', label: 'Tháng', options: months },
                    { key: 'dobYear', label: 'Năm', options: years },
                  ].map(({ key, label, options }) => (
                    <ScrollView key={key} style={styles.datePicker} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      <Text style={styles.datePickerLabel}>{label}</Text>
                      {options.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={(profile as any)[key] === opt ? styles.dateOptSelected : styles.dateOpt}
                          onPress={() => setProfile((p) => ({ ...p, [key]: opt }))}
                        >
                          <Text style={(profile as any)[key] === opt ? styles.dateOptTextSelected : styles.dateOptText}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Giới tính</Text>
                <View style={styles.genderRow}>
                  {['Nam', 'Nữ', 'Khác'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderBtn, profile.gender === g && styles.genderSelected]}
                      onPress={() => setProfile((p) => ({ ...p, gender: g }))}
                    >
                      <Text style={[styles.genderText, profile.gender === g && styles.genderTextSelected]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.btnCancel}
                    onPress={() => { setIsEditing(false); setErrorMessage(''); }}
                  >
                    <Text style={styles.btnCancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
                    <Text style={styles.btnSaveText}>Lưu thay đổi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ===== INFO VIEW ===== */
              <View style={styles.infoView}>
                {[
                  ['Tên', profile.name],
                  ['Email', profile.email],
                  ['Số điện thoại', profile.phone],
                  ['Ngày sinh', `${profile.dobDay}/${profile.dobMonth}/${profile.dobYear}`],
                  ['Giới tính', profile.gender],
                ].map(([label, value]) => (
                  <View key={label} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{label}</Text>
                    <Text style={styles.infoValue}>{value}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.btnUpdate} onPress={() => setIsEditing(true)} activeOpacity={0.8}>
                  <Text style={styles.btnUpdateText}>✏  Cập nhật thông tin</Text>
                </TouchableOpacity>
              </View>
            )}
            </>) : (
              /* ===== TAB ĐỔI MẬT KHẨU ===== */
              <View style={styles.pwForm}>
                {[
                  { key: 'matKhauCu', label: 'Mật khẩu hiện tại' },
                  { key: 'matKhauMoi', label: 'Mật khẩu mới' },
                  { key: 'xacNhan', label: 'Xác nhận mật khẩu mới' },
                ].map(({ key, label }) => (
                  <View key={key} style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      placeholder={`Nhập ${label.toLowerCase()}`}
                      placeholderTextColor="#bbb"
                      value={pwForm[key as keyof typeof pwForm]}
                      onChangeText={(v) => setPwForm((p) => ({ ...p, [key]: v }))}
                    />
                  </View>
                ))}
                {pwError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{pwError}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[styles.btnSave, pwLoading && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={pwLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSaveText}>{pwLoading ? 'Đang lưu...' : '🔒  Cập nhật mật khẩu'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>

      {/* OTP Overlay — render bên trong Modal chính */}
      {otpModal && (
        <View style={styles.otpOverlay}>
          <View style={styles.otpBox}>
            <Text style={styles.otpTitle}>Xác nhận mã OTP</Text>
            <Text style={styles.otpSubtitle}>
              Mã OTP đã được gửi đến{'\n'}
              <Text style={{ fontWeight: '700', color: '#1a1a1a' }}>{otpEmail}</Text>
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otpValue}
              onChangeText={(v) => setOtpValue(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="• • • • • •"
              placeholderTextColor="#ccc"
            />
            {otpError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setOtpModal(false)}>
                <Text style={styles.btnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSave, otpLoading && { opacity: 0.6 }]}
                onPress={handleVerifyOtpAndSave}
                disabled={otpLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSaveText}>{otpLoading ? 'Đang xác nhận...' : 'Xác nhận'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
    </>
  );
};

const PRIMARY = '#0e9de8';
const PRIMARY_DARK = '#0077c2';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    paddingBottom: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeBtnWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },

  /* Body */
  body: {
    alignItems: 'center',
    padding: 20,
    paddingBottom: 8,
  },

  /* Avatar */
  avatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: PRIMARY,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEditIcon: {
    fontSize: 11,
    color: '#fff',
  },
  profileName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 18,
    marginTop: 4,
  },

  /* Info view */
  infoView: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  btnUpdate: {
    backgroundColor: PRIMARY,
    margin: 14,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  btnUpdateText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  /* Edit form */
  editForm: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 11,
    fontSize: 14,
    backgroundColor: '#fafafa',
    color: '#333',
  },

  /* Date picker */
  dateRow: {
    flexDirection: 'row',
    height: 120,
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  datePicker: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
  datePickerLabel: {
    textAlign: 'center',
    fontSize: 11,
    color: '#888',
    paddingVertical: 5,
    backgroundColor: '#f0f0f0',
    fontWeight: '600',
  },
  dateOpt: { padding: 7, alignItems: 'center' },
  dateOptSelected: {
    padding: 7,
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 6,
    margin: 2,
  },
  dateOptText: { fontSize: 13, color: '#444' },
  dateOptTextSelected: { fontSize: 13, color: '#fff', fontWeight: 'bold' },

  /* Gender */
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    marginTop: 4,
  },
  genderBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  genderSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  genderText: { color: '#555', fontSize: 14, fontWeight: '500' },
  genderTextSelected: { color: '#fff', fontWeight: 'bold' },

  /* Error */
  errorBox: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#e53e3e',
    textAlign: 'center',
    fontSize: 13,
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: PRIMARY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  tabTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },

  /* Password form */
  pwForm: {
    width: '100%',
  },

  /* Action buttons */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  btnCancelText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSave: {
    flex: 2,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  /* OTP Modal */
  otpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  otpBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  otpTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  otpSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
    lineHeight: 20,
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 10,
    backgroundColor: '#fafafa',
    color: '#333',
    marginBottom: 8,
  },
});

export default UserProfileModal;
