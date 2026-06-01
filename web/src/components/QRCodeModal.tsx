import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { FaTimes, FaQrcode, FaCamera, FaDownload } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import toast from 'react-hot-toast';

interface CurrentUser {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface FoundUser {
  userID: string;
  name: string;
  sdt: string;
  anhDaiDien?: string;
  anhBia?: string;
  friendStatus: string;
}

interface Props {
  currentUser: CurrentUser | null;
  onClose: () => void;
  onUserFound: (user: FoundUser) => void; // callback khi quét được user → mở profile
}

type Tab = 'myqr' | 'scan';

const QRCodeModal = ({ currentUser, onClose, onUserFound }: Props) => {
  const [tab, setTab] = useState<Tab>('myqr');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);

  // QR value: chứa userID để backend lookup
  const qrValue = currentUser ? `ott-edu://add-friend/${currentUser.userID}` : '';

  // Bắt đầu quét khi chuyển sang tab scan
  useEffect(() => {
    if (tab === 'scan') {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [tab]);

  const startScanner = async () => {
    if (scannerStarted.current) return;
    setScanError('');
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      scannerStarted.current = true;
      setScanning(true);

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Dừng scanner ngay khi quét được
          await stopScanner();
          await handleQRResult(decodedText);
        },
        () => {} // ignore errors during scanning
      );
    } catch (err: any) {
      setScanError('Không thể truy cập camera. Vui lòng cấp quyền camera cho trình duyệt.');
      setScanning(false);
      scannerStarted.current = false;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerStarted.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (_) {}
      scannerStarted.current = false;
      setScanning(false);
    }
  };

  const handleQRResult = async (decodedText: string) => {
    // Parse QR value: ott-edu://add-friend/{userID}
    const match = decodedText.match(/ott-edu:\/\/add-friend\/(.+)/);
    if (!match) {
      toast.error('QR code không hợp lệ');
      return;
    }

    const scannedUserID = match[1];

    if (scannedUserID === currentUser?.userID) {
      toast.error('Đây là mã QR của chính bạn!');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.get(`/users/qr-profile/${scannedUserID}`);
      onUserFound(res.data);
      onClose();
    } catch {
      toast.error('Không tìm thấy người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Download QR code
  const handleDownloadQR = () => {
    const svg = document.querySelector('#my-qr-code svg') as SVGElement;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `qr-${currentUser?.name || 'user'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-[380px] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-[15px] font-semibold text-gray-800">Mã QR kết bạn</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('myqr')}
            className={`flex-1 py-3 text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors ${
              tab === 'myqr'
                ? 'text-[#0068FF] border-b-2 border-[#0068FF]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FaQrcode />
            Mã QR của tôi
          </button>
          <button
            onClick={() => setTab('scan')}
            className={`flex-1 py-3 text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors ${
              tab === 'scan'
                ? 'text-[#0068FF] border-b-2 border-[#0068FF]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FaCamera />
            Quét mã QR
          </button>
        </div>

        {/* Tab: My QR */}
        {tab === 'myqr' && (
          <div className="flex flex-col items-center px-6 py-8 gap-4">
            {/* Avatar + Name */}
            <div className="flex flex-col items-center gap-2 mb-2">
              <img
                src={currentUser?.anhDaiDien || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.userID}`}
                alt="avatar"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
              />
              <p className="text-[15px] font-bold text-gray-800">{currentUser?.name}</p>
              <p className="text-[12px] text-gray-400">Quét mã để kết bạn với tôi</p>
            </div>

            {/* QR Code */}
            <div
              id="my-qr-code"
              className="p-4 bg-white rounded-2xl shadow-md border border-gray-100"
            >
              <QRCodeSVG
                value={qrValue}
                size={200}
                bgColor="#ffffff"
                fgColor="#0068FF"
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Download button */}
            <button
              onClick={handleDownloadQR}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[13px] font-medium transition-colors"
            >
              <FaDownload className="text-[12px]" />
              Lưu mã QR
            </button>
          </div>
        )}

        {/* Tab: Scan QR */}
        {tab === 'scan' && (
          <div className="flex flex-col items-center px-6 py-6 gap-4">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-[#0068FF] rounded-full animate-spin" />
                <p className="text-[13px] text-gray-500">Đang tìm kiếm người dùng...</p>
              </div>
            ) : scanError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <FaCamera className="text-red-400 text-2xl" />
                </div>
                <p className="text-[13px] text-red-500">{scanError}</p>
                <button
                  onClick={startScanner}
                  className="px-5 py-2 rounded-lg bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#005AE6] transition-colors"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-gray-500 text-center">
                  Hướng camera vào mã QR của người bạn muốn kết bạn
                </p>
                {/* Camera viewfinder */}
                <div className="relative w-full rounded-xl overflow-hidden bg-black">
                  <div id="qr-reader" className="w-full" style={{ minHeight: 280 }} />
                  {/* Corner decorations */}
                  {scanning && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="relative w-[200px] h-[200px]">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                        {/* Scan line animation */}
                        <div className="absolute left-0 right-0 h-0.5 bg-[#0068FF] opacity-80 animate-scan-line" />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scan line animation style */}
      <style>{`
        @keyframes scan-line {
          0% { top: 0; }
          50% { top: calc(100% - 2px); }
          100% { top: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default QRCodeModal;
