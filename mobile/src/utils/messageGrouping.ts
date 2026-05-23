// Utility functions for grouping image messages

export interface Message {
  messageID?: string;
  tempID?: string;
  _id?: string;
  chatID: string;
  senderID: string;
  type: string;
  timestamp: string | Date;
  media_url?: string[];
  groupId?: string;
  content?: string;
  status?: string;
  senderInfo?: { name: string; avatar?: string | null };
  pinnedInfo?: { pinnedBy?: string; pinnedAt?: string } | null;
  replyTo?: any;
  [key: string]: any;
}

export interface MessageGroup {
  groupId: string;
  messages: Message[];
  senderID: string;
  timestamp: Date;
}

/**
 * Group image messages that share the same groupId.
 * Collects ALL messages with the same groupId regardless of order,
 * then inserts the group at the position of the FIRST message in that group.
 */
export function groupMessages(messages: Message[]): (Message | MessageGroup)[] {
  // 1. Collect all messages per groupId - chỉ group messages có media_url hợp lệ
  const groupMap = new Map<string, Message[]>();
  for (const msg of messages) {
    if (msg.type === 'image' && msg.groupId && msg.media_url && msg.media_url.length > 0) {
      if (!groupMap.has(msg.groupId)) groupMap.set(msg.groupId, []);
      groupMap.get(msg.groupId)!.push(msg);
    }
  }

  const result: (Message | MessageGroup)[] = [];
  const insertedGroups = new Set<string>();

  for (const msg of messages) {
    if (msg.type === 'image' && msg.groupId) {
      const gid = msg.groupId;
      // Nếu message này không có media_url (optimistic chưa upload xong), render riêng
      if (!msg.media_url || msg.media_url.length === 0) {
        result.push(msg);
        continue;
      }
      if (insertedGroups.has(gid)) continue; // already inserted as group
      insertedGroups.add(gid);
      const groupMsgs = groupMap.get(gid)!;
      // Sort by timestamp to keep order consistent
      groupMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      result.push(createGroup(groupMsgs));
    } else {
      result.push(msg);
    }
  }

  return result;
}

function createGroup(messages: Message[]): Message | MessageGroup {
  // Single image without groupId sibling → render as plain message
  if (messages.length === 1) {
    return messages[0];
  }

  const firstMsg = messages[0];
  return {
    groupId: firstMsg.groupId || `group_${firstMsg.messageID || firstMsg.tempID || Date.now()}`,
    messages,
    senderID: firstMsg.senderID,
    timestamp: new Date(firstMsg.timestamp),
  };
}

/**
 * Check if item is a message group
 */
export function isMessageGroup(item: Message | MessageGroup): item is MessageGroup {
  return 'messages' in item && Array.isArray((item as MessageGroup).messages);
}

/**
 * Get layout for image grid based on count
 */
export function getImageGridLayout(count: number): {
  rows: number;
  cols: number;
  maxDisplay: number;
} {
  if (count === 1) return { rows: 1, cols: 1, maxDisplay: 1 };
  if (count === 2) return { rows: 1, cols: 2, maxDisplay: 2 };
  if (count === 3) return { rows: 2, cols: 2, maxDisplay: 3 };
  if (count === 4) return { rows: 2, cols: 2, maxDisplay: 4 };
  return { rows: 2, cols: 2, maxDisplay: 4 };
}
