import React, { useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Platform,
} from 'react-native';

interface Member {
  userID: string;
  name: string;
}

interface Props extends Omit<TextInputProps, 'style'> {
  value: string;
  members: Member[];
  currentUserID: string;
}

type Seg = { text: string; isMention: boolean };

// Escape regex special chars — viet thang, khong dung replace voi string literal
function escapeRegex(str: string): string {
  return str.split('').map(c => {
    if ('[-[\\]{}()*+?.^$|]'.includes(c)) return '\\' + c;
    return c;
  }).join('');
}

function parseSegments(text: string, members: Member[], myID: string): Seg[] {
  if (!text) return [];

  const specials = ['All', 'GIF', 'STICKER', 'Bot'];
  const names = members
    .filter(m => m.userID !== myID && m.name)
    .map(m => m.name)
    .sort((a, b) => b.length - a.length);

  const allNames = [...specials, ...names];
  if (!allNames.length) return [{ text, isMention: false }];

  const pattern = allNames.map(escapeRegex).join('|');
  const re = new RegExp('(@(?:' + pattern + '))', 'gi');
  const parts = text.split(re).filter(p => p.length > 0);

  return parts.map(part => {
    if (part.startsWith('@')) {
      const candidate = part.slice(1).toLowerCase();
      const isSpecial = specials.some(s => s.toLowerCase() === candidate);
      const isMember = members.some(m => m.name.toLowerCase() === candidate);
      if (isSpecial || isMember) return { text: part, isMention: true };
    }
    return { text: part, isMention: false };
  });
}

const FONT_SIZE = 15;
const LINE_HEIGHT = 20;
const PAD_H = 14;
const PAD_V = Platform.OS === 'ios' ? 10 : 8;

const HighlightedTextInput: React.FC<Props> = ({
  value,
  members,
  currentUserID,
  placeholder,
  placeholderTextColor,
  ...rest
}) => {
  const inputRef = useRef<TextInput>(null);
  const segs = parseSegments(value, members, currentUserID);
  const hasMention = segs.some(s => s.isMention);

  // Hien placeholder khi value chi la lenh dac biet chua co keyword
  const SPECIAL_CMDS = ['@sticker', '@gif', '@bot'];
  const lowerVal = value.trim().toLowerCase();
  const isSpecialOnly = SPECIAL_CMDS.some(cmd => lowerVal === cmd);

  return (
    <View style={styles.wrapper}>
      {/* Overlay highlight — hien khi co mention hoac lenh dac biet */}
      {(hasMention || isSpecialOnly) && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText} numberOfLines={3}>
            {segs.map((seg, i) =>
              seg.isMention
                ? <Text key={i} style={styles.mention}>{seg.text}</Text>
                : <Text key={i}>{seg.text}</Text>
            )}
            {isSpecialOnly && (
              <Text style={styles.placeholderOverlay}> {placeholder}</Text>
            )}
          </Text>
        </View>
      )}

      <TextInput
        ref={inputRef}
        {...rest}
        value={value}
        placeholder={!value ? placeholder : undefined}
        placeholderTextColor={placeholderTextColor}
        style={[styles.input, (hasMention || isSpecialOnly) && { color: 'transparent' }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    maxHeight: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: PAD_H,
    paddingVertical: PAD_V,
    justifyContent: 'flex-start',
  },
  overlayText: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: '#111',
  },
  mention: {
    color: '#0068ff',
  },
  placeholderOverlay: {
    color: '#aaa',
  },
  input: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: '#111',
    paddingHorizontal: PAD_H,
    paddingVertical: PAD_V,
    maxHeight: 100,
    backgroundColor: 'transparent',
  },
});

export default HighlightedTextInput;
