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
  creatorInfo?: { name: string; avatar?: string };
}

interface PollMessageProps {
  pollID: string;
  groupID: string;
  userID: string;
  senderName: string;
}

const PollMessage = ({ pollID, groupID, userID }: PollMessageProps) => {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPoll(); }, [pollID]);

  useEffect(() => {
    const handlePollUpdated = (updatedPoll: PollData) => {
      if (updatedPoll.pollID === pollID) setPoll(updatedPoll);
    };
    const handlePollDeleted = (data: { pollID: string }) => {
      if (data.pollID === pollID) setPoll(null);
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 w-[360px] flex items-center justify-center border border-gray-100">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0068ff]"></div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 w-[360px] border border-gray-200">
        <div className="text-gray-400 text-sm italic">Bình chọn không khả dụng</div>
      </div>
    );
  }

  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0);
  const isExpired = poll.endTime ? new Date() > new Date(poll.endTime) : false;
  const userHasVoted = poll.options.some(opt => opt.voters?.includes(userID));
  const shouldHideResults = poll.hideResultsBeforeVote && !userHasVoted;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 w-[360px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="px-4 pt-4 pb-3">
        {/* Tiêu đề */}
        <h3 className="text-[16px] font-bold text-gray-900 mb-0.5 leading-tight">{poll.question}</h3>

        {/* Loại bình chọn */}
        <p className="text-[13px] text-gray-500 mb-3">
          {poll.isMultipleChoice ? 'Chọn nhiều phương án' : 'Chọn một phương án'}
          {isExpired && <span className="text-red-500 ml-2">· Đã kết thúc</span>}
        </p>

        {/* Tổng số người bình chọn */}
        <button
          className="flex items-center gap-1 text-[13px] text-[#0068ff] font-semibold mb-3 bg-transparent border-none cursor-pointer p-0 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('open-poll-detail', { detail: { pollID } }));
          }}
        >
          {totalVotes} người bình chọn
          <span className="text-[10px]">▶</span>
        </button>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {poll.options.slice(0, 3).map((option, index) => {
            const voteCount = option.voters?.length || 0;
            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            const hasVoted = option.voters?.includes(userID);

            return (
              <div
                key={index}
                className={`relative rounded-lg overflow-hidden cursor-pointer select-none ${isExpired ? 'cursor-default' : ''}`}
                onClick={() => {
                  if (isExpired || !poll.isActive) return;
                  axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex: index })
                    .then(res => { if (res.data.poll) setPoll(res.data.poll); })
                    .catch(err => console.error('Lỗi vote:', err));
                }}
              >
                {/* Background bar */}
                <div className="absolute inset-0 bg-[#f0f2f5] rounded-lg" />
                {!shouldHideResults && (
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#d6e8ff] transition-[width] duration-500 rounded-lg"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                {/* Left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${hasVoted ? 'bg-[#0068ff]' : 'bg-[#a8c8f8]'}`} />

                <div className="relative flex items-center justify-between px-3 py-2.5 pl-4">
                  <span className={`text-[14px] font-medium ${hasVoted ? 'text-[#0068ff] font-semibold' : 'text-gray-800'}`}>
                    {option.text}
                  </span>
                  {!shouldHideResults && (
                    <span className="text-[13px] text-gray-600 font-medium ml-2 shrink-0">{voteCount}</span>
                  )}
                </div>
              </div>
            );
          })}

          {poll.options.length > 3 && (
            <p className="text-[12px] text-gray-500 mt-0.5 italic">
              * Còn {poll.options.length - 3} lựa chọn khác
            </p>
          )}
        </div>
      </div>

      {/* Nút Bình chọn */}
      <div className="px-4 pb-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('open-poll-detail', { detail: { pollID } }));
          }}
          className="w-full py-2.5 rounded-xl border-2 border-[#0068ff] text-[#0068ff] text-[15px] font-bold bg-white hover:bg-blue-50 transition-colors"
        >
          Bình chọn
        </button>
      </div>
    </div>
  );
};

export default PollMessage;
