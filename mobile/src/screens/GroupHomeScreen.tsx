import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GroupList } from '../components/GroupList';
import { GroupChatScreen } from './GroupChatScreen';

export const GroupHomeScreen: React.FC = () => {
  const [selectedGroupID, setSelectedGroupID] = useState<string | null>(null);
  const userID = sessionStorage?.getItem('userID') || '';

  if (selectedGroupID) {
    return (
      <GroupChatScreen
        groupID={selectedGroupID}
        userID={userID}
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
});
