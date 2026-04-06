import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts' | 'profile'>('chat');

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar backgroundColor="#0e9de8" barStyle="light-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setShowProfileModal(true)} activeOpacity={0.8}>
          <Image
            source={{ uri: user?.anhDaiDien || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
        </TouchableOpacity>

        <Text style={styles.appTitle}>OTT Education</Text>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.welcomeIconBox}>
          <Text style={styles.welcomeEmoji}>💬</Text>
        </View>
        <Text style={styles.welcomeText}>Chào mừng, {user?.name}!</Text>
        <Text style={styles.subText}>Nhấn vào avatar để xem thông tin cá nhân.</Text>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {[
          { key: 'chat', icon: '💬', label: 'Tin nhắn' },
          { key: 'contacts', icon: '👥', label: 'Danh bạ' },
          { key: 'profile', icon: '👤', label: 'Hồ sơ' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => {
              setActiveTab(tab.key as typeof activeTab);
              if (tab.key === 'profile') setShowProfileModal(true);
            }}
          >
            <Text style={[styles.navIcon, activeTab === tab.key && styles.navIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.navLabel, activeTab === tab.key && styles.navLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.navIndicator} />}
          </TouchableOpacity>
        ))}
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
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0e9de8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  appTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  /* Main content */
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  welcomeIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e8f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#0e9de8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeEmoji: {
    fontSize: 42,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Bottom nav */
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  navIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 3,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#0e9de8',
    fontWeight: '700',
  },
  navIndicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 3,
    backgroundColor: '#0e9de8',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});

export default HomeScreen;
