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
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const id = await AsyncStorage.getItem('userID');
      const name = await AsyncStorage.getItem('userName');
      const avatar = await AsyncStorage.getItem('userAvatar');
      
      console.log('👤 Loaded user data:', { id, name, avatar });
      
      setUserID(id || '');
      setUserName(name || 'User');
      setUserAvatar(avatar || '');
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
    return (
      <GroupChatScreen
        groupID={selectedGroupID}
        userID={userID}
        userName={userName}
        userAvatar={userAvatar}
        onBack={() => setSelectedGroupID(null)}
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
