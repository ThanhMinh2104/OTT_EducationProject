import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import PollVotersModal from './PollVotersModal';

interface PollOption {
  text: string;
  voters: string[];
}

interface Poll {
  pollID: string;
  question: string;
  options: PollOption[];
  isMultipleChoice: boolean;
  endTime?: string;
  isActive: boolean;
  isPinned: boolean;
  creatorID: string;
  isAnonymous?: boolean;
  hideResultsBeforeVote?: boolean;
}

interface Member {
  userID: string;
  name: string;
  anhDaiDien?: string;
}

interface Props {
  pollID: string;
  groupID: string;
  userID: string;
  members?: Member[];
  currentUser?: { userID: string; name: string } | null;
  onOpenBoard?: () => void;
}

const PollBubble = ({ pollID, groupID, userID, members = [], currentUser, onOpenBoard }: Props) => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showVoters, setShowVoters] = useState(false);

  const fetchPoll = async () => {
    try {
      const res = await axiosInstance.get(`/groups/${groupID}/polls/${pollID}`);
      setPoll(res.data);
      if (res.data.options) {
        const indices = res.data.options
          .map((opt: PollOption, idx: number) => (opt.voters || []).includes(userID) ? idx : -1)
          .filter((idx: number) => idx !== -1);
        setSelectedIndices(indices);
      }
    } catch (error) {
      console.error('Fetch poll error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoll();
    const handlePollUpdated = (updatedPoll: Poll) => {
      if (updatedPoll.pollID === pollID) {
        setPoll(updatedPoll);
        if (updatedPoll.options) {
          const indices = updatedPoll.options
            .map((opt, idx) => (opt.voters || []).includes(userID) ? idx : -1)
            .filter(idx => idx !== -1);
          setSelectedIndices(indices);
        }
      }
    };
    socket.on('poll_updated', handlePollUpdated);
    socket.on('poll_voted', handlePollUpdated);
    return () => {
      socket.off('poll_updated', handlePollUpdated);
      socket.off('poll_voted', handlePollUpdated);
    };
  }, [pollID, userID]);

  const handleVote = async (index: number) => {
    if (voting !== null || !poll) return;
    if (poll.endTime && new Date(poll.endTime) < new Date()) {
      Alert.alert('Thông báo', 'Bình chọn này đã kết thúc');
      return;
    }
    try {
      setVoting(index);
      await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex: index });
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể bình chọn');
    } finally {
      setVoting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#0084ff" />
      </View>
    );
  }

  if (!poll) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Không tìm thấy bình chọn</Text>
      </View>
    );
  }

  const totalVotes = poll.options?.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0) || 0;
  const totalVoters = new Set(poll.options?.flatMap(opt => opt.voters || []) || []).size;
  const isClosed = poll.endTime && new Date(poll.endTime) < new Date();
  const userHasVoted = poll.options?.some(opt => opt.voters?.includes(userID));
  const shouldHideResults = poll.hideResultsBeforeVote && !userHasVoted;
  const displayedOptions = poll.options?.slice(0, 3) || [];
  const remainingOptionsCount = (poll.options?.length || 0) - displayedOptions.length;

  return (
    <View style={styles.container}>
      {/* Tiêu đề */}
      <Text style={styles.question} numberOfLines={2}>{poll.question}</Text>

      {/* Loại bình chọn */}
      <Text style={styles.subType}>
        {poll.isMultipleChoice ? 'Chọn nhiều phương án' : 'Chọn một phương án'}
        {isClosed ? '  ·  Đã kết thúc' : ''}
      </Text>

      {/* Số người bình chọn - bấm để xem chi tiết */}
      <TouchableOpacity style={styles.voterCountRow} onPress={() => setShowVoters(true)}>
        <Text style={styles.voterCountText}>
          {totalVoters} người bình chọn, {totalVotes} lượt bình chọn
        </Text>
        <Text style={styles.voterCountArrow}>▶</Text>
      </TouchableOpacity>

      {/* Options */}
      <View style={styles.optionsList}>
        {displayedOptions.map((option, index) => {
          const isSelected = selectedIndices.includes(index);
          const voteCount = option.voters?.length || 0;
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
          const voterAvatars = option.voters?.slice(0, 3).map(vid => members.find(m => m.userID === vid));

          return (
            <TouchableOpacity
              key={index}
              style={styles.optionWrapper}
              onPress={() => handleVote(index)}
              disabled={!!isClosed || voting !== null}
            >
              {/* Background fill */}
              <View style={[styles.optionBg, { width: shouldHideResults ? '0%' : `${percentage}%` as any }]} />
              {/* Left accent */}
              <View style={[styles.optionAccent, isSelected && styles.optionAccentSelected]} />
              {/* Content */}
              <View style={styles.optionContent}>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>
                  {option.text}
                </Text>
                <View style={styles.optionRight}>
                  {!shouldHideResults && !poll.isAnonymous && voteCount > 0 && (
                    <View style={styles.avatarStack}>
                      {voterAvatars?.map((m, i) => (
                        m?.anhDaiDien ? (
                          <Image
                            key={i}
                            source={{ uri: m.anhDaiDien }}
                            style={[styles.smallAvatar, { marginLeft: i > 0 ? -8 : 0 }]}
                          />
                        ) : (
                          <View key={i} style={[styles.smallAvatar, styles.smallAvatarFallback, { marginLeft: i > 0 ? -8 : 0 }]}>
                            <Text style={styles.smallAvatarText}>{(m?.name || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                        )
                      ))}
                    </View>
                  )}
                  {!shouldHideResults && (
                    <Text style={[styles.voteCount, isSelected && styles.voteCountSelected]}>{voteCount}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {remainingOptionsCount > 0 && (
        <Text style={styles.remainingText}>* Còn {remainingOptionsCount} lựa chọn khác</Text>
      )}

      {/* Nút Bình chọn */}
      <TouchableOpacity style={styles.voteButton} onPress={onOpenBoard}>
        <Text style={styles.voteButtonText}>Bình chọn</Text>
      </TouchableOpacity>

      {/* Voters Modal */}
      {showVoters && (
        <PollVotersModal
          visible={showVoters}
          poll={poll}
          members={members}
          userID={userID}
          currentUser={currentUser || null}
          onClose={() => setShowVoters(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    width: 290,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  question: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subType: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
  },
  voterCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  voterCountText: {
    fontSize: 13,
    color: '#0068ff',
    fontWeight: '600',
  },
  voterCountArrow: {
    fontSize: 9,
    color: '#0068ff',
  },
  optionsList: {
    marginBottom: 10,
    gap: 8,
  },
  optionWrapper: {
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f2f5',
    position: 'relative',
    justifyContent: 'center',
  },
  optionBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#c8deff',
    borderRadius: 10,
  },
  optionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#a8c8f8',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  optionAccentSelected: {
    backgroundColor: '#0068ff',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingLeft: 14,
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    color: '#0068ff',
    fontWeight: '600',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  smallAvatarFallback: {
    backgroundColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4f46e5',
  },
  voteCount: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    minWidth: 14,
    textAlign: 'right',
  },
  voteCountSelected: {
    color: '#0068ff',
  },
  remainingText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  voteButton: {
    borderWidth: 2,
    borderColor: '#0068ff',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  voteButtonText: {
    fontSize: 15,
    color: '#0068ff',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
});

export default PollBubble;
