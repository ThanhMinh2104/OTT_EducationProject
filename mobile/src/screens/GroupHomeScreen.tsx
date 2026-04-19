import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroupList } from '../components/GroupList';
import { GroupChatScreen } from './GroupChatScreen';

export const GroupHomeScreen: React.FC = () => {
  const [selectedGroupID, setSelectedGroupID] = useState<string | null>(null);
  const [userID, setUserID] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🏠 GroupHomeScreen mounted');
    loadUserData();
  }, []);

  useEffect(() => {
    console.log('🏠 Selected group changed:', selectedGroupID);
  }, [selectedGroupID]);

  const loadUserData = async () => {
    try {
      const id = await AsyncStorage.getItem('userID');
      // Lấy thông tin user từ object user (vì userName/userAvatar không được lưu riêng)
      const userStr = await AsyncStorage.getItem('user');
      let name = 'User';
      let avatar = '';
      
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          name = user.name || user.hoTen || 'User';
          avatar = user.anhDaiDien || user.avatar || '';
        } catch { /* ignore */ }
      }
      
      console.log('👤 Loaded user data:', { id, name, avatar });
      
      setUserID(id || '');
      setUserName(name);
      setUserAvatar(avatar);

      // Emit join_user để socket biết userID
      if (id) {
        const socketModule = require('../utils/socket').default;
        if (socketModule.connected) {
          socketModule.emit('join_user', id);
        } else {
          socketModule.once('connect', () => {
            socketModule.emit('join_user', id);
          });
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0084ff" />
      </View>
    );
  }

  if (selectedGroupID) {
    console.log('🏠 Rendering GroupChatScreen with:', {
      groupID: selectedGroupID,
      userID,
      userName,
      userAvatar,
    });
    return (
      <GroupChatScreen
        groupID={selectedGroupID}
        userID={userID}
        userName={userName}
        userAvatar={userAvatar}
        onBack={() => {
          console.log('🏠 Back to group list');
          setSelectedGroupID(null);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <GroupList onSelectGroup={setSelectedGroupID} selectedGroupID={selectedGroupID || ''} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
