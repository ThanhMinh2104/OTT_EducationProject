import { useState, useEffect, useRef } from 'react';
import { FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';
import socket from '../utils/socket';

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string };
  memberInfo: { userID: string; name: string; anhDaiDien?: string } | null;
  incomingOffer?: RTCSessionDescriptionInit | null;
  remoteUserID?: string | null;
  chatID?: string | null;
  callType?: 'voice' | 'video';
  onClose: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const VideoCallModal = ({ user, memberInfo, incomingOffer, remoteUserID, chatID, callType = 'video', onClose }: Props) => {
  const [callState, setCallState] = useState<'calling' | 'connected'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isLocalVideoOff, setIsLocalVideoOff] = useState(callType === 'voice');
  const [callDuration, setCallDuration] = useState(0);
  const [endMessage, setEndMessage] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - 520), y: 60 });

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteUserIDRef = useRef<string | null>(remoteUserID || memberInfo?.userID || null);
  const callDurationRef = useRef(0);
  const callStateRef = useRef<'calling' | 'connected'>('calling');
  const isActiveRef = useRef(true);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<number | null>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, initX: 0, initY: 0 });
  // Track xem remote có đang gửi video không — dùng ref để tránh stale closure
  const remoteHasVideoRef = useRef(false);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callDurationRef.current = callDuration; }, [callDuration]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const flushICE = async (pc: RTCPeerConnection) => {
    for (const c of iceCandidateQueueRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
    }
    iceCandidateQueueRef.current = [];
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => setCallDuration(p => p + 1), 1000);
  };

  // Gắn stream vào video element — gọi bất cứ khi nào cần
  const attachRemoteStream = (stream: MediaStream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      // Force play nếu bị pause
      remoteVideoRef.current.play().catch(() => {/* autoplay policy */});
    }
  };

  const attachLocalStream = (stream: MediaStream) => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
  };

  const createPC = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = e => {
      if (e.candidate && remoteUserIDRef.current) {
        socket.emit('ice-candidate', { to: remoteUserIDRef.current, candidate: e.candidate, from: user.userID });
      }
    };

    // ontrack fire mỗi khi có track mới từ remote
    pc.ontrack = e => {
      if (!isActiveRef.current) return;
      const stream = e.streams[0];
      if (!stream) return;

      // Luôn gắn stream vào video element
      attachRemoteStream(stream);
      remoteHasVideoRef.current = stream.getVideoTracks().length > 0;

      setCallState('connected');
      startTimer();
    };

    pc.onconnectionstatechange = () => {
      if (!isActiveRef.current) return;
      if (pc.connectionState === 'failed') {
        // Thử restart ICE trước khi báo lỗi
        pc.restartIce();
      }
      if (pc.connectionState === 'connected') {
        // Đảm bảo stream được gắn sau khi kết nối ổn định
        const receivers = pc.getReceivers();
        const videoReceiver = receivers.find(r => r.track?.kind === 'video');
        if (videoReceiver?.track) {
          const streams = pc.getRemoteStreams?.() ?? [];
          if (streams[0] && remoteVideoRef.current) {
            attachRemoteStream(streams[0]);
          }
        }
      }
    };

    return pc;
  };

  const getLocalStream = async (): Promise<MediaStream> => {
    if (callType === 'video') {
      try { return await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch { /* fallback */ }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
        return s;
      } catch { /* fallback */ }
    }
    try { return await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); } catch { /* fallback */ }
    setIsLocalVideoOff(true);
    return new MediaStream();
  };

  const startOutgoingCall = async () => {
    const stream = await getLocalStream();
    localStreamRef.current = stream;
    attachLocalStream(stream);
    if (!stream.getVideoTracks().length) setIsLocalVideoOff(true);

    const pc = createPC();
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call-user', {
      to: memberInfo!.userID, offer, from: user.userID,
      callerInfo: { name: user.name, avatar: user.anhDaiDien }, callType,
    });
  };

  const answerIncomingCall = async () => {
    if (!incomingOffer || !remoteUserID) return;
    remoteUserIDRef.current = remoteUserID;

    const stream = await getLocalStream();
    localStreamRef.current = stream;
    attachLocalStream(stream);
    if (!stream.getVideoTracks().length) setIsLocalVideoOff(true);

    const pc = createPC();
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    await flushICE(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('make-answer', { to: remoteUserID, answer, from: user.userID });
    setCallState('connected');
    startTimer();
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    // Disable track gốc trong stream — đây là cách đúng để tắt mic
    // Không dùng sender vì sender.track là reference đến cùng track
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getVideoTracks();
    const newOff = !isLocalVideoOff;

    if (!newOff) {
      // Bật lại camera
      if (tracks.length > 0 && tracks[0].readyState !== 'ended') {
        // Track còn sống → chỉ enable lại
        tracks[0].enabled = true;
        attachLocalStream(localStreamRef.current);
      } else {
        // Track đã chết hoặc chưa có (voice call) → xin track mới
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = newStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);

          const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            // Video call: replace track trong PC — không cần renegotiate
            await sender.replaceTrack(newTrack);
          } else if (pcRef.current) {
            // Voice call: chưa có video sender → addTrack → PC tự trigger onnegotiationneeded
            // Lắng nghe 1 lần để gửi offer renegotiate
            pcRef.current.onnegotiationneeded = async () => {
              if (!pcRef.current || !remoteUserIDRef.current) return;
              try {
                const offer = await pcRef.current.createOffer();
                await pcRef.current.setLocalDescription(offer);
                // Dùng event riêng để renegotiate, KHÔNG phải call-user
                socket.emit('call-renegotiate', {
                  to: remoteUserIDRef.current,
                  from: user.userID,
                  offer,
                });
              } catch { /* ignore */ }
              pcRef.current.onnegotiationneeded = null;
            };
            pcRef.current.addTrack(newTrack, localStreamRef.current);
          }

          attachLocalStream(localStreamRef.current);
        } catch {
          return;
        }
      }
    } else {
      // Tắt camera — chỉ disable, KHÔNG stop
      tracks.forEach(t => { t.enabled = false; });
    }

    setIsLocalVideoOff(newOff);
  };

  const endCall = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    if (!remoteUserIDRef.current) { onClose(); return; }
    if (callStateRef.current === 'calling' && !incomingOffer) {
      socket.emit('call-cancelled', { to: remoteUserIDRef.current, from: user.userID, chatID });
      onClose();
    } else if (callStateRef.current === 'connected') {
      socket.emit('call-ended', { to: remoteUserIDRef.current, from: user.userID, duration: callDurationRef.current, chatID });
      setEndMessage('Cuộc gọi kết thúc');
      setTimeout(() => onClose(), 2000);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    isActiveRef.current = true;
    socket.emit('join_user', user.userID);

    const onAnswerMade = async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
      if (!isActiveRef.current || !pcRef.current) return;
      if (!remoteUserIDRef.current) remoteUserIDRef.current = data.from;
      if (pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushICE(pcRef.current);
      }
      setCallState('connected');
    };

    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (!isActiveRef.current) return;
      if (pcRef.current?.remoteDescription) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch { /* stale */ }
      } else {
        iceCandidateQueueRef.current.push(data.candidate);
      }
    };

    const onCallRejected = () => {
      if (!isActiveRef.current) return;
      setEndMessage('Cuộc gọi bị từ chối');
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      setTimeout(() => onClose(), 2000);
    };

    const onCallMissed = () => {
      if (!isActiveRef.current) return;
      setEndMessage('Không có ai trả lời');
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      setTimeout(() => onClose(), 2000);
    };

    const onCallCancelled = () => {
      if (!isActiveRef.current) return;
      setEndMessage('Cuộc gọi đã bị hủy');
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      setTimeout(() => onClose(), 2000);
    };

    const onCallEnded = (data: { duration?: number }) => {
      if (!isActiveRef.current) return;
      const dur = data.duration ?? callDurationRef.current;
      setEndMessage(dur > 0 ? `Cuộc gọi kết thúc • ${fmt(dur)}` : 'Cuộc gọi kết thúc');
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      setTimeout(() => onClose(), 2000);
    };

    // Renegotiate khi remote bật cam trong voice call
    const onRenegotiate = async (data: { from: string; offer: RTCSessionDescriptionInit }) => {
      if (!isActiveRef.current || !pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushICE(pcRef.current);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('call-renegotiate-answer', {
          to: data.from,
          from: user.userID,
          answer,
        });
      } catch { /* ignore */ }
    };

    // Nhận answer sau renegotiate
    const onRenegotiateAnswer = async (data: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (!isActiveRef.current || !pcRef.current) return;
      if (pcRef.current.signalingState !== 'stable') {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch { /* ignore */ }
      }
    };

    socket.on('answer-made', onAnswerMade);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('call-rejected', onCallRejected);
    socket.on('call-missed', onCallMissed);
    socket.on('call-cancelled', onCallCancelled);
    socket.on('call-ended', onCallEnded);
    socket.on('call-renegotiate', onRenegotiate);
    socket.on('call-renegotiate-answer', onRenegotiateAnswer);

    if (incomingOffer && remoteUserID) {
      answerIncomingCall();
    } else {
      startOutgoingCall();
    }

    return () => {
      isActiveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off('answer-made', onAnswerMade);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('call-rejected', onCallRejected);
      socket.off('call-missed', onCallMissed);
      socket.off('call-cancelled', onCallCancelled);
      socket.off('call-ended', onCallEnded);
      socket.off('call-renegotiate', onRenegotiate);
      socket.off('call-renegotiate-answer', onRenegotiateAnswer);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag
  const onMouseDown = (e: React.MouseEvent) => {
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, initX: pos.x, initY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current.dragging) return;
      setPos({ x: dragState.current.initX + ev.clientX - dragState.current.startX, y: dragState.current.initY + ev.clientY - dragState.current.startY });
    };
    const onUp = () => { dragState.current.dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const displayName = memberInfo?.name || 'Người dùng';
  const displayAvatar = memberInfo?.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;

  // Overlay hiện khi chưa connected hoặc có end message
  const showOverlay = callState !== 'connected' || !!endMessage;

  return (
    <div
      className="fixed z-[9998] rounded-2xl overflow-hidden shadow-2xl bg-gray-900 border border-white/10 flex flex-col"
      style={{ left: pos.x, top: pos.y, width: 480, height: 380 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Remote video — LUÔN trong DOM, không bao giờ unmount */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ display: showOverlay ? 'none' : 'block' }}
      />

      {/* Overlay */}
      {showOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <img src={displayAvatar} alt="avatar" className="w-20 h-20 rounded-full border-4 border-white/20 object-cover mb-3" />
          <p className="text-white text-lg font-semibold">{displayName}</p>
          <p className="text-gray-400 text-sm mt-1 animate-pulse">
            {endMessage ?? (incomingOffer ? 'Đang kết nối...' : 'Đang gọi...')}
          </p>
        </div>
      )}

      {/* Header drag */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/70 to-transparent cursor-move select-none"
      >
        <p className="text-white text-sm font-semibold drop-shadow">{displayName}</p>
        {callState === 'connected' && !endMessage && (
          <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-bold">{fmt(callDuration)}</span>
          </div>
        )}
      </div>

      {/* Local video PiP — LUÔN trong DOM, dùng visibility thay vì conditional render */}
      <div className="absolute bottom-16 right-3 w-24 rounded-xl overflow-hidden border-2 border-white/30 bg-gray-700 z-20" style={{ height: 72 }}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ display: isLocalVideoOff ? 'none' : 'block' }}
        />
        {isLocalVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={user.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt="you" className="w-10 h-10 rounded-full object-cover" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
        <button onClick={toggleMute} title={isMuted ? 'Bật mic' : 'Tắt mic'}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}>
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </button>
        <button onClick={endCall} title="Kết thúc"
          className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-lg transition-colors">
          <FaPhoneSlash />
        </button>
        {/* Nút camera — hiện cho cả voice call để user có thể bật cam khi muốn */}
        <button onClick={toggleVideo} title={isLocalVideoOff ? 'Bật camera' : 'Tắt camera'}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${isLocalVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'}`}>
          {isLocalVideoOff ? <FaVideoSlash /> : <FaVideo />}
        </button>
      </div>
    </div>
  );
};

export default VideoCallModal;
