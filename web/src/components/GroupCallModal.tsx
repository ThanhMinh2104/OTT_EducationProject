import { useState, useEffect, useRef } from 'react';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaUsers,
  FaTimes,
  FaSearch,
  FaCheck,
  FaUserPlus,
} from 'react-icons/fa';
import socket from '../utils/socket';

interface GroupMember {
  userID: string;
  name: string;
  avatar?: string;
}

interface Participant {
  userID: string;
  name: string;
  avatar?: string;
  stream?: MediaStream;
  isMuted?: boolean;
  isVideoOff?: boolean;
  status: 'ringing' | 'connected' | 'rejected' | 'left';
}

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string };
  groupID: string;
  groupName: string;
  groupAvatar?: string;
  members: GroupMember[];
  isCallee?: boolean;
  initialWithVideo?: boolean;
  // Danh sách tất cả members trong call (để callee hiển thị tiles ngay)
  initialParticipants?: { userID: string; name: string; avatar?: string }[];
  onClose: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turns:openrelay.metered.ca:443',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// ── ParticipantTile ──────────────────────────────────────────────────────────
const ParticipantTile = ({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (participant.stream) {
      videoRef.current.srcObject = participant.stream;
      // Kiểm tra video tracks
      const checkVideo = () => {
        const tracks = participant.stream!.getVideoTracks();
        setHasVideo(tracks.length > 0 && tracks.some((t) => t.enabled && t.readyState !== 'ended'));
      };
      checkVideo();
      // Lắng nghe khi track thay đổi
      participant.stream.getVideoTracks().forEach((t) => {
        t.onended = checkVideo;
        t.onmute = checkVideo;
        t.onunmute = checkVideo;
      });
    } else {
      videoRef.current.srcObject = null;
      setHasVideo(false);
    }
  }, [participant.stream]);

  const showVideo = !participant.isVideoOff && hasVideo;

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center w-full h-full min-h-[140px]">
      {/* Luôn render video element, ẩn khi không có video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${showVideo ? 'block' : 'hidden'}`}
      />
      {/* Avatar overlay khi không có video */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
          <img
            src={
              participant.avatar ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.name}`
            }
            alt={participant.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
          />
          {participant.status === 'ringing' && (
            <p className="text-gray-400 text-xs animate-pulse">Đang đổ chuông...</p>
          )}
          {participant.status === 'rejected' && <p className="text-red-400 text-xs">Đã từ chối</p>}
          {participant.status === 'left' && <p className="text-gray-500 text-xs">Đã rời</p>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full z-10">
        {participant.isMuted && <FaMicrophoneSlash className="text-red-400 text-[10px]" />}
        <span className="text-white text-xs">{isLocal ? 'Bạn' : participant.name}</span>
      </div>
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────────────────────
type Screen = 'select' | 'calling' | 'in-call';

const GroupCallModal = ({
  user,
  groupID,
  groupName,
  groupAvatar,
  members,
  isCallee = false,
  initialWithVideo = true,
  initialParticipants = [],
  onClose,
}: Props) => {
  const [screen, setScreen] = useState<Screen>(isCallee ? 'in-call' : 'select');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GroupMember[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!initialWithVideo);
  const [callDuration, setCallDuration] = useState(0);
  const [endedMessage, setEndedMessage] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Drag state — phải khai báo ở đây, không được sau conditional return
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - 760), y: 60 });

  // Refs — không re-render khi thay đổi
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isActiveRef = useRef(true);
  const participantsRef = useRef<Participant[]>([]);
  const callStartedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, initX: 0, initY: 0 });

  // Sync participantsRef với state để dùng trong callbacks
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getLocalStream = async (withVideo: boolean): Promise<MediaStream> => {
    // Thử lấy video + audio
    if (withVideo) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        // Camera bị chiếm hoặc không có → thử với constraints lỏng hơn
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
          });
        } catch {
          // Fallback audio only
          setIsVideoOff(true);
        }
      }
    }
    // Audio only
    try {
      return await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
    } catch {
      return new MediaStream();
    }
  };

  const flushIceQueue = async (remoteID: string, pc: RTCPeerConnection) => {
    for (const c of iceQueuesRef.current.get(remoteID) ?? []) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* stale */
      }
    }
    iceQueuesRef.current.delete(remoteID);
  };

  // Tạo PC — localStreamRef.current phải có giá trị trước khi gọi hàm này
  const createPC = (remoteID: string): RTCPeerConnection => {
    // Đóng PC cũ nếu có
    pcsRef.current.get(remoteID)?.close();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && isActiveRef.current) {
        socket.emit('group-call-ice', {
          groupID,
          to: remoteID,
          from: user.userID,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      if (!isActiveRef.current) return;
      const stream = e.streams[0];
      if (!stream) return;
      // Luôn update stream, kể cả khi đã có (để refresh video)
      setParticipants((prev) => {
        const exists = prev.find((p) => p.userID === remoteID);
        if (exists) {
          return prev.map((p) =>
            p.userID === remoteID ? { ...p, stream, status: 'connected' } : p
          );
        }
        return [...prev, { userID: remoteID, name: remoteID, stream, status: 'connected' }];
      });
    };

    pc.onconnectionstatechange = () => {
      if (!isActiveRef.current) return;
      console.log(`🔗 PC ${remoteID} state: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        // Thử restart ICE thay vì báo lỗi ngay
        pc.restartIce();
      }
    };

    // Thêm local tracks — localStreamRef.current phải có giá trị lúc này
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        pc.addTrack(t, localStreamRef.current!);
      });
    }

    pcsRef.current.set(remoteID, pc);
    return pc;
  };

  // ── Socket setup (chỉ gọi 1 lần sau khi có local stream) ─────────────────

  const setupSocketListeners = () => {
    socket.off('group-call-user-joined');
    socket.off('group-call-offer');
    socket.off('group-call-answer');
    socket.off('group-call-ice');
    socket.off('group-call-user-rejected');
    socket.off('group-call-user-left');
    socket.off('group-call-ended');
    socket.off('group-call-session-info');

    const startTimer = () => {
      if (callStartedRef.current) {
        console.log('⏱️ Timer already started, skipping');
        return;
      }
      console.log('⏱️ Starting timer');

      // Clear interval cũ nếu có (safety check)
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      callStartedRef.current = true;
      timerRef.current = window.setInterval(() => setCallDuration((p) => p + 1), 1000);
    };

    // Người accept → caller tạo offer đến họ
    socket.on(
      'group-call-user-joined',
      async (data: {
        groupID: string;
        userID: string;
        userInfo: { name: string; avatar?: string };
      }) => {
        if (!isActiveRef.current || data.groupID !== groupID) return;
        startTimer();
        if (screen !== 'in-call') setScreen('in-call');

        setParticipants((prev) => {
          const exists = prev.find((p) => p.userID === data.userID);
          if (exists)
            return prev.map((p) =>
              p.userID === data.userID ? { ...p, status: 'connected' as const } : p
            );
          return [
            ...prev,
            {
              userID: data.userID,
              name: data.userInfo.name,
              avatar: data.userInfo.avatar,
              status: 'connected' as const,
            },
          ];
        });

        // Caller luôn tạo offer đến người mới join (caller là người khởi tạo)
        const pc = createPC(data.userID);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('group-call-offer', {
          groupID,
          to: data.userID,
          from: user.userID,
          offer,
          userInfo: { name: user.name, avatar: user.anhDaiDien },
        });
      }
    );

    // Nhận offer → tạo answer
    socket.on(
      'group-call-offer',
      async (data: {
        groupID: string;
        from: string;
        offer: RTCSessionDescriptionInit;
        userInfo: { name: string; avatar?: string };
      }) => {
        if (!isActiveRef.current || data.groupID !== groupID) return;

        setParticipants((prev) => {
          if (prev.find((p) => p.userID === data.from)) return prev;
          return [
            ...prev,
            {
              userID: data.from,
              name: data.userInfo.name,
              avatar: data.userInfo.avatar,
              status: 'connected' as const,
            },
          ];
        });

        let pc = pcsRef.current.get(data.from);
        // Nếu đang có PC với signalingState conflict → rollback (polite peer)
        if (pc && pc.signalingState !== 'stable') {
          // Ta là polite peer nếu userID ta > userID remote (lexicographic)
          const isPolite = user.userID > data.from;
          if (isPolite) {
            await pc.setLocalDescription({ type: 'rollback' });
          } else {
            // Không polite → bỏ qua offer này, giữ offer của mình
            return;
          }
        }
        if (!pc) pc = createPC(data.from);

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushIceQueue(data.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('group-call-answer', { groupID, to: data.from, from: user.userID, answer });
      }
    );

    // Nhận answer
    socket.on(
      'group-call-answer',
      async (data: { groupID: string; from: string; answer: RTCSessionDescriptionInit }) => {
        if (!isActiveRef.current || data.groupID !== groupID) return;
        const pc = pcsRef.current.get(data.from);
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushIceQueue(data.from, pc);
        }
      }
    );

    // ICE candidate
    socket.on(
      'group-call-ice',
      async (data: { groupID: string; from: string; candidate: RTCIceCandidateInit }) => {
        if (!isActiveRef.current || data.groupID !== groupID) return;
        const pc = pcsRef.current.get(data.from);
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch {
            /* stale */
          }
        } else {
          const q = iceQueuesRef.current.get(data.from) ?? [];
          q.push(data.candidate);
          iceQueuesRef.current.set(data.from, q);
        }
      }
    );

    socket.on('group-call-user-rejected', (data: { groupID: string; userID: string }) => {
      if (data.groupID !== groupID) return;
      setParticipants((prev) =>
        prev.map((p) => (p.userID === data.userID ? { ...p, status: 'rejected' as const } : p))
      );
    });

    socket.on('group-call-user-left', (data: { groupID: string; userID: string }) => {
      if (data.groupID !== groupID) return;
      pcsRef.current.get(data.userID)?.close();
      pcsRef.current.delete(data.userID);
      setParticipants((prev) =>
        prev.map((p) =>
          p.userID === data.userID ? { ...p, status: 'left' as const, stream: undefined } : p
        )
      );
    });

    socket.on('group-call-ended', (data: { groupID: string; reason?: string }) => {
      console.log('🔚 Received group-call-ended:', data);
      if (data.groupID !== groupID) {
        console.log('  → Wrong groupID, ignoring');
        return;
      }
      console.log('  → Cleaning up and closing');
      doCleanup();
      const msg = data.reason || 'Cuộc gọi đã kết thúc';
      setEndedMessage(msg);
      setTimeout(() => onClose(), 2000);
    });

    // Danh sách participants khi callee accept — chỉ tạo offer đến người có userID nhỏ hơn
    // để tránh glare với caller (caller luôn tạo offer qua group-call-user-joined)
    socket.on(
      'group-call-session-info',
      async (data: {
        groupID: string;
        participants: { userID: string; name: string; avatar?: string }[];
        ringing: { userID: string; name: string; avatar?: string }[];
      }) => {
        if (!isActiveRef.current || data.groupID !== groupID) return;

        setParticipants((prev) => {
          const existing = new Set(prev.map((p) => p.userID));
          const updated = prev.map((p) => {
            if (data.participants.find((ip) => ip.userID === p.userID))
              return { ...p, status: 'connected' as const };
            return p;
          });
          const newPs = [...data.participants, ...data.ringing]
            .filter((p) => !existing.has(p.userID))
            .map((p) => ({
              userID: p.userID,
              name: p.name,
              avatar: p.avatar,
              status: data.participants.find((ip) => ip.userID === p.userID)
                ? ('connected' as const)
                : ('ringing' as const),
            }));
          return [...updated, ...newPs];
        });

        // Chỉ tạo offer đến người có userID < userID của mình (tránh glare)
        // Người có userID > sẽ nhận offer từ ta và trả answer
        for (const p of data.participants) {
          if (p.userID === user.userID) continue;
          // Nếu userID của ta nhỏ hơn → ta là impolite peer → tạo offer
          if (user.userID < p.userID) {
            const pc = createPC(p.userID);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('group-call-offer', {
              groupID,
              to: p.userID,
              from: user.userID,
              offer,
              userInfo: { name: user.name, avatar: user.anhDaiDien },
            });
          }
          // Nếu userID của ta lớn hơn → đợi offer từ họ (họ sẽ tạo offer đến ta)
        }
      }
    );
  };

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const doCleanup = () => {
    isActiveRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    socket.off('group-call-user-joined');
    socket.off('group-call-offer');
    socket.off('group-call-answer');
    socket.off('group-call-ice');
    socket.off('group-call-user-rejected');
    socket.off('group-call-user-left');
    socket.off('group-call-ended');
    socket.off('group-call-session-info');
  };

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    isActiveRef.current = true;

    const init = async () => {
      if (isCallee) {
        const stream = await getLocalStream(initialWithVideo);
        localStreamRef.current = stream;
        if (!initialWithVideo) setIsVideoOff(true);

        // Set local participant + tất cả người khác (ringing hoặc connected)
        const otherTiles: Participant[] = initialParticipants
          .filter((p) => p.userID !== user.userID)
          .map((p) => ({
            userID: p.userID,
            name: p.name,
            avatar: p.avatar,
            status: 'ringing' as const,
          }));

        setParticipants([
          {
            userID: user.userID,
            name: user.name,
            avatar: user.anhDaiDien,
            stream,
            status: 'connected',
            isVideoOff: !initialWithVideo,
          },
          ...otherTiles,
        ]);

        setupSocketListeners();

        socket.emit('group-call-accept', {
          groupID,
          userID: user.userID,
          userInfo: { name: user.name, avatar: user.anhDaiDien },
        });

        // Callee bắt đầu đếm thời gian ngay - SET FLAG TRƯỚC KHI START
        if (!callStartedRef.current) {
          console.log('⏱️ Callee starting timer');

          // Clear interval cũ nếu có (safety check)
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          callStartedRef.current = true;
          timerRef.current = window.setInterval(() => setCallDuration((p) => p + 1), 1000);
        }
      }
      // Caller: init xảy ra trong startCall()
    };

    init();

    return () => {
      doCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Caller: bắt đầu gọi ──────────────────────────────────────────────────

  const startCall = async () => {
    if (selected.length === 0) return;

    const stream = await getLocalStream(true);
    localStreamRef.current = stream;

    const localP: Participant = {
      userID: user.userID,
      name: user.name,
      avatar: user.anhDaiDien,
      stream,
      status: 'connected',
      isVideoOff: false,
    };
    const invitedPs: Participant[] = selected.map((m) => ({
      userID: m.userID,
      name: m.name,
      avatar: m.avatar,
      status: 'ringing',
    }));

    setParticipants([localP, ...invitedPs]);
    setScreen('calling');

    // Setup listeners SAU khi có stream
    setupSocketListeners();

    socket.emit('group-call-start', {
      groupID,
      callerID: user.userID,
      callerInfo: { name: user.name, avatar: user.anhDaiDien },
      invitedUserIDs: selected.map((m) => m.userID),
      // Gửi kèm info để backend lưu và gửi cho callee
      invitedUserInfos: selected.map((m) => ({ userID: m.userID, name: m.name, avatar: m.avatar })),
      groupName,
    });
  };

  // ── Controls ──────────────────────────────────────────────────────────────

  const leaveCall = () => {
    console.log('👋 Leaving call, userID:', user.userID, 'groupID:', groupID);
    socket.emit('group-call-leave', { groupID, userID: user.userID });
    doCleanup();
    onClose();
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !newMuted;
    });
    setIsMuted(newMuted);
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    const newOff = !isVideoOff;
    if (!newOff && tracks.length > 0 && tracks[0].readyState !== 'ended') {
      tracks[0].enabled = true;
    } else if (!newOff) {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = vs.getVideoTracks()[0];
        localStreamRef.current.addTrack(newTrack);
        pcsRef.current.forEach(async (pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(newTrack);
          else pc.addTrack(newTrack, localStreamRef.current!);
        });
      } catch {
        return;
      }
    } else {
      tracks.forEach((t) => {
        t.enabled = false;
      });
    }
    setIsVideoOff(newOff);
    // Update local participant tile để re-render
    setParticipants((prev) =>
      prev.map((p) => (p.userID === user.userID ? { ...p, isVideoOff: newOff } : p))
    );
  };

  const addMembersToCall = (selectedMembers: GroupMember[]) => {
    if (selectedMembers.length === 0) return;

    // Thêm vào participants với status ringing
    const newPs: Participant[] = selectedMembers.map((m) => ({
      userID: m.userID,
      name: m.name,
      avatar: m.avatar,
      status: 'ringing',
    }));
    setParticipants((prev) => [...prev, ...newPs]);

    // Emit event để backend gửi invite
    socket.emit('group-call-add-members', {
      groupID,
      inviterID: user.userID,
      inviterInfo: { name: user.name, avatar: user.anhDaiDien },
      newMemberIDs: selectedMembers.map((m) => m.userID),
      newMemberInfos: selectedMembers.map((m) => ({
        userID: m.userID,
        name: m.name,
        avatar: m.avatar,
      })),
      groupName,
    });

    setShowAddMember(false);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Dừng chia sẻ màn hình
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;

      // Khôi phục camera
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          pcsRef.current.forEach(async (pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) await sender.replaceTrack(videoTrack);
          });

          // Update local participant stream để hiển thị lại camera
          setParticipants((prev) =>
            prev.map((p) =>
              p.userID === user.userID
                ? { ...p, stream: localStreamRef.current!, isVideoOff: false }
                : p
            )
          );
        }
      }
      setIsScreenSharing(false);
    } else {
      // Bắt đầu chia sẻ màn hình
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        } as DisplayMediaStreamOptions);
        screenStreamRef.current = screenStream;

        const screenTrack = screenStream.getVideoTracks()[0];

        // Thay thế video track trong tất cả peer connections
        pcsRef.current.forEach(async (pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          }
        });

        // Tạo stream mới với screen track + audio track từ local stream
        const combinedStream = new MediaStream();
        combinedStream.addTrack(screenTrack);
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) combinedStream.addTrack(audioTrack);
        }

        // Update local participant stream để hiển thị màn hình đang share
        setParticipants((prev) =>
          prev.map((p) =>
            p.userID === user.userID ? { ...p, stream: combinedStream, isVideoOff: false } : p
          )
        );

        // Lắng nghe khi user dừng share từ browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        setIsVideoOff(false);
      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  // ── Grid ──────────────────────────────────────────────────────────────────

  const gridClass =
    participants.length <= 1
      ? 'grid-cols-1'
      : participants.length <= 2
        ? 'grid-cols-2'
        : participants.length <= 4
          ? 'grid-cols-2'
          : 'grid-cols-3';

  // ── Render: Screen 1 (chọn thành viên) ───────────────────────────────────

  if (screen === 'select') {
    const filtered = members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Tạo cuộc gọi</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
            >
              <FaTimes />
            </button>
          </div>
          <div className="px-6 py-3 border-b">
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
              <FaSearch className="text-gray-400 text-sm" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm thành viên"
                className="flex-1 bg-transparent text-sm outline-none text-gray-700"
              />
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {filtered.map((m) => {
                const isSel = selected.some((s) => s.userID === m.userID);
                return (
                  <div
                    key={m.userID}
                    onClick={() =>
                      setSelected((prev) =>
                        isSel ? prev.filter((s) => s.userID !== m.userID) : [...prev, m]
                      )
                    }
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer"
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}
                    >
                      {isSel && <FaCheck className="text-white text-[10px]" />}
                    </div>
                    <img
                      src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`}
                      alt={m.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                  </div>
                );
              })}
            </div>
            {selected.length > 0 && (
              <div className="w-48 border-l px-3 py-2 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">
                  Đã chọn {selected.length}/{members.length}
                </p>
                {selected.map((m) => (
                  <div key={m.userID} className="flex items-center gap-2 py-1.5">
                    <img
                      src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`}
                      alt={m.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-xs text-gray-700 flex-1 truncate">{m.name}</span>
                    <button
                      onClick={() =>
                        setSelected((prev) => prev.filter((s) => s.userID !== m.userID))
                      }
                      className="w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                    >
                      <FaTimes className="text-[10px] text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700"
            >
              Hủy
            </button>
            <button
              onClick={startCall}
              disabled={selected.length === 0}
              className="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white"
            >
              Gọi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Draggable floating window ─────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: pos.x,
      initY: pos.y,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current.dragging) return;
      setPos({
        x: dragState.current.initX + ev.clientX - dragState.current.startX,
        y: dragState.current.initY + ev.clientY - dragState.current.startY,
      });
    };
    const onUp = () => {
      dragState.current.dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Render: Screen 2 & 3 (calling / in-call) ─────────────────────────────

  // Lọc members chưa có trong cuộc gọi
  const availableMembers = members.filter(
    (m) => m.userID !== user.userID && !participants.some((p) => p.userID === m.userID)
  );

  return (
    <>
      <div
        className="fixed z-[9998] bg-gray-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
        style={{ left: pos.x, top: pos.y, width: 720, height: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — kéo được */}
        <div
          ref={dragRef}
          onMouseDown={onMouseDown}
          className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-white/10 cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2">
            {groupAvatar ? (
              <img
                src={groupAvatar}
                alt={groupName}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                <FaUsers className="text-white text-xs" />
              </div>
            )}
            <div>
              <p className="text-white font-semibold text-sm">{groupName}</p>
              <p className="text-gray-400 text-xs">
                {screen === 'calling'
                  ? `Đang gọi ${participants.filter((p) => p.status === 'ringing').length} người...`
                  : `${participants.filter((p) => p.status === 'connected').length} người • ${fmt(callDuration)}`}
              </p>
            </div>
            {/* Nút thêm người - chỉ hiện khi đang in-call */}
            {screen === 'in-call' && (
              <button
                onClick={() => setShowAddMember(true)}
                className="ml-2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Thêm người vào cuộc gọi"
              >
                <FaUserPlus className="text-white text-sm" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-bold">{fmt(callDuration)}</span>
            </div>
          </div>
        </div>

        {/* Video grid */}
        <div className={`flex-1 grid ${gridClass} gap-1.5 p-2 overflow-auto min-h-0`}>
          {participants.map((p) => (
            <ParticipantTile key={p.userID} participant={p} isLocal={p.userID === user.userID} />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-3 bg-gray-900 border-t border-white/10 shrink-0">
          <button
            onClick={toggleMute}
            title={isMuted ? 'Bật mic' : 'Tắt mic'}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}
          >
            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          <button
            onClick={leaveCall}
            title="Rời cuộc gọi"
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-lg transition-colors"
          >
            <FaPhoneSlash />
          </button>
          <button
            onClick={toggleVideo}
            title={isVideoOff ? 'Bật camera' : 'Tắt camera'}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}
          >
            {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
          <button
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white/20 hover:bg-white/30'}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v8h12V4H4zm6 10a1 1 0 011 1v1h2a1 1 0 110 2H7a1 1 0 110-2h2v-1a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modal thêm thành viên */}
      {showAddMember && (
        <AddMemberModal
          members={availableMembers}
          onAdd={addMembersToCall}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Notification khi cuộc gọi kết thúc - góc trên phải */}
      {endedMessage && (
        <div className="fixed top-6 right-6 z-[9999] bg-white rounded-2xl shadow-2xl w-[380px] animate-slide-down">
          <div className="flex items-start gap-3 p-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <FaPhoneSlash className="text-red-500 text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-gray-900 font-semibold text-base">Cuộc gọi bị đã kết thúc</h3>
              <p className="text-gray-600 text-sm mt-0.5">{endedMessage}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ── AddMemberModal Component ──────────────────────────────────────────────────

const AddMemberModal = ({
  members,
  onAdd,
  onClose,
}: {
  members: GroupMember[];
  onAdd: (selected: GroupMember[]) => void;
  onClose: () => void;
}) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GroupMember[]>([]);

  const filtered = members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Thêm người vào cuộc gọi</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            <FaTimes />
          </button>
        </div>
        <div className="px-6 py-3 border-b">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
            <FaSearch className="text-gray-400 text-sm" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm thành viên"
              className="flex-1 bg-transparent text-sm outline-none text-gray-700"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Không có thành viên nào</p>
          ) : (
            filtered.map((m) => {
              const isSel = selected.some((s) => s.userID === m.userID);
              return (
                <div
                  key={m.userID}
                  onClick={() =>
                    setSelected((prev) =>
                      isSel ? prev.filter((s) => s.userID !== m.userID) : [...prev, m]
                    )
                  }
                  className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}
                  >
                    {isSel && <FaCheck className="text-white text-[10px]" />}
                  </div>
                  <img
                    src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`}
                    alt={m.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium text-gray-800">{m.name}</span>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              if (selected.length > 0) onAdd(selected);
            }}
            disabled={selected.length === 0}
            className="px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white"
          >
            Thêm ({selected.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupCallModal;
