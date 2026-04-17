import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { RootStackParamList } from "../navigation/AppNavigator";
import { API_URL } from "../utils/config";
import socket from "../utils/socket";
import StickerEmojiPicker from "../components/StickerEmojiPicker";
import AudioPlayer from "../components/AudioPlayer";
import { Ionicons } from "@expo/vector-icons";

type Props = { 
  navigation: StackNavigationProp<RootStackParamList, "Chat">;
  route: { params?: { selectedChat?: Chat } };
};

interface Message {
  messageID?: string;
  tempID?: string;
  chatID: string;
  senderID: string;
  content?: string;
  type: string;
  timestamp: string;
  media_url?: string[];
  status?: string;
  senderInfo?: { name: string; avatar?: string | null };
  forwardedFrom?: string;
  pinnedInfo?: { pinnedBy?: string; pinnedAt?: string } | null;
}

interface Chat {
  chatID: string;
  name: string;
  type: "private" | "group";
  avatar?: string;
  members: { userID: string; role: string }[];
  lastMessage: Message[];
}

interface User {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

const ChatScreen = ({ navigation, route }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [pinnedMenuId, setPinnedMenuId] = useState<string | null>(null);

  // Nhận selectedChat từ navigation params (từ ContactsScreen)
  useEffect(() => {
    if (route.params?.selectedChat) {
      const chat = route.params.selectedChat;
      setSelectedChat(chat);
      setMessages(chat.lastMessage || []);
      setPinnedMessages(
        (chat.lastMessage || []).filter((m) => m.pinnedInfo && m.pinnedInfo.pinnedBy)
      );
      if (user) {
        console.log("🔌 Joining chat room:", chat.chatID);
        socket.emit("join_chat", chat.chatID);
        socket.emit("read_messages", { chatID: chat.chatID, userID: user.userID });
      }
    }
  }, [route.params?.selectedChat, user]);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("user");
      if (!stored) {
        navigation.replace("Login");
        return;
      }
      const u = JSON.parse(stored);
      setUser(u);
      
      console.log("🔌 Socket connected:", socket.connected);
      console.log("🔌 Socket ID:", socket.id);
      
      socket.emit("join_user", u.userID);
      socket.emit("getChat", u.userID);
    })();

    socket.on("ChatByUserID", (data: Chat[]) => {
      console.log("📋 Received ChatByUserID:", data.length, "chats");
      setChats(data);
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });

    return () => {
      socket.off("ChatByUserID");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [navigation]);

  // Separate useEffect for message-related socket events
  useEffect(() => {
    if (!selectedChat || !user) return;

    const chatID = selectedChat.chatID;
    console.log("🔌 Setting up socket listeners for chat:", chatID);

    const onNewMessage = (msg: Message) => {
      console.log("📩 Received new_message:", msg);
      if (msg.chatID === chatID) {
        setMessages((prev) => {
          // Nếu tin nhắn đã tồn tại (có messageID hoặc tempID trùng), update nó
          const exists = prev.find(
            (m) => m.messageID === msg.messageID || (msg.tempID && m.tempID === msg.tempID)
          );
          if (exists) {
            return prev.map((m) => 
              (m.tempID === msg.tempID || m.messageID === msg.messageID) 
                ? { ...m, ...msg } 
                : m
            );
          }
          // Nếu chưa tồn tại, thêm mới
          return [...prev, msg];
        });
      }
    };

    const onGhimNotification = (updated: Message) => {
      console.log("📌 Received ghim_notification:", updated);
      if (updated.chatID === chatID) {
        setMessages((prev) =>
          prev.map((m) => (m.messageID === updated.messageID ? { ...m, ...updated } : m))
        );
        setPinnedMessages((prev) => {
          const exists = prev.find((m) => m.messageID === updated.messageID);
          return exists
            ? prev.map((m) => (m.messageID === updated.messageID ? updated : m))
            : [...prev, updated];
        });
      }
    };

    const onUnghimNotification = (updated: Message) => {
      console.log("📌 Received unghim_notification:", updated);
      if (updated.chatID === chatID) {
        setMessages((prev) =>
          prev.map((m) => (m.messageID === updated.messageID ? { ...m, pinnedInfo: null } : m))
        );
        setPinnedMessages((prev) => prev.filter((m) => m.messageID !== updated.messageID));
      }
    };

    socket.on("new_message", onNewMessage);
    socket.on("ghim_notification", onGhimNotification);
    socket.on("unghim_notification", onUnghimNotification);

    return () => {
      console.log("🧹 Cleaning up socket listeners for chat:", chatID);
      socket.off("new_message", onNewMessage);
      socket.off("ghim_notification", onGhimNotification);
      socket.off("unghim_notification", onUnghimNotification);
    };
  }, [selectedChat?.chatID, user]);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages(chat.lastMessage || []);
    setPinnedMessages(
      (chat.lastMessage || []).filter((m) => m.pinnedInfo && m.pinnedInfo.pinnedBy)
    );
    console.log("🔌 Joining chat room:", chat.chatID);
    socket.emit("join_chat", chat.chatID);
  };

  const sendMessage = () => {
    if (!inputText.trim() || !selectedChat || !user) return;
    const msg: Message = {
      tempID: Date.now().toString(),
      chatID: selectedChat.chatID,
      senderID: user.userID,
      content: inputText,
      type: "text",
      timestamp: new Date().toISOString(),
      senderInfo: { name: user.name, avatar: user.anhDaiDien || null },
    };
    socket.emit("send_message", msg);
    setMessages((prev) => [...prev, msg]);
    setInputText("");
    setReplyTo(null);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(
        result.assets.map((a) => ({ uri: a.uri, type: "image" })),
      );
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      multiple: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(
        result.assets.map((a) => ({ uri: a.uri, type: "file", name: a.name })),
      );
    }
  };

  const uploadFiles = async (
    files: { uri: string; type: string; name?: string }[],
  ) => {
    if (!selectedChat || !user) return;
    setIsUploading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", {
          uri: file.uri,
          name: file.name || `file_${Date.now()}`,
          type:
            file.type === "image" ? "image/jpeg" : "application/octet-stream",
        } as any);
      });

      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (data.urls && data.urls.length > 0) {
        const msg: Message = {
          tempID: Date.now().toString(),
          chatID: selectedChat.chatID,
          senderID: user.userID,
          content: files[0].name || "",
          type: files[0].type,
          timestamp: new Date().toISOString(),
          media_url: data.urls,
          senderInfo: { name: user.name, avatar: user.anhDaiDien || null },
        };
        socket.emit("send_message", msg);
        setMessages((prev) => [...prev, msg]);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải file lên");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmoji(false);
  };

  const handleStickerSelect = async (url: string) => {
    if (!selectedChat || !user) return;
    const msg: Message = {
      tempID: Date.now().toString(),
      chatID: selectedChat.chatID,
      senderID: user.userID,
      content: "",
      type: "sticker",
      timestamp: new Date().toISOString(),
      media_url: [url],
      senderInfo: { name: user.name, avatar: user.anhDaiDien || null },
    };
    socket.emit("send_message", msg);
    setMessages((prev) => [...prev, msg]);
    setShowEmoji(false);
  };

  const handleGifSelect = async (url: string) => {
    if (!selectedChat || !user) return;
    const msg: Message = {
      tempID: Date.now().toString(),
      chatID: selectedChat.chatID,
      senderID: user.userID,
      content: "",
      type: "gif",
      timestamp: new Date().toISOString(),
      media_url: [url],
      senderInfo: { name: user.name, avatar: user.anhDaiDien || null },
    };
    socket.emit("send_message", msg);
    setMessages((prev) => [...prev, msg]);
    setShowEmoji(false);
  };

  const handleDeleteLocal = (msg: Message) => {
    if (!msg.messageID || !user?.userID || !selectedChat) return;
    socket.emit("delete_message_local", {
      messageID: msg.messageID,
      userID: user.userID,
      chatID: selectedChat.chatID,
    });
    setShowMenu(false);
    Alert.alert("Thành công", "Tin nhắn đã được xóa phía bạn");
  };

  const handleForwardMessage = (msg: Message) => {
    if (!msg.messageID) {
      Alert.alert("Lỗi", "Không thể chuyển tiếp tin nhắn này");
      return;
    }
    setShowMenu(false);
    navigation.navigate("Forward", {
      message: msg,
      chatID: selectedChat!.chatID,
    });
  };

  const handleLongPress = (msg: Message) => {
    console.log("👆 Long press on message:", {
      messageID: msg.messageID,
      tempID: msg.tempID,
      content: msg.content,
      pinnedInfo: msg.pinnedInfo,
    });
    
    if (!msg.messageID) {
      Alert.alert("Lỗi", "Tin nhắn này chưa được đồng bộ, vui lòng thử lại sau");
      return;
    }
    
    setSelectedMessage(msg);
    setShowMenu(true);
  };

  const handlePinMessage = (msg: Message) => {
    if (!msg.messageID || !user || !selectedChat) return;
    
    console.log("📌 Attempting to pin/unpin message:", {
      messageID: msg.messageID,
      chatID: selectedChat.chatID,
      userID: user.userID,
      isPinned: !!msg.pinnedInfo,
    });
    
    if (msg.pinnedInfo) {
      // Bỏ ghim
      console.log("📌 Emitting unghim_message");
      socket.emit("unghim_message", { messageID: msg.messageID, chatID: selectedChat.chatID });
      Alert.alert("Thành công", "Đã bỏ ghim tin nhắn");
    } else {
      // Kiểm tra giới hạn 3 tin nhắn ghim
      if (pinnedMessages.length >= 3) {
        Alert.alert("Thông báo", "Chỉ có thể ghim tối đa 3 tin nhắn");
        setShowMenu(false);
        return;
      }
      // Ghim tin nhắn
      console.log("📌 Emitting ghim_message");
      socket.emit("ghim_message", {
        messageID: msg.messageID,
        chatID: selectedChat.chatID,
        senderID: user.userID,
      });
      Alert.alert("Thành công", "Đã ghim tin nhắn");
    }
    setShowMenu(false);
  };

  const scrollToMessage = (messageID?: string) => {
    if (!messageID) return;
    const index = messages.findIndex((m) => m.messageID === messageID);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setShowPinnedList(false);
    }
  };

  const handleMoveToTop = (msg: Message) => {
    if (!msg.messageID || !selectedChat) return;
    // Bỏ ghim rồi ghim lại để đưa lên đầu
    socket.emit("unghim_message", { messageID: msg.messageID, chatID: selectedChat.chatID });
    setTimeout(() => {
      socket.emit("ghim_message", {
        messageID: msg.messageID,
        chatID: selectedChat.chatID,
        senderID: user!.userID,
      });
    }, 100);
    setPinnedMenuId(null);
    Alert.alert("Thành công", "Đã đưa lên đầu");
  };

  const handleCopyPinned = (msg: Message) => {
    if (msg.content) {
      Clipboard.setString(msg.content);
      Alert.alert("Thành công", "Đã sao chép");
    }
    setPinnedMenuId(null);
  };

  const handleUnpinFromMenu = (msg: Message) => {
    if (!msg.messageID || !selectedChat) return;
    socket.emit("unghim_message", { messageID: msg.messageID, chatID: selectedChat.chatID });
    setPinnedMenuId(null);
    Alert.alert("Thành công", "Đã bỏ ghim");
  };

  if (!selectedChat) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.chatListContainer}>
          <Text style={styles.title}>Tin nhắn</Text>
          <FlatList
            data={chats}
            keyExtractor={(item) => item.chatID}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.chatItem}
                onPress={() => handleSelectChat(item)}
              >
                <Image
                  source={{
                    uri: item.avatar || "https://via.placeholder.com/50",
                  }}
                  style={styles.chatAvatar}
                />
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{item.name}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage?.[0]?.content || "Chưa có tin nhắn"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          // Nếu được navigate từ ContactsPanel (có params), quay lại
          if (route.params?.selectedChat) {
            navigation.goBack();
          } else {
            // Nếu chọn từ danh sách chat trong screen này, chỉ clear selection
            setSelectedChat(null);
          }
        }}>
          <Text style={styles.backBtn}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.chatTitle}>{selectedChat.name}</Text>
        
        {/* Menu button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowInfoPanel(true)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info Panel Modal */}
      <Modal
        transparent
        visible={showInfoPanel}
        animationType="slide"
        onRequestClose={() => {
          setShowInfoPanel(false);
          setPinnedMenuId(null);
        }}
      >
        <View style={styles.infoPanelOverlay}>
          <TouchableOpacity
            style={styles.infoPanelBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowInfoPanel(false);
              setPinnedMenuId(null);
            }}
          />
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setPinnedMenuId(null)}
            style={styles.infoPanelContainer}
          >
            {/* Header */}
            <View style={styles.infoPanelHeader}>
              <TouchableOpacity onPress={() => setShowInfoPanel(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoPanelContent}>
              {/* Nhắc hẹn sắp tới */}
              <View style={styles.infoPanelSection}>
                <Text style={styles.infoPanelSectionTitle}>Nhắc hẹn sắp tới</Text>
                <View style={styles.infoPanelEmptyBox}>
                  <Text style={styles.infoPanelEmptyText}>Chưa có nhắc hẹn nào</Text>
                </View>
              </View>

              {/* Danh sách ghim */}
              <View style={styles.infoPanelSection}>
                <Text style={styles.infoPanelSectionTitle}>Danh sách ghim</Text>
                {pinnedMessages.length === 0 ? (
                  <View style={styles.infoPanelEmptyBox}>
                    <Text style={styles.infoPanelEmptyText}>Chưa có tin nhắn ghim</Text>
                  </View>
                ) : (
                  <View style={styles.pinnedListInPanel}>
                    {pinnedMessages.map((item, idx) => (
                      <View key={item.messageID || item.tempID} style={styles.pinnedItemInPanel}>
                        <TouchableOpacity
                          style={styles.pinnedItemContent}
                          onPress={() => {
                            scrollToMessage(item.messageID);
                            setShowInfoPanel(false);
                          }}
                        >
                          <Ionicons name="chatbox-outline" size={20} color="#0e9de8" />
                          <View style={styles.pinnedItemTextContainer}>
                            <Text style={styles.pinnedItemSender}>
                              {item.senderInfo?.name || "Unknown"}
                            </Text>
                            <Text style={styles.pinnedItemContent2} numberOfLines={2}>
                              {item.content || "Media"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      
                          <TouchableOpacity
                          style={styles.pinnedItemMenuBtn}
                          onPress={() => setPinnedMenuId(pinnedMenuId === item.messageID ? null : item.messageID || null)}
                        >
                          <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
                        </TouchableOpacity>

                        {/* Dropdown menu */}
                        {pinnedMenuId === item.messageID && (
                          <View style={[
                            styles.pinnedItemDropdown,
                            idx >= pinnedMessages.length - 1 && styles.pinnedItemDropdownTop
                          ]}>
                            <TouchableOpacity
                              style={styles.pinnedItemDropdownItem}
                              onPress={() => handleMoveToTop(item)}
                            >
                              <Ionicons name="arrow-up-outline" size={18} color="#333" />
                              <Text style={styles.pinnedItemDropdownText}>Đưa lên đầu</Text>
                            </TouchableOpacity>
                            
                            {(item.type === "text" || item.type === "emoji") && (
                              <TouchableOpacity
                                style={styles.pinnedItemDropdownItem}
                                onPress={() => handleCopyPinned(item)}
                              >
                                <Ionicons name="copy-outline" size={18} color="#333" />
                                <Text style={styles.pinnedItemDropdownText}>Sao chép</Text>
                              </TouchableOpacity>
                            )}
                            
                            <TouchableOpacity
                              style={styles.pinnedItemDropdownItem}
                              onPress={() => handleUnpinFromMenu(item)}
                            >
                              <Ionicons name="close-circle-outline" size={18} color="#f44336" />
                              <Text style={[styles.pinnedItemDropdownText, { color: "#f44336" }]}>Bỏ ghim</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Footer buttons */}
            <View style={styles.infoPanelFooter}>
              <TouchableOpacity style={styles.infoPanelFooterBtn}>
                <Ionicons name="create-outline" size={20} color="#333" />
                <Text style={styles.infoPanelFooterBtnText}>Chỉnh sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.infoPanelFooterBtn}
                onPress={() => {
                  setShowInfoPanel(false);
                  setPinnedMenuId(null);
                }}
              >
                <Ionicons name="arrow-up-outline" size={20} color="#333" />
                <Text style={styles.infoPanelFooterBtnText}>Thu gọn</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) =>
          item.messageID || item.tempID || Math.random().toString()
        }
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          });
        }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => handleLongPress(item)}
            delayLongPress={500}
            style={[
              styles.messageContainer,
              item.senderID === user?.userID
                ? styles.messageMine
                : styles.messageOther,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                item.senderID === user?.userID
                  ? styles.bubbleMine
                  : styles.bubbleOther,
                item.pinnedInfo && styles.bubblePinned,
              ]}
            >
              {item.pinnedInfo && (
                <View style={styles.pinnedIndicator}>
                  <Text style={styles.pinnedIndicatorText}>📌 Đã ghim</Text>
                </View>
              )}
              <Text style={styles.messageText}>{item.content}</Text>
              <Text style={styles.messageTime}>
                {new Date(item.timestamp).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn..."
          value={inputText}
          onChangeText={setInputText}
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendBtnText}>Gửi</Text>
        </TouchableOpacity>
      </View>

      {/* Long-press Menu */}
      <Modal
        transparent
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuBox}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handlePinMessage(selectedMessage!)}
            >
              <Text style={styles.menuItemText}>
                {selectedMessage?.pinnedInfo ? "📌 Bỏ ghim" : "📌 Ghim tin nhắn"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleDeleteLocal(selectedMessage!)}
            >
              <Text style={styles.menuItemText}>🗑️ Xóa phía tôi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleForwardMessage(selectedMessage!)}
            >
              <Text style={styles.menuItemText}>↗️ Chuyển tiếp</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  /* Chat List */
  chatListContainer: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  lastMessage: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },

  /* Chat Screen */
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0e9de8",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  chatTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
  },
  menuButton: {
    padding: 4,
  },

  /* Messages */
  messageContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
  },
  messageMine: {
    justifyContent: "flex-end",
  },
  messageOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bubbleMine: {
    backgroundColor: "#0e9de8",
  },
  bubbleOther: {
    backgroundColor: "#e0e0e0",
  },
  bubblePinned: {
    borderWidth: 2,
    borderColor: "#0e9de8",
  },
  pinnedIndicator: {
    marginBottom: 4,
  },
  pinnedIndicatorText: {
    fontSize: 11,
    color: "#0e9de8",
    fontWeight: "600",
  },
  messageText: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  messageTime: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },

  /* Input */
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1a1a1a",
  },
  sendBtn: {
    backgroundColor: "#0e9de8",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  /* Menu */
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 200,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuItemText: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "500",
  },

  /* Info Panel */
  infoPanelOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  infoPanelBackdrop: {
    flex: 1,
  },
  infoPanelContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    overflow: "hidden",
  },
  infoPanelHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoPanelContent: {
    flex: 1,
  },
  infoPanelSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 8,
    borderBottomColor: "#f5f5f5",
  },
  infoPanelSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  infoPanelEmptyBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    paddingVertical: 24,
    alignItems: "center",
  },
  infoPanelEmptyText: {
    fontSize: 14,
    color: "#999",
  },
  pinnedListInPanel: {
    gap: 8,
  },
  pinnedItemInPanel: {
    position: "relative",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
  },
  pinnedItemContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    paddingRight: 30,
  },
  pinnedItemTextContainer: {
    flex: 1,
  },
  pinnedItemSender: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0e9de8",
    marginBottom: 4,
  },
  pinnedItemContent2: {
    fontSize: 13,
    color: "#424242",
  },
  pinnedItemMenuBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  pinnedItemDropdown: {
    position: "absolute",
    top: 40,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 160,
    zIndex: 1000,
  },
  pinnedItemDropdownTop: {
    top: "auto",
    bottom: 40,
  },
  pinnedItemDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  pinnedItemDropdownText: {
    fontSize: 14,
    color: "#333",
  },
  infoPanelFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  infoPanelFooterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: "#eee",
  },
  infoPanelFooterBtnText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
});

export default ChatScreen;
