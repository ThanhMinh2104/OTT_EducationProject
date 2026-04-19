import { useEffect, useState } from 'react';
import { FaPhoneSlash, FaVideo, FaVideoSlash } from 'react-icons/fa';

interface Props {
  callerInfo: { name: string; avatar?: string };
  groupName: string;
  invitedNames: string[]; // tên những người khác được mời
  onAccept: (withVideo: boolean) => void;
  onReject: () => void;
}

const GroupIncomingCallModal = ({ callerInfo, groupName, invitedNames, onAccept, onReject }: Props) => {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    // Chuông
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    let active = true;
    const ring = () => {
      if (!active) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; gain.gain.value = 0.2;
      osc.start(); osc.stop(ctx.currentTime + 0.2);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.frequency.value = 950; gain2.gain.value = 0.2;
      osc2.start(ctx.currentTime + 0.25); osc2.stop(ctx.currentTime + 0.45);
      setTimeout(() => { if (active) ring(); }, 1200);
    };
    ring();

    const timer = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { clearInterval(timer); onReject(); return 0; }
        return p - 1;
      });
    }, 1000);

    return () => {
      active = false;
      clearInterval(timer);
      if (ctx.state !== 'closed') ctx.close();
    };
  }, [onReject]);

  // Hiển thị tên những người được mời (trừ caller)
  const othersText = invitedNames.length > 0
    ? invitedNames.slice(0, 3).join(', ') + (invitedNames.length > 3 ? ` và ${invitedNames.length - 3} người khác` : '')
    : '';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[340px] rounded-3xl overflow-hidden shadow-2xl">
        {/* Blue background area */}
        <div className="bg-[#1a6ed8] px-6 pt-8 pb-6 flex flex-col items-center gap-4">
          {/* Avatar với ring */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
            <img
              src={callerInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerInfo.name}`}
              alt={callerInfo.name}
              className="relative w-20 h-20 rounded-full object-cover border-4 border-white/40"
            />
          </div>

          {/* Names */}
          <div className="text-center">
            {othersText ? (
              <p className="text-white font-bold text-lg leading-tight">{othersText}</p>
            ) : (
              <p className="text-white font-bold text-lg">{groupName}</p>
            )}
            <p className="text-white/80 text-sm mt-1">
              <span className="font-semibold">{callerInfo.name}</span> mời bạn vào cuộc gọi nhóm
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-8 mt-2">
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={onReject}
                className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-xl transition-all shadow-lg hover:scale-105 active:scale-95"
              >
                <FaPhoneSlash />
              </button>
              <span className="text-white/70 text-xs">Từ chối</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => onAccept(true)}
                className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white text-xl transition-all shadow-lg hover:scale-105 active:scale-95 animate-pulse"
              >
                <FaVideo />
              </button>
              <span className="text-white/70 text-xs">Chấp nhận</span>
            </div>
          </div>
        </div>

        {/* Answer without camera */}
        <button
          onClick={() => onAccept(false)}
          className="w-full bg-[#1558b0] hover:bg-[#1248a0] py-4 flex items-center justify-center gap-2 text-white text-sm font-medium transition-colors"
        >
          <FaVideoSlash className="text-base" />
          Trả lời không mở camera
        </button>
      </div>
    </div>
  );
};

export default GroupIncomingCallModal;
