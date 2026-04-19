import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GroupCallModal from '../components/GroupCallModal';

interface CallData {
  user: { userID: string; name: string; anhDaiDien?: string };
  groupName: string;
  groupAvatar?: string;
  isCallee: boolean;
  initialWithVideo: boolean;
  initialParticipants: { userID: string; name: string; avatar?: string }[];
  members: { userID: string; name: string; avatar?: string }[];
}

const GroupCallPage = () => {
  const { groupID } = useParams<{ groupID: string }>();
  const [callData, setCallData] = useState<CallData | null>(null);

  useEffect(() => {
    if (!groupID) return;
    const raw = localStorage.getItem(`group_call_${groupID}`);
    if (raw) {
      try {
        setCallData(JSON.parse(raw));
      } catch { /* ignore */ }
    }

    // Lắng nghe update từ tab chính (nếu data chưa có ngay)
    const bc = new BroadcastChannel(`group_call_${groupID}`);
    bc.onmessage = (e) => {
      if (e.data?.type === 'call_data') setCallData(e.data.payload);
    };
    return () => bc.close();
  }, [groupID]);

  if (!callData || !groupID) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <p className="text-white text-sm">Đang tải...</p>
      </div>
    );
  }

  return (
    <GroupCallModal
      user={callData.user}
      groupID={groupID}
      groupName={callData.groupName}
      groupAvatar={callData.groupAvatar}
      members={callData.members}
      isCallee={callData.isCallee}
      initialWithVideo={callData.initialWithVideo}
      initialParticipants={callData.initialParticipants}
      onClose={() => window.close()}
    />
  );
};

export default GroupCallPage;
