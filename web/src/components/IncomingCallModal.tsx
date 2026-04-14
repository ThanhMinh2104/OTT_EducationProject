import { useState, useEffect } from 'react';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';

interface Props {
  callerInfo: { name: string; avatar?: string };
  onAccept: () => void;
  onReject: () => void;
  onTimeout: () => void;
}

const IncomingCallModal = ({ callerInfo, onAccept, onReject, onTimeout }: Props) => {
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    // Reset timer khi modal mount
    setTimeLeft(15);

    // Tạo âm thanh chuông bằng Web Audio API (không bị chặn autoplay)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    let isPlaying = true;

    const playRingtone = () => {
      if (!isPlaying) return;

      // Tạo oscillator cho âm thanh chuông
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Tạo âm thanh chuông điện thoại (2 nốt)
      oscillator.frequency.value = 800; // Tần số 800Hz
      gainNode.gain.value = 0.3; // Tăng âm lượng lên 0.3

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);

      // Nốt thứ 2
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      oscillator2.frequency.value = 900;
      gainNode2.gain.value = 0.3;
      oscillator2.start(audioContext.currentTime + 0.25);
      oscillator2.stop(audioContext.currentTime + 0.45);

      // Lặp lại sau 1 giây
      setTimeout(() => {
        if (isPlaying) playRingtone();
      }, 1000);
    };

    // Bắt đầu phát nhạc chuông
    playRingtone();

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      isPlaying = false;
      if (audioContext.state !== 'closed') audioContext.close();
    };
  }, [onTimeout]);

  const handleAccept = () => {
    onAccept();
  };

  const handleReject = () => {
    onReject();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-[360px] p-8 flex flex-col items-center gap-5 animate-bounce-in border border-gray-200 dark:border-gray-700">
        {/* Avatar với ring animation và shake */}
        <div className="relative animate-shake">
          <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping"></div>
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse"></div>
          <img
            src={
              callerInfo.avatar ||
              'https://api.dicebear.com/7.x/avataaars/svg?seed=' + callerInfo.name
            }
            alt="caller"
            className="relative w-24 h-24 rounded-full object-cover border-4 border-green-500 shadow-lg"
          />
        </div>

        {/* Caller info */}
        <div className="text-center">
          <p className="font-bold text-gray-900 dark:text-gray-100 text-xl mb-1">
            {callerInfo.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Cuộc gọi đến...</p>
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center">
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${(timeLeft / 15) * 175.93} 175.93`}
                className="text-green-500 transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{timeLeft}</span>
            </div>
          </div>
        </div>

        {/* Action buttons với animation */}
        <div className="flex gap-8 mt-2">
          <button
            onClick={handleReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 animate-pulse-slow"
            title="Từ chối"
          >
            <FaPhoneSlash />
          </button>
          <button
            onClick={handleAccept}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 animate-pulse-slow"
            title="Nghe máy"
          >
            <FaPhone />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
