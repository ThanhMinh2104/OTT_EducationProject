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
import { io } from "socket.io-client";
import { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { RootStackParamList } from "../navigation/AppNavigator";
import { API_URL } from "../utils/config";
import StickerEmojiPicker from "../components/StickerEmojiPicker";
import AudioPlayer from "../components/AudioPlayer";

const socket = io(API_URL);

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "ChatEnhanced">;
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

const ChatScreenEnhanced = ({ navigation }: Props) => {
  const [user, setUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      await uploadFiles(
        result.assets.map((a) => ({
          uri: a.uri,
          type: "image",
          name: a.fileName || "image.jpg",
        })),
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
        const msgType = files[0].type === "image" ? "image" : "file";
        const msg: Message = {
          tempID: Date.now().toString(),
          chatID: selectedChat.chatID,
          senderID: user.userID,
          content: msgType === "file" ? files[0].name || "" : "",
          type: msgType,
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

  const renderMessage = (item: Message) => {
    const isMine = item.senderID === user?.userID;

    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        style={[
          styles.messageContainer,
          isMine ? styles.messageMine : styles.messageOther,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.bubbleMine : styles.bubbleOther,
          ]}
        >
          {/* Image */}
          {item.type === "image" &&
            item.media_url &&
            item.media_url.length > 0 && (
              <View style={styles.imageContainer}>
                {item.media_url.map((url, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: url }}
                    style={styles.messageImage}
                  />
                ))}
              </View>
            )}

          {/* Sticker */}
          {item.type === "sticker" && item.media_url && item.media_url[0] && (
            <Image
              source={{ uri: item.media_url[0] }}
              style={styles.stickerImage}
            />
          )}

          {/* GIF */}
          {item.type === "gif" && item.media_url && item.media_url[0] && (
            <Image
              source={{ uri: item.media_url[0] }}
              style={styles.gifImage}
            />
          )}

          {/* Audio */}
          {item.type === "audio" && item.media_url && item.media_url[0] && (
            <AudioPlayer audioUrl={item.media_url[0]} isMine={isMine} />
          )}

          {/* File */}
          {item.type === "file" && item.media_url && item.media_url[0] && (
            <View style={styles.fileContainer}>
              <Text style={[styles.fileName, isMine && styles.fileNameMine]}>
                📎 {item.content || "File"}
              </Text>
              <TouchableOpacity onPress={() => {}}>
                <Text
                  style={[
                    styles.fileDownload,
                    isMine && styles.fileDownloadMine,
                  ]}
                >
                  Tải xuống
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Text */}
          {item.type === "text" && item.content && (
            <Text
              style={[
                styles.messageText,
                isMine ? styles.textMine : styles.textOther,
              ]}
            >
              {item.content}
            </Text>
          )}

          <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>
            {new Date(item.timestamp).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!selectedChat) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.listHeader}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm"
              placeholderTextColor="#65676b"
            />
          </View>
          <TouchableOpacity style={styles.headerIcon}>
            <Text style={styles.headerIconText}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Text style={styles.headerIconText}>➕</Text>
          </TouchableOpacity>
        </View>

        {/* Chat List */}
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
                  uri: item.avatar || "https://via.placeholder.com/52",
                }}
                style={styles.chatAvatar}
              />
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.chatTime}>2 phút</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage?.[0]?.content || "Chưa có tin nhắn"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setSelectedChat(null)}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Image
          source={{
            uri: selectedChat.avatar || "https://via.placeholder.com/36",
          }}
          style={styles.headerAvatar}
        />
        <Text style={styles.chatTitle} numberOfLines={1}>
          {selectedChat.name}
        </Text>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Text style={styles.headerIconText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Text style={styles.headerIconText}>📹</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) =>
          item.messageID || item.tempID || Math.random().toString()
        }
        renderItem={({ item }) => renderMessage(item)}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Emoji Picker */}
      {showEmoji && (
        <StickerEmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onStickerSelect={handleStickerSelect}
          onGifSelect={handleGifSelect}
        />
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowEmoji(!showEmoji)}
        >
          <Text style={styles.iconText}>😀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
          <Text style={styles.iconText}>🖼️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handlePickFile}>
          <Text style={styles.iconText}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Tin nhắn"
          value={inputText}
          onChangeText={setInputText}
          placeholderTextColor="#65676b"
          multiline
        />
        {inputText.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconBtn}>
            <Text style={styles.iconText}>👍</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0091ff" />
          <Text style={styles.loadingText}>Đang tải lên...</Text>
        </View>
      )}

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
    backgroundColor: "#fff",
  },
  listHeader: {
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
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#050505",
    flex: 1,
  },
  chatTime: {
    fontSize: 13,
    color: "#65676b",
  },
  lastMessage: {
    fontSize: 14,
    color: "#65676b",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0091ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    color: "#fff",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  chatTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    paddingVertical: 8,
  },
  messageContainer: {
    paddingHorizontal: 12,
    paddingVertical: 2,
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
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: "#0091ff",
  },
  bubbleOther: {
    backgroundColor: "#e4e6eb",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textMine: {
    color: "#fff",
  },
  textOther: {
    color: "#050505",
  },
  messageTime: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  messageTimeMine: {
    color: "rgba(255,255,255,0.7)",
  },
  imageContainer: {
    gap: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    resizeMode: "cover",
  },
  stickerImage: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },
  gifImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    resizeMode: "cover",
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fileName: {
    fontSize: 14,
    color: "#050505",
    flex: 1,
  },
  fileNameMine: {
    color: "#fff",
  },
  fileDownload: {
    fontSize: 12,
    color: "#0091ff",
    fontWeight: "600",
  },
  fileDownloadMine: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#e4e6eb",
  },
  iconBtn: {
    padding: 6,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: "#050505",
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0091ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    fontSize: 18,
    color: "#fff",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
  },
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
    color: "#050505",
    fontWeight: "500",
  },
});

export default ChatScreenEnhanced;
