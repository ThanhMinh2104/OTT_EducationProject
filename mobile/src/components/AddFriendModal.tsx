import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  FlatList,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/config";

interface User {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  friendStatus?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUser: { userID: string; name: string } | null;
}

const AddFriendModal = ({ visible, onClose, currentUser }: Props) => {
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSearch = async () => {
    if (!searchText.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập số điện thoại");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/contacts/search?phone=${searchText}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      Alert.alert("Lỗi", "Không thể tìm kiếm");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUser: User) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_URL}/api/contacts/send-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientID: targetUser.userID,
          message: message || "Mình kết bạn nhé!",
        }),
      });
      Alert.alert("Thành công", "Đã gửi lời mời kết bạn");
      setSearchResults((prev) =>
        prev.map((u) =>
          u.userID === targetUser.userID
            ? { ...u, friendStatus: "pending_sent" }
            : u,
        ),
      );
    } catch {
      Alert.alert("Lỗi", "Không thể gửi lời mời");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Thêm bạn</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>Đóng</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Nhập số điện thoại"
            value={searchText}
            onChangeText={setSearchText}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>Tìm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.messageBox}>
          <TextInput
            style={styles.messageInput}
            placeholder="Lời nhắn (tùy chọn)"
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="#999"
          />
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.userID}
          renderItem={({ item }) => (
            <View style={styles.resultItem}>
              <Image
                source={{
                  uri:
                    item.anhDaiDien ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userID}`,
                }}
                style={styles.avatar}
              />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userPhone}>{item.sdt}</Text>
              </View>
              {item.friendStatus === "accepted" ? (
                <Text style={styles.statusText}>Đã là bạn</Text>
              ) : item.friendStatus === "pending_sent" ? (
                <Text style={styles.statusText}>Đã gửi</Text>
              ) : item.friendStatus === "pending_received" ? (
                <Text style={styles.statusText}>Đã nhận</Text>
              ) : (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleSendRequest(item)}
                >
                  <Text style={styles.addBtnText}>Kết bạn</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            !loading && searchText ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Không tìm thấy người dùng</Text>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
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
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  closeBtn: {
    fontSize: 14,
    color: "#0e9de8",
    fontWeight: "600",
  },
  searchBox: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1a1a1a",
  },
  searchBtn: {
    backgroundColor: "#0e9de8",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: "center",
  },
  searchBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  messageBox: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1a1a1a",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  userPhone: {
    fontSize: 13,
    color: "#999",
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: "#0e9de8",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 13,
    color: "#999",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
});

export default AddFriendModal;
