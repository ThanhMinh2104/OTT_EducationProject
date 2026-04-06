import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, SafeAreaView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import UserProfileModal, { User } from '../components/UserProfileModal';
import { API_URL } from '../utils/config';

const socket = io(API_URL);

type Props = { navigation: StackNavigationProp<RootStackParamList, 'Home'> };

const HomeScreen = ({ navigation }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('token');
      if (!stored || !token) { navigation.replace('Login'); return; }
      const u = JSON.parse(stored);
      setUser(u);
      socket.emit('join_user', u.userID);
    })();

    socket.on('update_user', async (data: User) => {
      setUser(data);
      await AsyncStorage.setItem('user', JSON.stringify(data));
    });

    return () => { socket.off('update_user'); };
  }, [navigation]);

  const handleLogout = async () => {
    if (user) {
      await fetch(`${API_URL}/api/updateStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userID: user.userID, trangThai: 'offline' }),
      });
    }
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  const updateUser = async (u: User) => {
    setUser(u);
    await AsyncStorage.setItem('user', JSON.stringify(u));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Sidebar / Bottom bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setShowProfileModal(true)}>
          <Image
            source={{ uri: user?.anhDaiDien || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        </TouchableOpacity>
        <Text style={styles.appTitle}>OTT Education</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Text style={styles.welcomeIcon}>💬</Text>
        <Text style={styles.welcomeText}>Chào mừng, {user?.name}!</Text>
        <Text style={styles.subText}>Nhấn vào avatar để xem thông tin cá nhân.</Text>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navLabel}>Tin nhắn</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setShowProfileModal(true)}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Hồ sơ</Text>
        </TouchableOpacity>
      </View>

      <UserProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        setUser={updateUser}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a73e8', paddingHorizontal: 16, paddingVertical: 10,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff' },
  appTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  logoutText: { color: '#fff', fontSize: 13 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  welcomeIcon: { fontSize: 64, marginBottom: 16 },
  welcomeText: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  subText: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#555', marginTop: 2 },
});

export default HomeScreen;
