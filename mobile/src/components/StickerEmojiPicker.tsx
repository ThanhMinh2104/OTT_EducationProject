import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
} from "react-native";

interface Props {
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (url: string) => void;
  onGifSelect: (url: string) => void;
}

const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "🤣",
  "😂",
  "🙂",
  "🙃",
  "😉",
  "😊",
  "😇",
  "🥰",
  "😍",
  "🤩",
  "😘",
  "😗",
  "😚",
  "😙",
  "😋",
  "😛",
  "😜",
  "🤪",
  "😝",
  "🤑",
  "🤗",
  "🤭",
  "🤫",
  "🤔",
  "🤐",
  "🤨",
  "😐",
  "😑",
  "😶",
  "😏",
  "😒",
  "🙄",
  "😬",
  "🤥",
  "😌",
  "😔",
  "😪",
  "🤤",
  "😴",
  "😷",
  "🤒",
  "🤕",
  "🤢",
  "🤮",
  "🤧",
  "🥵",
  "🥶",
  "😶‍🌫️",
  "😵",
  "🤯",
  "🤠",
  "🥳",
  "😎",
  "🤓",
  "🧐",
  "😕",
  "😟",
  "🙁",
  "☹️",
  "😮",
  "😯",
  "😲",
  "😳",
  "🥺",
  "😦",
  "😧",
  "😨",
  "😰",
  "😥",
  "😢",
  "😭",
  "😱",
  "😖",
  "😣",
  "😞",
  "😓",
  "😩",
  "😫",
  "🥱",
  "😤",
  "😡",
  "😠",
  "🤬",
  "😈",
  "👿",
  "💀",
  "☠️",
  "💩",
  "🤡",
  "👹",
  "👺",
  "👻",
  "👽",
  "👾",
  "🤖",
  "😺",
  "😸",
  "😹",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "👍",
  "👎",
  "👌",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "🤙",
  "👏",
  "🙌",
  "👐",
  "🤲",
  "🤝",
  "🙏",
  "✍️",
  "💪",
];

const STICKERS = [
  "https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=47897&size=130&checksum=e5e6e7e8e9eaebec",
  "https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=47898&size=130&checksum=e5e6e7e8e9eaebec",
  "https://zalo-api.zadn.vn/api/emoticon/sticker/webpc?eid=47899&size=130&checksum=e5e6e7e8e9eaebec",
];

const GIFS = [
  "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
  "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
  "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif",
];

const StickerEmojiPicker = ({
  onEmojiSelect,
  onStickerSelect,
  onGifSelect,
}: Props) => {
  const [tab, setTab] = useState<"emoji" | "sticker" | "gif">("emoji");

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "emoji" && styles.tabActive]}
          onPress={() => setTab("emoji")}
        >
          <Text style={styles.tabText}>😀</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "sticker" && styles.tabActive]}
          onPress={() => setTab("sticker")}
        >
          <Text style={styles.tabText}>🎨</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "gif" && styles.tabActive]}
          onPress={() => setTab("gif")}
        >
          <Text style={styles.tabText}>GIF</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {tab === "emoji" && (
          <View style={styles.emojiGrid}>
            {EMOJIS.map((emoji, i) => (
              <TouchableOpacity
                key={i}
                style={styles.emojiItem}
                onPress={() => onEmojiSelect(emoji)}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {tab === "sticker" && (
          <View style={styles.stickerGrid}>
            {STICKERS.map((url, i) => (
              <TouchableOpacity
                key={i}
                style={styles.stickerItem}
                onPress={() => onStickerSelect(url)}
              >
                <Image source={{ uri: url }} style={styles.stickerImage} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {tab === "gif" && (
          <View style={styles.gifGrid}>
            {GIFS.map((url, i) => (
              <TouchableOpacity
                key={i}
                style={styles.gifItem}
                onPress={() => onGifSelect(url)}
              >
                <Image source={{ uri: url }} style={styles.gifImage} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 250,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#0e9de8",
  },
  tabText: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  emojiItem: {
    width: "12.5%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 24,
  },
  stickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  stickerItem: {
    width: "33.33%",
    aspectRatio: 1,
    padding: 4,
  },
  stickerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  gifGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  gifItem: {
    width: "50%",
    aspectRatio: 1,
    padding: 4,
  },
  gifImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderRadius: 8,
  },
});

export default StickerEmojiPicker;
