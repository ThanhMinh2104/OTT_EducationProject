import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/AppNavigator";
import UserProfileModal, { User } from "../components/UserProfileModal";
import ContactsScreen from "../screens/ContactsScreen";
import AddFriendModal from "../components/AddFriendModal";
import { API_URL } from "../utils/config";
import socket from "../utils/socket";

// Import inline để tránh navigate
import ChatScreenInline from "./ChatScreenEnhanced";

type Props = { navigation: StackNavigationProp<RootStackParamList, "Home"> };
type Tab = "chat" | "contacts" | "profile";

const HomeScreen = ({ navigation }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatToOpen, setChatToOpen] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("user");
      const token = await AsyncStorage.getItem("token");
      if (!stored || !token) {
        navigation.replace("Login");
        return;
      }
      const u = JSON.parse(stored);
      setUser(u);
      socket.emit("join_user", u.userID);
    })();

    socket.on("update_user", async (data: User) => {
      setUser(data);
      await AsyncStorage.setItem("user", JSON.stringify(data));
    });

    socket.on("userUpdated", async (data: User) => {
      const stored = await AsyncStorage.getItem("user");
      if (!stored) return;
      const u = JSON.parse(stored);
      if (u.userID === data.userID) {
        setUser(data);
        await AsyncStorage.setItem("user", JSON.stringify(data));
      }
    });

    socket.on("forceLogout", async (data: { userID: string }) => {
      const stored = await AsyncStorage.getItem("user");
      if (!stored) return;
      const u = JSON.parse(stored);
      if (u.userID === data.userID) {
        await AsyncStorage.clear();
        navigation.replace("Login");
      }
    });

    socket.on("reminder_due", (payload: { type: string; title: string; groupID?: string; chatID?: string }) => {
      const label = payload.type === 'group' ? 'Nhóm' : 'Chat';
      Alert.alert(
        '⏰ Nhắc hẹn',
        `${label}: ${payload.title}`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    });

    return () => {
      socket.off("update_user");
      socket.off("userUpdated");
      socket.off("forceLogout");
      socket.off("reminder_due");
    };
  }, [navigation]);

  const handleLogout = async () => {
    if (user) {
      await fetch(`${API_URL}/api/updateStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userID: user.userID, trangThai: "offline" }),
      });
    }
    await AsyncStorage.clear();
    navigation.replace("Login");
  };

  const updateUser = async (u: User) => {
    setUser(u);
    await AsyncStorage.setItem("user", JSON.stringify(u));
  };

  const [pendingChat, setPendingChat] = useState<any>(null);

  const handleStartChat = (chat: any) => {
    // Chuyển sang tab chat và mở chat với người đó
    setChatToOpen(chat);
    setActiveTab("chat");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar backgroundColor="#0068ff" barStyle="light-content" />

        {/* Content area — render theo tab */}
        <View style={styles.content}>
          {/* Chat tab — luôn mount để giữ state, ẩn/hiện bằng display */}
          <View style={{ flex: 1, display: activeTab === "chat" ? "flex" : "none" }}>
            <ChatScreenInline
              navigation={navigation as any}
              onChatOpen={() => setIsChatOpen(true)}
              onChatClose={() => setIsChatOpen(false)}
              initialChat={chatToOpen}
              onChatOpened={() => setChatToOpen(null)}
            />
          </View>

          {/* Contacts tab */}
          {activeTab === "contacts" && (
            <View style={styles.contactsWrapper}>
              {/* Header danh bạ */}
              <View style={styles.contactsHeader}>
                <Text style={styles.contactsTitle}>Danh bạ</Text>
              </View>
              <ContactsScreen user={user} onStartChat={handleStartChat} />
            </View>
          )}

          {/* Profile tab */}
          {activeTab === "profile" && (
            <View style={styles.profileWrapper}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileTitle}>Hồ sơ</Text>
              </View>
              <View style={styles.profileContent}>
                <TouchableOpacity
                  style={styles.profileCard}
                  onPress={() => setShowProfileModal(true)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{
                      uri: user?.anhDaiDien || "https://via.placeholder.com/64",
                    }}
                    style={styles.profileAvatar}
                  />
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{user?.name}</Text>
                    <Text style={styles.profileSub}>Xem trang cá nhân</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#aaa" />
                </TouchableOpacity>

                <View style={styles.profileActions}>
                  <TouchableOpacity
                    style={styles.profileActionItem}
                    onPress={() => setShowLogoutModal(true)}
                  >
                    <View style={[styles.profileActionIcon, { backgroundColor: "#fff0f0" }]}>
                      <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                    </View>
                    <Text style={[styles.profileActionText, { color: "#ef4444" }]}>
                      Đăng xuất
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#ddd" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom tab bar — ẩn khi đang trong chat */}
        {!isChatOpen && (
          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab("chat")}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={activeTab === "chat" ? "message-text" : "message-text-outline"}
                size={24}
                color={activeTab === "chat" ? "#0068ff" : "#888"}
              />
              <Text style={[styles.navLabel, activeTab === "chat" && styles.navLabelActive]}>
                Tin nhắn
              </Text>
              {activeTab === "chat" && <View style={styles.navIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab("contacts")}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === "contacts" ? "people" : "people-outline"}
                size={24}
                color={activeTab === "contacts" ? "#0068ff" : "#888"}
              />
              <Text style={[styles.navLabel, activeTab === "contacts" && styles.navLabelActive]}>
                Danh bạ
              </Text>
              {activeTab === "contacts" && <View style={styles.navIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setActiveTab("profile")}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === "profile" ? "person" : "person-outline"}
                size={24}
                color={activeTab === "profile" ? "#0068ff" : "#888"}
              />
              <Text style={[styles.navLabel, activeTab === "profile" && styles.navLabelActive]}>
                Hồ sơ
              </Text>
              {activeTab === "profile" && <View style={styles.navIndicator} />}
            </TouchableOpacity>
          </View>
        )}
        {/* Modals */}
        <UserProfileModal
          visible={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={user}
          setUser={updateUser}
        />

        <AddFriendModal
          visible={showAddFriend}
          onClose={() => setShowAddFriend(false)}
          currentUser={user}
          onStartChat={() => setActiveTab("chat")}
        />

        {/* Logout confirm */}
        <Modal
          transparent
          visible={showLogoutModal}
          animationType="fade"
          onRequestClose={() => setShowLogoutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalIconBox}>
                <Ionicons name="log-out-outline" size={30} color="#ef4444" />
              </View>
              <Text style={styles.modalTitle}>Đăng xuất</Text>
              <Text style={styles.modalMessage}>
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => setShowLogoutModal(false)}
                >
                  <Text style={styles.btnCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnConfirm} onPress={handleLogout}>
                  <Text style={styles.btnConfirmText}>Đăng xuất</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f0" },
  content: { flex: 1 },

  // Contacts tab
  contactsWrapper: { flex: 1, backgroundColor: "#fff" },
  contactsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0068ff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contactsTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  addFriendBtn: { padding: 4 },

  // Profile tab
  profileWrapper: { flex: 1, backgroundColor: "#f5f5f5" },
  profileHeader: {
    backgroundColor: "#0068ff",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  profileContent: { padding: 16, gap: 12 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatar: { width: 56, height: 56, borderRadius: 28 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: "700", color: "#111" },
  profileSub: { fontSize: 13, color: "#888", marginTop: 2 },
  profileActions: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  profileActionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  profileActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  profileActionText: { flex: 1, fontSize: 15, fontWeight: "500" },

  // Bottom nav
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    paddingBottom: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    position: "relative",
  },
  navLabel: { fontSize: 11, color: "#888", marginTop: 3, fontWeight: "500" },
  navLabelActive: { color: "#0068ff", fontWeight: "700" },
  navIndicator: {
    position: "absolute",
    top: 0,
    width: 32,
    height: 3,
    backgroundColor: "#0068ff",
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },

  // Logout modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111", marginBottom: 8 },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: { flexDirection: "row", gap: 12, width: "100%" },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  btnCancelText: { fontSize: 14, fontWeight: "600", color: "#666" },
  btnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#ef4444",
    alignItems: "center",
  },
  btnConfirmText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

export default HomeScreen;
