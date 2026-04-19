import { Server, Socket } from 'socket.io';
import GroupMessage from '../models/GroupMessage';
import Users from '../models/User';
import { v4 as uuidv4 } from 'uuid';

interface UserInfo {
  name: string;
  avatar?: string;
}

interface GroupCallSession {
  callerID: string;
  callerInfo: UserInfo;
  participants: Set<string>;       // đang trong call (đã accept)
  invitedUsers: Set<string>;       // tất cả người được mời
  userInfoMap: Map<string, UserInfo>; // userID -> info (để gửi cho callee)
}

const activeGroupCalls = new Map<string, GroupCallSession>();

export const registerGroupCallEvents = (io: Server, socket: Socket) => {

  socket.on('group-call-start', async (data: {
    groupID: string;
    callerID: string;
    callerInfo: UserInfo;
    invitedUserIDs: string[];
    invitedUserInfos?: { userID: string; name: string; avatar?: string }[]; // info của người được mời
    groupName: string;
  }) => {
    const { groupID, callerID, callerInfo, invitedUserIDs, invitedUserInfos, groupName } = data;

    const userInfoMap = new Map<string, UserInfo>();
    userInfoMap.set(callerID, callerInfo);
    // Lưu info của những người được mời nếu caller gửi kèm
    (invitedUserInfos || []).forEach(u => userInfoMap.set(u.userID, { name: u.name, avatar: u.avatar }));

    const session: GroupCallSession = {
      callerID,
      callerInfo,
      participants: new Set([callerID]),
      invitedUsers: new Set(invitedUserIDs),
      userInfoMap,
    };
    activeGroupCalls.set(groupID, session);

    console.log(`📞 Group call started by ${callerID} in ${groupID}, inviting: ${invitedUserIDs.join(', ')}`);

    // Gửi tin nhắn "Cuộc gọi nhóm" vào chat
    try {
      const caller = await Users.findOne({ userID: callerID });
      const callMsg = new GroupMessage({
        messageID: `gcall_${uuidv4()}`,
        groupID,
        senderID: callerID,
        content: groupID, // lưu groupID để frontend dùng join lại
        type: 'group-call',
        timestamp: new Date(),
        media_url: [],
        status: 'sent',
        senderInfo: { name: caller?.name || 'Người dùng', avatar: caller?.anhDaiDien || null },
      });
      await callMsg.save();
      io.to(groupID).emit('new_group_message', {
        ...callMsg.toObject(),
        senderInfo: { name: caller?.name || 'Người dùng', avatar: caller?.anhDaiDien || null },
      });
    } catch (e) {
      console.error('Error saving group call message:', e);
    }

    invitedUserIDs.forEach(uid => {
      io.to(uid).emit('group-call-incoming', {
        groupID,
        callerID,
        callerInfo,
        groupName,
        invitedUserIDs,
        // Gửi kèm info của tất cả người được mời để callee hiển thị tiles
        allMemberInfos: [
          { userID: callerID, ...callerInfo },
          ...(invitedUserInfos || []),
        ],
      });
    });
  });

  socket.on('group-call-accept', (data: {
    groupID: string;
    userID: string;
    userInfo: UserInfo;
  }) => {
    const { groupID, userID, userInfo } = data;
    const session = activeGroupCalls.get(groupID);
    if (!session) {
      socket.emit('group-call-ended', { groupID, reason: 'Cuộc gọi đã kết thúc' });
      return;
    }

    // Lưu info của người mới accept
    session.userInfoMap.set(userID, userInfo);
    session.participants.add(userID);
    console.log(`✅ ${userID} accepted group call in ${groupID}`);

    // Gửi cho người mới: danh sách participants đang trong call + tất cả invited (để hiển thị tiles)
    const participantList = Array.from(session.participants)
      .filter(id => id !== userID)
      .map(id => ({ userID: id, ...(session.userInfoMap.get(id) || { name: id }) }));

    const invitedList = Array.from(session.invitedUsers)
      .filter(id => id !== userID && !session.participants.has(id))
      .map(id => ({ userID: id, ...(session.userInfoMap.get(id) || { name: id }) }));

    socket.emit('group-call-session-info', {
      groupID,
      participants: participantList,   // đang trong call → tạo WebRTC offer
      ringing: invitedList,            // chưa bắt máy → hiển thị tile "đang đổ chuông"
    });

    // Thông báo cho tất cả participants hiện tại
    session.participants.forEach(pid => {
      if (pid !== userID) {
        io.to(pid).emit('group-call-user-joined', { groupID, userID, userInfo });
      }
    });
  });

  socket.on('group-call-reject', (data: { groupID: string; userID: string }) => {
    const { groupID, userID } = data;
    const session = activeGroupCalls.get(groupID);
    if (!session) return;
    session.invitedUsers.delete(userID);
    console.log(`❌ ${userID} rejected group call in ${groupID}`);
    // Thông báo tất cả participants
    session.participants.forEach(pid => {
      io.to(pid).emit('group-call-user-rejected', { groupID, userID });
    });
  });

  socket.on('group-call-offer', (data: { groupID: string; to: string; from: string; offer: any; userInfo: UserInfo }) => {
    io.to(data.to).emit('group-call-offer', { groupID: data.groupID, from: data.from, offer: data.offer, userInfo: data.userInfo });
  });

  socket.on('group-call-answer', (data: { groupID: string; to: string; from: string; answer: any }) => {
    io.to(data.to).emit('group-call-answer', { groupID: data.groupID, from: data.from, answer: data.answer });
  });

  socket.on('group-call-ice', (data: { groupID: string; to: string; from: string; candidate: any }) => {
    io.to(data.to).emit('group-call-ice', { groupID: data.groupID, from: data.from, candidate: data.candidate });
  });

  // Check xem call còn active không (dùng callback)
  socket.on('group-call-check', (data: { groupID: string }, callback: (active: boolean) => void) => {
    const session = activeGroupCalls.get(data.groupID);
    callback(!!session && session.participants.size > 0);
  });

  socket.on('group-call-leave', (data: { groupID: string; userID: string }) => {
    const { groupID, userID } = data;
    const session = activeGroupCalls.get(groupID);
    if (!session) return;

    session.participants.delete(userID);
    session.invitedUsers.delete(userID);
    console.log(`📴 ${userID} left group call in ${groupID}, remaining: ${session.participants.size}`);

    session.participants.forEach(pid => {
      io.to(pid).emit('group-call-user-left', { groupID, userID });
    });

    if (session.callerID === userID || session.participants.size === 0) {
      session.participants.forEach(pid => {
        io.to(pid).emit('group-call-ended', { groupID });
      });
      // Thông báo cho người đang đổ chuông
      session.invitedUsers.forEach(uid => {
        io.to(uid).emit('group-call-ended', { groupID });
      });
      activeGroupCalls.delete(groupID);
      console.log(`🔚 Group call ended in ${groupID}`);
    }
  });
};
