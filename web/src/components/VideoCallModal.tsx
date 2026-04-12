import { useState, useEffect, useRef } from 'react';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from 'react-icons/fa';
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:5000');

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string };
  memberInfo: { userID: string; name: string; anhDaiDien?: string } | null;
  incomingOffer?: RTCSessionDescriptionInit | null;
  // remoteUserID: userID của đối phương (dùng để route qua room)
  remoteUserID?: string | null;
  onClose: () => void;
}

const VideoCallModal = ({ user, memberInfo, incomingOffer, remoteUserID, onClose }: Props) => {
  const [callState, setCallState] = useState<'calling' | 'connected'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Lưu userID của đối phương để route ICE/answer
  const remoteUserIDRef = useRef<string | null>(remoteUserID || memberInfo?.userID || null);

  const createPC = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && remoteUserIDRef.current) {
        socket.emit('ice-candidate', {
          to: remoteUserIDRef.current,
          candidate: e.candidate,
          from: user.userID,
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
        setCallState('connected');
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setCallState('connected');
    };

    return pc;
  };

  const getLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const startOutgoingCall = async () => {
    if (!memberInfo) return;
    remoteUserIDRef.current = memberInfo.userID;

    const stream = await getLocalStream();
    const pc = createPC();
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('call-user', {
      to: memberInfo.userID, // route tới userID room của người nhận
      offer,
      from: user.userID, // userID của người gọi (để người nhận biết route về)
      callerInfo: { name: user.name, avatar: user.anhDaiDien },
    });
  };

  const answerIncomingCall = async () => {
    if (!incomingOffer || !remoteUserID) return;
    remoteUserIDRef.current = remoteUserID;

    const stream = await getLocalStream();
    const pc = createPC();
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('make-answer', {
      to: remoteUserID, // route tới userID room của người gọi
      answer,
      from: user.userID,
    });
  };

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (remoteUserIDRef.current) {
      socket.emit('call-ended', { to: remoteUserIDRef.current, from: user.userID });
    }
    onClose();
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((v) => !v);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = isVideoOff;
    });
    setIsVideoOff((v) => !v);
  };

  useEffect(() => {
    socket.emit('join_user', user.userID);

    if (incomingOffer && remoteUserID) {
      answerIncomingCall();
    } else {
      startOutgoingCall();
    }

    socket.on('answer-made', async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
      // Cập nhật remoteUserID nếu chưa có
      if (!remoteUserIDRef.current) remoteUserIDRef.current = data.from;
      setCallState('connected');
      if (pcRef.current && pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; from: string }) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // ignore stale candidates
        }
      }
    });

    socket.on('call-rejected', () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      alert('Cuộc gọi bị từ chối');
      onClose();
    });

    socket.on('call-ended', () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      onClose();
    });

    return () => {
      socket.off('answer-made');
      socket.off('ice-candidate');
      socket.off('call-rejected');
      socket.off('call-ended');
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = memberInfo?.name || 'Người dùng';
  const displayAvatar =
    memberInfo?.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Remote video (full) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-[420px] object-cover bg-gray-800"
        />

        {/* Overlay khi chưa kết nối */}
        {callState !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90">
            <img
              src={displayAvatar}
              alt="avatar"
              className="w-24 h-24 rounded-full border-4 border-white/30 mb-4 object-cover"
            />
            <p className="text-white text-xl font-bold mb-2">{displayName}</p>
            <p className="text-gray-400 text-sm animate-pulse">
              {incomingOffer ? 'Đang kết nối...' : 'Đang gọi...'}
            </p>
          </div>
        )}

        {/* Local video PiP */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-20 right-4 w-32 h-24 rounded-xl object-cover border-2 border-white/30 bg-gray-700"
        />

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 py-4 bg-linear-to-t from-black/60 to-transparent">
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg transition-colors ${isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
          >
            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>
          <button
            onClick={endCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-xl transition-colors"
          >
            <FaPhoneSlash />
          </button>
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg transition-colors ${isVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
          >
            {isVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
