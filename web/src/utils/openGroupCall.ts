interface CallData {
  user: { userID: string; name: string; anhDaiDien?: string };
  groupName: string;
  groupAvatar?: string;
  isCallee: boolean;
  initialWithVideo: boolean;
  initialParticipants: { userID: string; name: string; avatar?: string }[];
  members: { userID: string; name: string; avatar?: string }[];
}

export const openGroupCallWindow = (groupID: string, data: CallData) => {
  // Lưu data vào localStorage để tab mới đọc
  localStorage.setItem(`group_call_${groupID}`, JSON.stringify(data));

  // Gửi qua BroadcastChannel phòng tab đã mở rồi
  try {
    const bc = new BroadcastChannel(`group_call_${groupID}`);
    bc.postMessage({ type: 'call_data', payload: data });
    bc.close();
  } catch { /* ignore */ }

  const w = 900;
  const h = 600;
  const left = Math.round((screen.width - w) / 2);
  const top = Math.round((screen.height - h) / 2);

  const win = window.open(
    `/group-call/${groupID}`,
    `group_call_${groupID}`,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes`
  );

  return win;
};
