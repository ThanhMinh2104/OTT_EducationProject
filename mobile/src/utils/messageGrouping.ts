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
 * Group image messages that were sent together (same groupId)
 */
export function groupMessages(messages: Message[]): (Message | MessageGroup)[] {
  const result: (Message | MessageGroup)[] = [];
  const groupMap = new Map<string, Message[]>();

  for (const msg of messages) {
    // Chỉ group các ảnh có groupId (được gửi cùng lúc)
    if (msg.type === 'image' && msg.groupId) {
      if (!groupMap.has(msg.groupId)) {
        groupMap.set(msg.groupId, []);
      }
      groupMap.get(msg.groupId)!.push(msg);
    } else {
      // Flush các groups đã tích lũy trước message này
      for (const [groupId, groupMessages] of groupMap.entries()) {
        result.push(createGroup(groupMessages));
      }
      groupMap.clear();
      
      // Thêm message đơn lẻ
      result.push(msg);
    }
  }

  // Flush các groups còn lại
  for (const [groupId, groupMessages] of groupMap.entries()) {
    result.push(createGroup(groupMessages));
  }

  return result;
}

function createGroup(messages: Message[]): MessageGroup {
  // Nếu chỉ có 1 ảnh, trả về message đơn lẻ
  if (messages.length === 1) {
    return messages[0] as any;
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
  if (count === 3) return { rows: 2, cols: 2, maxDisplay: 3 }; // 1 lớn + 2 nhỏ
  if (count === 4) return { rows: 2, cols: 2, maxDisplay: 4 };
  return { rows: 2, cols: 2, maxDisplay: 4 }; // 4 ảnh + overlay "+X"
}
