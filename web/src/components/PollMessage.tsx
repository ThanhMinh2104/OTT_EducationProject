import { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';

interface PollOption {
  text: string;
  voters: string[];
}

interface PollData {
  pollID: string;
  groupID: string;
  creatorID: string;
  question: string;
  options: PollOption[];
  isMultipleChoice: boolean;
  endTime?: string;
  createdAt: string;
  isActive: boolean;
  canAddOptions?: boolean;
  hideResultsBeforeVote?: boolean;
  isAnonymous?: boolean;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
}

interface PollMessageProps {
  pollID: string;
  groupID: string;
  userID: string;
  senderName: string;
}

const PollMessage = ({ pollID, groupID, userID, senderName }: PollMessageProps) => {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPoll();
  }, [pollID]);

  // Lắng nghe socket để cập nhật realtime
  useEffect(() => {
    const handlePollUpdated = (updatedPoll: PollData) => {
      if (updatedPoll.pollID === pollID) {
        setPoll(updatedPoll);
      }
    };

    const handlePollDeleted = (data: { pollID: string }) => {
      if (data.pollID === pollID) {
        setPoll(null);
      }
    };

    socket.on('poll_updated', handlePollUpdated);
    socket.on('poll_deleted', handlePollDeleted);

    return () => {
      socket.off('poll_updated', handlePollUpdated);
      socket.off('poll_deleted', handlePollDeleted);
    };
  }, [pollID]);

  const fetchPoll = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/polls/${pollID}`);
      setPoll(response.data);
    } catch (error) {
      console.error('Lỗi tải bình chọn:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (optionIndex: number) => {
    if (!poll || !poll.isActive) return;
    const isExpired = poll.endTime ? new Date() > new Date(poll.endTime) : false;
    if (isExpired) return;

    try {
      const response = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex });
      if (response.data.poll) {
        setPoll(response.data.poll);
      }
    } catch (error: any) {
      console.error('Lỗi vote:', error);
    }
  };

  const handleAddOption = async () => {
    if (!newOptionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/add-option`, { text: newOptionText.trim() });
      if (response.data.poll) {
        setPoll(response.data.poll);
        setNewOptionText('');
        setIsAddingOption(false);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi khi thêm phương án');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 min-w-[320px] max-w-[450px] shadow-md border border-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0068ff]"></div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 min-w-[320px] max-w-[450px] border border-gray-200">
        <div className="text-gray-400 text-sm italic">Bình chọn không khả dụng</div>
      </div>
    );
  }

  const userHasVoted = poll.options.some(opt => opt.voters?.includes(userID));
  const shouldHideResults = poll.hideResultsBeforeVote && !userHasVoted;
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0);
  const isExpired = poll.endTime ? new Date() > new Date(poll.endTime) : false;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 min-w-[320px] max-w-[450px] overflow-hidden transition-all hover:shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="p-5 pb-4">
        {/* Câu hỏi */}
        <h3 className="text-[17px] font-bold text-gray-900 mb-2 leading-tight">{poll.question}</h3>
        
        {/* Metadata */}
        <div className="flex flex-col gap-1 mb-4">
          {poll.endTime && (
            <div className={`text-[12px] flex items-center gap-1.5 ${isExpired ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
              <span className="text-sm">🕒</span>
              {isExpired ? 'Đã kết thúc' : `Kết thúc lúc ${new Date(poll.endTime).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
            </div>
          )}
          {poll.isMultipleChoice && (
            <div className="text-[12px] text-gray-500 flex items-center gap-1.5">
              <span className="text-sm">⚖️</span> Chọn nhiều phương án
            </div>
          )}
          {poll.isAnonymous && (
            <div className="text-[12px] text-gray-500 flex items-center gap-1.5">
              <span className="text-sm">👤</span> Ẩn người bình chọn
            </div>
          )}
          {poll.hideResultsBeforeVote && (
            <div className="text-[12px] text-gray-500 flex items-center gap-1.5">
              <span className="text-sm">👁️‍🗨️</span> Ẩn kết quả khi chưa bình chọn
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {poll.options.slice(0, 3).map((option, index) => {
            const voteCount = option.voters?.length || 0;
            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            const hasVoted = option.voters?.includes(userID);

            return (
              <button
                key={index}
                className={`relative group rounded-xl overflow-hidden min-h-[44px] transition-all text-left w-full border ${
                  hasVoted 
                    ? 'border-[#0068ff] bg-blue-50/30' 
                    : 'border-gray-100 bg-[#f0f2f5] hover:bg-[#e4e6eb]'
                } ${isExpired ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'}`}
                onClick={() => !isExpired && handleVote(index)}
                disabled={isExpired}
              >
                {/* Progress bar (Flat background style) */}
                {!shouldHideResults && (
                  <div
                    className={`absolute left-0 top-0 bottom-0 transition-[width] duration-700 ease-out ${
                      hasVoted ? 'bg-[#0068ff]/10' : 'bg-gray-300/40'
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                )}

                <div className="relative flex items-center justify-between px-4 py-2.5 z-[1]">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      hasVoted ? 'bg-[#0068ff] border-[#0068ff]' : 'border-gray-400 group-hover:border-[#0068ff]'
                    }`}>
                      {hasVoted && <span className="text-[10px] text-white">✓</span>}
                    </div>
                    <span className={`text-[14px] truncate ${hasVoted ? 'text-[#0068ff] font-bold' : 'text-gray-800 font-medium'}`}>
                      {option.text}
                    </span>
                  </div>
                  {!shouldHideResults && (
                    <span className={`text-[13px] font-bold shrink-0 ml-3 ${hasVoted ? 'text-[#0068ff]' : 'text-gray-600'}`}>
                      {voteCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {poll.options.length > 3 && (
            <div className="text-[13px] text-gray-500 mt-1 pl-1 italic font-medium">
              * Còn {poll.options.length - 3} lựa chọn khác
            </div>
          )}

        </div>
      </div>

      {/* Footer Button - Xem lựa chọn */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/30 flex justify-center">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            // Kích hoạt sự kiện mở chi tiết trong Board modal thông qua context hoặc event (tùy kiến trúc)
            // Hiện tại chúng ta giả định nút này mở chi tiết
            window.dispatchEvent(new CustomEvent('open-poll-detail', { detail: { pollID } }));
          }}
          className="text-[#0068ff] text-[14px] font-bold hover:underline py-1 px-4 rounded-full hover:bg-blue-50 transition-all border border-blue-100 bg-white"
        >
          Xem lựa chọn
        </button>
      </div>
    </div>
  );
};

export default PollMessage;
