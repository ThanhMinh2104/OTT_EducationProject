import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import { API_URL } from "../utils/config";

const socket = io(API_URL);

interface Friend {
  userID: string;
  name: string;
  sdt?: string;
  anhDaiDien?: string;
  trangThai?: string;
  alias?: string;
}

interface FriendRequest {
  contactID: string;
  userID: string;
  name?: string;
  avatar?: string;
  sdt?: string;
  message?: string;
}

interface SentRequest {
  recipientID: string;
  senderID: string;
  name?: string;
  avatar?: string;
  sdt?: string;
}

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string } | null;
  onStartChat: (chat: any) => void;
}

const ContactsPanel = ({ user, onStartChat }: Props) => {
  const [tab, setTab] = useState<"friends" | "groups" | "oa">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllFriends, setShowAllFriends] = useState(false);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/contacts/friends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setFriends(data);
    } catch {
      Alert.alert("Lỗi", "Không thể tải danh sách bạn bè");
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/contacts/friend-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequests(data);
    } catch {
      // ignore
    }
  };

  const fetchSentRequests = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/contacts/sent-friend-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSentRequests(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchFriends();
    fetchRequests();
    fetchSentRequests();

    socket.emit("join_user", user.userID);

    socket.on("new_friend_request", (data: FriendRequest) => {
      setRequests((prev) => {
        if (prev.find((r) => r.contactID === data.contactID)) return prev;
        return [data, ...prev];
      });
      Alert.alert("Lời mời kết bạn", `${data.name} đã gửi lời mời kết bạn`);
    });

    socket.on("friend_request_accepted", (data: any) => {
      fetchFriends();
      setRequests((prev) => prev.filter((r) => r.contactID !== data.userID));
      setSentRequests((prev) =>
        prev.filter((r) => r.recipientID !== data.userID),
      );
      if (data.actorID !== user.userID) {
        Alert.alert("Thành công", `${data.name} đã chấp nhận lời mời kết bạn`);
      }
    });

    socket.on(
      "friend_request_cancelled",
      (data: { senderID: string; recipientID: string }) => {
        if (data.recipientID === user.userID) {
          setRequests((prev) =>
            prev.filter((r) => r.contactID !== data.senderID),
          );
        }
        if (data.senderID === user.userID) {
          setSentRequests((prev) =>
            prev.filter((r) => r.recipientID !== data.recipientID),
          );
        }
      },
    );

    socket.on(
      "friend_request_rejected",
      (data: { senderID: string; recipientID: string }) => {
        if (data.senderID === user.userID) {
          setSentRequests((prev) =>
            prev.filter((r) => r.recipientID !== data.recipientID),
          );
        }
      },
    );

    socket.on(
      "friend_unfriended",
      (data: { userID: string; friendID: string }) => {
        const targetID =
          data.userID === user.userID ? data.friendID : data.userID;
        setFriends((prev) => prev.filter((f) => f.userID !== targetID));
      },
    );

    return () => {
      socket.off("new_friend_request");
      socket.off("friend_request_accepted");
      socket.off("friend_request_cancelled");
      socket.off("friend_request_rejected");
      socket.off("friend_unfriended");
    };
  }, [user?.userID]);

  const handleAccept = async (req: FriendRequest) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_URL}/api/contacts/accept-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senderID: req.contactID }),
      });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      Alert.alert("Thành công", `Đã kết bạn với ${req.name}`);
      fetchFriends();
    } catch {
      Alert.alert("Lỗi", "Không thể chấp nhận kết bạn");
    }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_URL}/api/contacts/reject-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senderID: req.contactID }),
      });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      Alert.alert("Đã từ chối lời mời");
    } catch {
      Alert.alert("Lỗi", "Không thể từ chối");
    }
  };

  const handleCancelSent = async (req: SentRequest) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${API_URL}/api/contacts/cancel-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientID: req.recipientID }),
      });
      setSentRequests((prev) =>
        prev.filter((r) => r.recipientID !== req.recipientID),
      );
      Alert.alert("Thành công", "Đã thu hồi lời mời");
    } catch {
      Alert.alert("Lỗi", "Không thể thu hồi lời mời");
    }
  };

  const handleStartChat = async (friend: Friend) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/createChat1-1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userID2: friend.userID }),
      });
      const data = await res.json();
      onStartChat(data);
    } catch {
      Alert.alert("Lỗi", "Không thể mở cuộc trò chuyện");
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      (f.alias || f.name).toLowerCase().includes(search.toLowerCase()) ||
      f.sdt?.includes(search),
  );

  // Group friends by first letter
  const groupedFriends = filteredFriends.reduce(
    (acc, friend) => {
      const firstLetter = (friend.alias || friend.name).charAt(0).toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(friend);
      return acc;
    },
    {} as Record<string, Friend[]>,
  );

  const sortedGroups = Object.keys(groupedFriends).sort();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#65676b"
          />
        </View>
        <TouchableOpacity style={styles.headerIcon}>
          <Text style={styles.headerIconText}>👤➕</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "friends" && styles.tabActive]}
          onPress={() => setTab("friends")}
        >
          <Text
            style={[styles.tabText, tab === "friends" && styles.tabTextActive]}
          >
            Bạn bè
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "groups" && styles.tabActive]}
          onPress={() => setTab("groups")}
        >
          <Text
            style={[styles.tabText, tab === "groups" && styles.tabTextActive]}
          >
            Nhóm
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "oa" && styles.tabActive]}
          onPress={() => setTab("oa")}
        >
          <Text style={[styles.tabText, tab === "oa" && styles.tabTextActive]}>
            OA
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === "friends" && (
        <FlatList
          data={[
            { type: "header" },
            ...sortedGroups.flatMap((letter) => [
              { type: "section", letter },
              ...groupedFriends[letter].map((f) => ({
                type: "friend",
                data: f,
              })),
            ]),
          ]}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={({ item }: any) => {
            if (item.type === "header") {
              return (
                <View>
                  {/* Friend Requests */}
                  {requests.length > 0 && (
                    <TouchableOpacity style={styles.specialItem}>
                      <View style={styles.specialIcon}>
                        <Text style={styles.specialIconText}>👥</Text>
                      </View>
                      <Text style={styles.specialText}>
                        Lời mời kết bạn ({requests.length})
                      </Text>
                      {requests.length > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {requests.length}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Birthday */}
                  <TouchableOpacity style={styles.specialItem}>
                    <View style={styles.specialIcon}>
                      <Text style={styles.specialIconText}>🎂</Text>
                    </View>
                    <Text style={styles.specialText}>Sinh nhật</Text>
                  </TouchableOpacity>

                  {/* Friend Count */}
                  <View style={styles.countContainer}>
                    <TouchableOpacity style={styles.countBtn}>
                      <Text style={styles.countText}>
                        Tất cả {friends.length}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.countBtn}>
                      <Text style={styles.countText}>Mới truy cập 0</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            if (item.type === "section") {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionText}>{item.letter}</Text>
                </View>
              );
            }

            if (item.type === "friend") {
              const friend = item.data as Friend;
              return (
                <TouchableOpacity
                  style={styles.friendItem}
                  onPress={() => handleStartChat(friend)}
                >
                  <Image
                    source={{
                      uri:
                        friend.anhDaiDien ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.userID}`,
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>
                      {friend.alias || friend.name}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.callBtn}>
                    <Text style={styles.callIcon}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.videoBtn}>
                    <Text style={styles.videoIcon}>📹</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }

            return null;
          }}
        />
      )}

      {tab === "groups" && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Chưa có nhóm nào</Text>
        </View>
      )}

      {tab === "oa" && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Chưa có OA nào</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0091ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: {
    fontSize: 20,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#0091ff",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#65676b",
  },
  tabTextActive: {
    color: "#0091ff",
  },
  specialItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  specialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0091ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  specialIconText: {
    fontSize: 20,
  },
  specialText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#050505",
  },
  badge: {
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  countContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  countBtn: {
    backgroundColor: "#f0f2f5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countText: {
    fontSize: 13,
    color: "#050505",
  },
  sectionHeader: {
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0091ff",
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#050505",
  },
  callBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  callIcon: {
    fontSize: 20,
  },
  videoBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  videoIcon: {
    fontSize: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: "#65676b",
  },
});

export default ContactsPanel;
