import { useState, useEffect, useRef } from 'react';
import {
  FaPhoneSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from 'react-icons/fa';
import socket from '../utils/socket';

interface Props {
  user: { userID: string; name: string; anhDaiDien?: string };
  memberInfo: { userID: string; name: string; anhDaiDien?: string } | null;
  incomingOffer?: RTCSessionDescriptionInit | null;
  // remoteUserID: userID của đối phương (dùng để route qua room)
  remoteUserID?: string | null;
  chatID?: string | null;
  callType?: 'voice' | 'video'; // Loại cuộc gọi
  onClose: () => void;
}

const VideoCallModal = ({
  user,
  memberInfo,
  incomingOffer,
  remoteUserID,
  chatID,
  callType = 'video', // Mặc định là video call
  onClose,
}: Props) => {
  const [callState, setCallState] = useState<'calling' | 'connected'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isLocalVideoOff, setIsLocalVideoOff] = useState(callType === 'voice');
  const [callDuration, setCallDuration] = useState(0);
  const [endMessage, setEndMessage] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Lưu userID của đối phương để route ICE/answer
  const remoteUserIDRef = useRef<string | null>(remoteUserID || memberInfo?.userID || null);
  const callStartTimeRef = useRef<number | null>(null);
  const isActiveRef = useRef<boolean>(true); // Track if this call instance is active

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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: callType === 'video',
      audio: true,
    });
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
      callType: callType, // Gửi loại cuộc gọi
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
      // Nếu chưa kết nối (đang gọi), emit call-cancelled thay vì call-ended
      if (callState === 'calling' && !incomingOffer) {
        socket.emit('call-cancelled', {
          to: remoteUserIDRef.current,
          from: user.userID,
          chatID: chatID,
        });
        // Đóng modal ngay lập tức cho người gọi
        onClose();
      } else if (callState === 'connected') {
        // Chỉ emit call-ended khi đã kết nối
        socket.emit('call-ended', {
          to: remoteUserIDRef.current,
          from: user.userID,
          duration: callDuration,
          chatID: chatID,
        });
        // Hiển thị thông báo trước khi đóng
        setEndMessage('Cuộc gọi kết thúc');
        setTimeout(() => onClose(), 2000);
      } else {
        // Trường hợp khác, đóng ngay
        onClose();
      }
    } else {
      onClose();
    }
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((v) => !v);
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    if (isLocalVideoOff) {
      // Bật video: yêu cầu quyền camera
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];

        // Thay thế audio track cũ bằng track mới có video
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const newStream = new MediaStream([audioTrack, videoTrack]);

        // Cập nhật local video
        localStreamRef.current = newStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

        // Thay thế track trong peer connection
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          pcRef.current?.addTrack(videoTrack, newStream);
        }

        setIsLocalVideoOff(false);
      } catch (error) {
        console.error('Error enabling video:', error);
        alert('Không thể bật camera. Vui lòng kiểm tra quyền truy cập.');
      }
    } else {
      // Tắt video
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
      setIsLocalVideoOff(true);
    }
  };

  useEffect(() => {
    isActiveRef.current = true;
    socket.emit('join_user', user.userID);

    if (incomingOffer && remoteUserID) {
      answerIncomingCall();
    } else {
      startOutgoingCall();
    }

    const onAnswerMade = async (data: { answer: RTCSessionDescriptionInit; from: string }) => {
      if (!isActiveRef.current) return; // Ignore if this call is no longer active
      // Cập nhật remoteUserID nếu chưa có
      if (!remoteUserIDRef.current) remoteUserIDRef.current = data.from;
      setCallState('connected');
      callStartTimeRef.current = Date.now();
      if (pcRef.current && pcRef.current.signalingState !== 'stable') {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const onIceCandidate = async (data: { candidate: RTCIceCandidateInit; from: string }) => {
      if (!isActiveRef.current) return;
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // ignore stale candidates
        }
      }
    };

    const onCallRejected = () => {
      if (!isActiveRef.current) return;
      setEndMessage('Cuộc gọi bị từ chối');
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      setTimeout(() => onClose(), 2000);
    };

    const onCallMissed = () => {
      if (!isActiveRef.current) return;
      setEndMessage('Không trả lời');
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      setTimeout(() => onClose(), 2000);
    };

    const onCallCancelled = () => {
      if (!isActiveRef.current) return;
      setEndMessage('Cuộc gọi đã bị hủy');
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      setTimeout(() => onClose(), 2000);
    };

    const onCallEnded = (data: { duration?: number }) => {
      if (!isActiveRef.current) return;
      const duration = data.duration || callDuration;
      if (duration > 0) {
        setEndMessage(`Cuộc gọi kết thúc • ${formatDuration(duration)}`);
      } else {
        setEndMessage('Cuộc gọi kết thúc');
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      setTimeout(() => onClose(), 2000);
    };

    socket.on('answer-made', onAnswerMade);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('call-rejected', onCallRejected);
    socket.on('call-missed', onCallMissed);
    socket.on('call-cancelled', onCallCancelled);
    socket.on('call-ended', onCallEnded);

    return () => {
      isActiveRef.current = false; // Mark this call as inactive
      socket.off('answer-made', onAnswerMade);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('call-rejected', onCallRejected);
      socket.off('call-missed', onCallMissed);
      socket.off('call-cancelled', onCallCancelled);
      socket.off('call-ended', onCallEnded);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer cho cuộc gọi
  useEffect(() => {
    let interval: number;
    if (callState === 'connected') {
      interval = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayName = memberInfo?.name || 'Người dùng';
  const displayAvatar =
    memberInfo?.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        {/* Remote video (full) hoặc avatar nếu video tắt */}
        <div className="relative w-full h-[420px] bg-gray-800">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {/* Hiển thị avatar khi remote video tắt hoặc chưa có stream */}
          {(callType === 'voice' || !remoteVideoRef.current?.srcObject) &&
            callState === 'connected' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <img
                  src={displayAvatar}
                  alt="avatar"
                  className="w-32 h-32 rounded-full border-4 border-white/30 object-cover"
                />
              </div>
            )}
        </div>

        {/* Overlay khi chưa kết nối */}
        {callState !== 'connected' && !endMessage && (
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

        {/* Overlay thông báo kết thúc cuộc gọi */}
        {endMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95">
            <img
              src={displayAvatar}
              alt="avatar"
              className="w-24 h-24 rounded-full border-4 border-white/30 mb-4 object-cover"
            />
            <p className="text-white text-xl font-bold mb-2">{displayName}</p>
            <p className="text-gray-400 text-base">{endMessage}</p>
          </div>
        )}

        {/* Header khi đã kết nối - hiển thị tên và thời gian */}
        {callState === 'connected' && (
          <div className="absolute top-0 left-0 right-0 flex flex-col items-center py-4 bg-gradient-to-b from-black/60 to-transparent">
            <p className="text-white text-lg font-semibold">{displayName}</p>
            <p className="text-green-400 text-sm font-medium mt-1">
              {formatDuration(callDuration)}
            </p>
          </div>
        )}

        {/* Local video PiP hoặc avatar */}
        <div className="absolute bottom-20 right-4 w-32 h-24 rounded-xl border-2 border-white/30 bg-gray-700 overflow-hidden">
          {isLocalVideoOff ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <img
                src={
                  user.anhDaiDien || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.name
                }
                alt="You"
                className="w-16 h-16 rounded-full object-cover"
              />
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

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
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg transition-colors ${isLocalVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
          >
            {isLocalVideoOff ? <FaVideoSlash /> : <FaVideo />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;
