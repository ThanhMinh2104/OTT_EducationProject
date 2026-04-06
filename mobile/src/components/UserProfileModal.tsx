import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, Image, ScrollView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { io } from 'socket.io-client';
import { API_URL } from '../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const socket = io(API_URL);

const isValidPhone = (p: string) => /^(0[35789][0-9]{8}|(\+84)[35789][0-9]{8})$/.test(p);
const isValidEmail = (e: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e);
const validateName = (name: string) => /^([A-ZÀ-Ỵ][a-zà-ỹ]*)(\s[A-ZÀ-Ỵ][a-zà-ỹ]*)+$/.test(name.trim().replace(/\s+/g, ' '));
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
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    userID: '', name: '', email: '', phone: '',
    avatar: '', dobDay: '', dobMonth: '', dobYear: '', gender: 'Nam',
  });

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
  }, [user, visible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <TouchableOpacity onPress={isEditing ? pickImage : undefined}>
              <Image source={{ uri: profile.avatar || 'https://via.placeholder.com/90' }} style={styles.avatar} />
              {isEditing && <Text style={styles.changePhoto}>Đổi ảnh</Text>}
            </TouchableOpacity>
            <Text style={styles.profileName}>{profile.name}</Text>

            {isEditing ? (
              <View style={styles.editForm}>
                <Text style={styles.fieldLabel}>Tên</Text>
                <TextInput style={styles.input} value={profile.name} onChangeText={(v) => setProfile((p) => ({ ...p, name: v }))} />
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput style={styles.input} value={profile.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => setProfile((p) => ({ ...p, email: v }))} />
                <Text style={styles.fieldLabel}>Số điện thoại</Text>
                <TextInput style={styles.input} value={profile.phone} keyboardType="phone-pad" onChangeText={(v) => setProfile((p) => ({ ...p, phone: v }))} />
                <Text style={styles.fieldLabel}>Ngày sinh</Text>
                <View style={styles.dateRow}>
                  {[
                    { key: 'dobDay', label: 'Ngày', options: days },
                    { key: 'dobMonth', label: 'Tháng', options: months },
                    { key: 'dobYear', label: 'Năm', options: years },
                  ].map(({ key, label, options }) => (
                    <ScrollView key={key} style={styles.datePicker} nestedScrollEnabled>
                      <Text style={styles.datePickerLabel}>{label}</Text>
                      {options.map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={(profile as any)[key] === opt ? styles.dateOptSelected : styles.dateOpt}
                          onPress={() => setProfile((p) => ({ ...p, [key]: opt }))}
                        >
                          <Text style={(profile as any)[key] === opt ? styles.dateOptTextSelected : styles.dateOptText}>{opt}</Text>
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
                {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => { setIsEditing(false); setErrorMessage(''); }}>
                    <Text style={styles.btnCancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
                    <Text style={styles.btnSaveText}>Lưu</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infoView}>
                {[
                  ['Tên', profile.name],
                  ['Email', profile.email],
                  ['Số điện thoại', profile.phone],
                  ['Ngày sinh', `${profile.dobDay}/${profile.dobMonth}/${profile.dobYear}`],
                  ['Giới tính', profile.gender],
                ].map(([label, value]) => (
                  <View key={label} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{label}:</Text>
                    <Text style={styles.infoValue}>{value}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.btnUpdate} onPress={() => setIsEditing(true)}>
                  <Text style={styles.btnUpdateText}>✏ Cập nhật</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  closeBtn: { fontSize: 18, color: '#888', padding: 4 },
  body: { alignItems: 'center', padding: 20 },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 4 },
  changePhoto: { color: '#1a73e8', textAlign: 'center', fontSize: 13, marginBottom: 8 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  editForm: { width: '100%' },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa', marginBottom: 4 },
  dateRow: { flexDirection: 'row', height: 120, gap: 8, marginBottom: 8 },
  datePicker: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 },
  datePickerLabel: { textAlign: 'center', fontSize: 11, color: '#888', padding: 4, backgroundColor: '#f5f5f5' },
  dateOpt: { padding: 6, alignItems: 'center' },
  dateOptSelected: { padding: 6, alignItems: 'center', backgroundColor: '#1a73e8', borderRadius: 4 },
  dateOptText: { fontSize: 13, color: '#333' },
  dateOptTextSelected: { fontSize: 13, color: '#fff', fontWeight: 'bold' },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genderBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, alignItems: 'center' },
  genderSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  genderText: { color: '#555', fontSize: 13 },
  genderTextSelected: { color: '#fff', fontWeight: 'bold' },
  error: { color: '#e53e3e', textAlign: 'center', marginBottom: 8, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnCancelText: { color: '#555', fontWeight: '600' },
  btnSave: { flex: 1, backgroundColor: '#1a73e8', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontWeight: 'bold' },
  infoView: { width: '100%' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { color: '#888', fontSize: 14 },
  infoValue: { color: '#333', fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  btnUpdate: { backgroundColor: '#1a73e8', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 16 },
  btnUpdateText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

export default UserProfileModal;
