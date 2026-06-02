import { useState } from 'react';
import axiosInstance from '../utils/axios';
import OtherProfileModal from './OtherProfileModal';
import toast from 'react-hot-toast';

interface Member {
  userID: string;
  name: string;
  avatar?: string;
}

interface PollOption {
  text: string;
  voters: string[];
}

interface PollVotersModalProps {
  poll: {
    question: string;
    options: PollOption[];
    isAnonymous?: boolean;
  };
  members: Member[];
  userID: string;
  groupID: string;
  onClose: () => void;
}

const PollVotersModal = ({ poll, members, userID, groupID, onClose }: PollVotersModalProps) => {
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const getMember = (vid: string) => members.find(m => m.userID === vid);

  const handleViewProfile = async (targetUserID: string) => {
    if (targetUserID === userID) return; // bỏ qua xem profile bản thân
    try {
      const memberInfo = getMember(targetUserID);
      try {
        const [userRes, statusRes] = await Promise.all([
          axiosInstance.post('/usersID', { userID: targetUserID }),
          axiosInstance.get(`/contacts/friend-status/${targetUserID}`),
        ]);
        setSelectedUser({
          ...userRes.data,
          userID: targetUserID,
          name: userRes.data.name || memberInfo?.name || targetUserID,
          avatar: userRes.data.anhDaiDien || memberInfo?.avatar,
          anhDaiDien: userRes.data.anhDaiDien || memberInfo?.avatar,
          friendStatus: statusRes.data.friendStatus || 'none',
        });
      } catch (err: any) {
        // Nếu user không tồn tại, hiển thị thông tin fallback
        if (err?.response?.status === 404) {
          setSelectedUser({
            userID: targetUserID,
            name: 'Người dùng đã xóa',
            avatar: memberInfo?.avatar,
            anhDaiDien: memberInfo?.avatar,
            friendStatus: 'none',
          });
        } else {
          throw err;
        }
      }
    } catch {
      toast.error('Không thể tải thông tin người dùng');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col shadow-2xl mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 border-none bg-transparent cursor-pointer text-gray-600"
              onClick={onClose}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h3 className="flex-1 text-center text-[15px] font-bold text-[#050505]">Chi tiết bình chọn</h3>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 border-none bg-transparent cursor-pointer text-gray-500 text-lg"
              onClick={onClose}
            >✕</button>
          </div>

          {/* Options + voters */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {poll.options.map((option, idx) => {
              const voteCount = option.voters?.length || 0;
              if (voteCount === 0) return null;
              return (
                <div key={idx} className="mb-5">
                  <p className="text-[14px] font-semibold text-[#050505] mb-2">
                    {option.text} <span className="text-gray-500 font-normal">({voteCount})</span>
                  </p>
                  {poll.isAnonymous ? (
                    <p className="text-[13px] text-gray-400 italic pl-1">{voteCount} người đã bình chọn (ẩn danh)</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {option.voters.map((vid) => {
                        const m = getMember(vid);
                        const name = m?.name || vid;
                        const avatar = m?.avatar;
                        const isMe = vid === userID;
                        return (
                          <div
                            key={vid}
                            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl px-2 py-1.5 transition-colors"
                            onClick={() => handleViewProfile(vid)}
                          >
                            {avatar ? (
                              <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center shrink-0 text-[14px] font-bold text-white">
                                {name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className={`text-[14px] ${isMe ? 'text-[#0068ff] font-semibold' : 'text-[#050505]'}`}>
                              {name}{isMe ? ' (bạn)' : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {poll.options.every(o => (o.voters?.length || 0) === 0) && (
              <p className="text-center text-gray-400 text-[14px] py-8">Chưa có ai bình chọn</p>
            )}
          </div>
        </div>
      </div>

      {selectedUser && (
        <OtherProfileModal
          user={selectedUser}
          currentUser={members.find(m => m.userID === userID)}
          onClose={() => setSelectedUser(null)}
          groupID={groupID}
        />
      )}
    </>
  );
};

export default PollVotersModal;
