import { useState } from 'react';
import { FaTimes, FaSearch, FaCrown } from 'react-icons/fa';

interface Member {
  userID: string;
  name: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
}

interface TransferOwnershipModalProps {
  members: Member[];
  currentOwnerID: string;
  onClose: () => void;
  onTransfer: (newOwnerID: string) => void;
}

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  members,
  currentOwnerID,
  onClose,
  onTransfer,
}) => {
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Debug: Log members để kiểm tra
  console.log('TransferOwnershipModal members:', members);

  // Lọc members (không bao gồm owner hiện tại)
  const eligibleMembers = members.filter(
    (m) => m.userID !== currentOwnerID && m.role !== 'owner'
  );

  const filteredMembers = eligibleMembers.filter((m) =>
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTransfer = () => {
    if (!selectedMember) {
      alert('Vui lòng chọn trưởng nhóm mới');
      return;
    }
    onTransfer(selectedMember);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-[90%] max-w-[500px] max-h-[70vh] flex flex-col shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-black">Chọn trưởng nhóm mới trước khi rời</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p>Bạn cần chỉ định một trưởng nhóm mới trước khi rời khỏi nhóm.</p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-full border border-transparent focus-within:bg-white focus-within:border-blue-500 transition-all">
            <FaSearch className="text-gray-500 text-[13px] flex-shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-[13px] outline-none"
            />
          </div>

          {/* Members List */}
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Không tìm thấy thành viên
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.userID}
                  onClick={() => setSelectedMember(member.userID)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedMember === member.userID
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  {/* Radio */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedMember === member.userID
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedMember === member.userID && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>

                  {/* Avatar */}
                  <img
                    src={
                      member.avatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.userID}`
                    }
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-black truncate flex items-center gap-2">
                      {member.name}
                      {member.role === 'admin' && (
                        <FaCrown className="text-yellow-500 text-xs" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {member.role === 'admin' ? 'Phó nhóm' : 'Thành viên'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 bg-white rounded-lg text-[13px] font-semibold text-black hover:bg-gray-100 transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedMember}
            className="flex-1 px-4 py-2.5 bg-blue-500 rounded-lg text-[13px] font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Chọn và tiếp tục
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
