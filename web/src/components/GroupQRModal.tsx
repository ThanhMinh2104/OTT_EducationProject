import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FaTimes, FaCopy, FaShare, FaDownload, FaQrcode } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface GroupInfo {
  groupID: string;
  name: string;
  avatar?: string;
  memberCount?: number;
}

interface Props {
  group: GroupInfo;
  onClose: () => void;
}

const GroupQRModal = ({ group, onClose }: Props) => {
  const [copied, setCopied] = useState(false);

  // QR value dùng deep link format
  const qrValue = `ott-edu://join-group/${group.groupID}`;
  // Link hiển thị (thân thiện hơn)
  const displayLink = `ott-edu.app/g/${group.groupID.substring(0, 10)}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(qrValue);
    setCopied(true);
    toast.success('Đã sao chép link tham gia nhóm');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: group.name,
        text: `Tham gia nhóm "${group.name}" trên OTT Education`,
        url: qrValue,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector('#group-qr-code svg') as SVGElement;
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
      link.download = `qr-group-${group.name}.png`;
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
          <div className="flex items-center gap-2">
            <FaQrcode className="text-[#0068FF]" />
            <h3 className="text-[15px] font-semibold text-gray-800">Link nhóm</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes className="text-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-6 py-8 gap-5">
          {/* Group avatar + name */}
          <div className="flex flex-col items-center gap-2">
            <img
              src={group.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${group.groupID}`}
              alt="group avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
            />
            <p className="text-[16px] font-bold text-gray-900">{group.name}</p>
            {group.memberCount !== undefined && (
              <p className="text-[12px] text-gray-400">{group.memberCount} thành viên</p>
            )}
            <p className="text-[12px] text-gray-500 text-center">
              Mời mọi người tham gia nhóm bằng mã QR hoặc link dưới đây:
            </p>
          </div>

          {/* QR Code */}
          <div
            id="group-qr-code"
            className="p-4 bg-white rounded-2xl shadow-md border border-gray-100"
          >
            <QRCodeSVG
              value={qrValue}
              size={200}
              bgColor="#ffffff"
              fgColor="#111827"
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Link display */}
          <div className="w-full flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-3">
            <span className="flex-1 text-[13px] text-blue-500 font-mono truncate">{displayLink}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-6 w-full justify-center">
            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${copied ? 'bg-green-100' : 'bg-gray-100 hover:bg-gray-200'}`}>
                <FaCopy className={`text-[16px] ${copied ? 'text-green-600' : 'text-gray-600'}`} />
              </div>
              <span className="text-[11px] text-gray-500">{copied ? 'Đã sao chép' : 'Sao chép link'}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <FaShare className="text-[16px] text-gray-600" />
              </div>
              <span className="text-[11px] text-gray-500">Chia sẻ link</span>
            </button>

            <button
              onClick={handleDownloadQR}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <FaDownload className="text-[16px] text-gray-600" />
              </div>
              <span className="text-[11px] text-gray-500">Lưu mã QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupQRModal;
