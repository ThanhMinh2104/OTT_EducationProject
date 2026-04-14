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

type Props = { navigation: StackNavigationProp<RootStackParamList, "Chat"> };

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

const ChatScreen = ({ navigation }: Props) => {
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

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("user");
      if (!stored) {
        navigation.replace("Login");
        return;
      }
      const u = JSON.parse(stored);
      setUser(u);
      socket.emit("join_user", u.userID);
      socket.emit("getChat", u.userID);
    })();

    socket.on("ChatByUserID", (data: Chat[]) => {
      setChats(data);
    });

    socket.on("new_message", (msg: Message) => {
      if (selectedChat && msg.chatID === selectedChat.chatID) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.off("ChatByUserID");
      socket.off("new_message");
    };
  }, [navigation, selectedChat?.chatID]);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMessages(chat.lastMessage || []);
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
    setSelectedMessage(msg);
    setShowMenu(true);
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
        <TouchableOpacity onPress={() => setSelectedChat(null)}>
          <Text style={styles.backBtn}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.chatTitle}>{selectedChat.name}</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) =>
          item.messageID || item.tempID || Math.random().toString()
        }
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
              ]}
            >
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
});

export default ChatScreen;
