import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import ContactsPanel from "../components/ContactsPanel";
import AddFriendModal from "../components/AddFriendModal";

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "Contacts">;
  route: { params: { user: any } };
};

const ContactsScreen = ({ navigation, route }: Props) => {
  const { user } = route.params;
  const [showAddFriend, setShowAddFriend] = useState(false);

  const handleStartChat = (chat: any) => {
    navigation.navigate("Chat", { selectedChat: chat });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Quay lại</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAddFriend(true)}>
          <Text style={styles.addBtn}>+ Thêm bạn</Text>
        </TouchableOpacity>
      </View>

      <ContactsPanel user={user} onStartChat={handleStartChat} />

      <AddFriendModal
        visible={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        currentUser={user}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0e9de8",
  },
  backBtn: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  addBtn: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ContactsScreen;
