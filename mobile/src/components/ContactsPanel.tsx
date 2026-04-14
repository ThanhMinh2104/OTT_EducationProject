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
  Modal,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/config";
import socket from "../utils/socket";

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

type Tab = "friends" | "requests";

const ContactsPanel = ({ user, onStartChat }: Props) => {
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [recallTarget, setRecallTarget] = useState<SentRequest | null>(null);

  const getToken = async () => AsyncStorage.getItem("token");

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/friends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setFriends(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert("Loi", "Khong the tai danh sach ban be");
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/friend-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchSentRequests = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/contacts/sent-friend-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSentRequests(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    fetchFriends();
    fetchRequests();
    fetchSentRequests();
    socket.emit("join_user", user.userID);

    socket.on("new_friend_request", (data: FriendRequest) => {
      setRequests((prev) =>
        prev.find((r) => r.contactID === data.contactID) ? prev : [data, ...prev]
      );
      Alert.alert("Loi moi ket ban", `${data.name} da gui loi moi ket ban`);
    });

    socket.on("friend_request_accepted", (data: any) => {
      fetchFriends();
      setRequests((prev) => prev.filter((r) => r.contactID !== data.userID));
      setSentRequests((prev) => prev.filter((r) => r.recipientID !== data.userID));
      if (data.actorID !== user.userID) {
        Alert.alert("Thanh cong", `${data.name} da chap nhan loi moi ket ban`);
      }
    });

    socket.on(
      "friend_request_cancelled",
      (data: { senderID: string; recipientID: string }) => {
        if (data.recipientID === user.userID)
          setRequests((prev) => prev.filter((r) => r.contactID !== data.senderID));
        if (data.senderID === user.userID)
          setSentRequests((prev) =>
            prev.filter((r) => r.recipientID !== data.recipientID)
          );
      }
    );

    socket.on(
      "friend_request_rejected",
      (data: { senderID: string; recipientID: string }) => {
        if (data.senderID === user.userID)
          setSentRequests((prev) =>
            prev.filter((r) => r.recipientID !== data.recipientID)
          );
      }
    );

    socket.on("friend_unfriended", (data: { userID: string; friendID: string }) => {
      const targetID = data.userID === user.userID ? data.friendID : data.userID;
      setFriends((prev) => prev.filter((f) => f.userID !== targetID));
    });

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
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/accept-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senderID: req.contactID }),
      });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
      Alert.alert("Thanh cong", `Da ket ban voi ${req.name}`);
      fetchFriends();
    } catch {
      Alert.alert("Loi", "Khong the chap nhan ket ban");
    }
  };

  const handleReject = async (req: FriendRequest) => {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/reject-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senderID: req.contactID }),
      });
      setRequests((prev) => prev.filter((r) => r.contactID !== req.contactID));
    } catch {
      Alert.alert("Loi", "Khong the tu choi");
    }
  };

  const handleCancelSent = async () => {
    if (!recallTarget) return;
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/contacts/cancel-friend-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientID: recallTarget.recipientID }),
      });
      setSentRequests((prev) =>
        prev.filter((r) => r.recipientID !== recallTarget.recipientID)
      );
      Alert.alert("Thanh cong", "Da thu hoi loi moi");
    } catch {
      Alert.alert("Loi", "Khong the thu hoi loi moi");
    } finally {
      setRecallTarget(null);
    }
  };

  const handleStartChat = async (friend: Friend) => {
    try {
      const token = await getToken();
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
      Alert.alert("Loi", "Khong the mo cuoc tro chuyen");
    }
  };

  const filteredFriends = friends.filter(
    (f) =>
      (f.alias || f.name).toLowerCase().includes(search.toLowerCase()) ||
      f.sdt?.includes(search)
  );

  const groupedFriends = filteredFriends.reduce(
    (acc, friend) => {
      const letter = (friend.alias || friend.name).charAt(0).toUpperCase();
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(friend);
      return acc;
    },
    {} as Record<string, Friend[]>
  );
  const sortedGroups = Object.keys(groupedFriends).sort();
  const pendingCount = requests.length;

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Tim kiem ban be..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "friends" && styles.tabActive]}
          onPress={() => setTab("friends")}
        >
          <Text style={[styles.tabText, tab === "friends" && styles.tabTextActive]}>
            Ban be ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "requests" && styles.tabActive]}
          onPress={() => setTab("requests")}
        >
          <Text style={[styles.tabText, tab === "requests" && styles.tabTextActive]}>
            Loi moi
          </Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading && friends.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0091ff" />
        </View>
      ) : tab === "friends" ? (
        <FlatList
          data={sortedGroups.flatMap((letter) => [
            { type: "section" as const, letter },
            ...groupedFriends[letter].map((f) => ({
              type: "friend" as const,
              data: f,
            })),
          ])}
          keyExtractor={(item, idx) => `${item.type}-${idx}`}
          renderItem={({ item }) => {
            if (item.type === "section") {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionText}>{(item as any).letter}</Text>
                </View>
              );
            }
            const friend = (item as any).data as Friend;
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
                  <Text style={styles.friendName}>{friend.alias || friend.name}</Text>
                  {friend.sdt ? (
                    <Text style={styles.friendPhone}>{friend.sdt}</Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        friend.trangThai === "online" ? "#34c759" : "#ccc",
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>Chua co ban be nao</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={[
            { section: "received" as const },
            ...requests.map((r) => ({ type: "received" as const, data: r })),
            { section: "sent" as const },
            ...sentRequests.map((r) => ({ type: "sent" as const, data: r })),
          ]}
          keyExtractor={(item, idx) => `req-${idx}`}
          renderItem={({ item }: any) => {
            if (item.section === "received") {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionText}>
                    Loi moi nhan duoc ({requests.length})
                  </Text>
                </View>
              );
            }
            if (item.section === "sent") {
              return (
                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                  <Text style={styles.sectionText}>
                    Loi moi da gui ({sentRequests.length})
                  </Text>
                </View>
              );
            }
            if (item.type === "received") {
              const req = item.data as FriendRequest;
              return (
                <View style={styles.requestItem}>
                  <Image
                    source={{
                      uri:
                        req.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.contactID}`,
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.requestInfo}>
                    <Text style={styles.friendName}>{req.name}</Text>
                    {req.message ? (
                      <Text style={styles.requestMessage} numberOfLines={1}>
                        "{req.message}"
                      </Text>
                    ) : null}
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.btnAccept}
                        onPress={() => handleAccept(req)}
                      >
                        <Text style={styles.btnAcceptText}>Chap nhan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnReject}
                        onPress={() => handleReject(req)}
                      >
                        <Text style={styles.btnRejectText}>Tu choi</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }
            if (item.type === "sent") {
              const req = item.data as SentRequest;
              return (
                <View style={styles.requestItem}>
                  <Image
                    source={{
                      uri:
                        req.avatar ||
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.recipientID}`,
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.requestInfo}>
                    <Text style={styles.friendName}>{req.name}</Text>
                    <Text style={styles.sentLabel}>Dang cho phan hoi</Text>
                    <TouchableOpacity
                      style={styles.btnRecall}
                      onPress={() => setRecallTarget(req)}
                    >
                      <Text style={styles.btnRecallText}>Thu hoi loi moi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }
            return null;
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Khong co loi moi nao</Text>
            </View>
          }
        />
      )}

      <Modal
        transparent
        visible={!!recallTarget}
        animationType="fade"
        onRequestClose={() => setRecallTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Thu hoi loi moi</Text>
            <Text style={styles.modalMessage}>
              Ban co chac muon thu hoi loi moi ket ban gui den {recallTarget?.name}?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setRecallTarget(null)}
              >
                <Text style={styles.btnCancelText}>Huy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleCancelSent}>
                <Text style={styles.btnConfirmText}>Thu hoi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f2f5",
    margin: 12,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#050505" },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: { borderBottomColor: "#0091ff" },
  tabText: { fontSize: 15, fontWeight: "600", color: "#65676b" },
  tabTextActive: { color: "#0091ff" },
  badge: {
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  sectionHeader: {
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionText: { fontSize: 13, fontWeight: "700", color: "#0091ff" },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: "600", color: "#050505" },
  friendPhone: { fontSize: 13, color: "#65676b", marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  requestItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  requestInfo: { flex: 1 },
  requestMessage: {
    fontSize: 13,
    color: "#65676b",
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 8,
  },
  sentLabel: { fontSize: 13, color: "#65676b", marginTop: 2, marginBottom: 8 },
  requestActions: { flexDirection: "row", gap: 8 },
  btnAccept: {
    flex: 1,
    backgroundColor: "#0091ff",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  btnAcceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnReject: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  btnRejectText: { color: "#333", fontSize: 13, fontWeight: "600" },
  btnRecall: {
    backgroundColor: "#f0f2f5",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  btnRecallText: { color: "#ff3b30", fontSize: 13, fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#65676b" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  btnCancelText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  btnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#ff3b30",
    alignItems: "center",
  },
  btnConfirmText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

export default ContactsPanel;
