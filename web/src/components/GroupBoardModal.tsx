import { useState, useEffect } from 'react';
import { FaTimes, FaArrowLeft, FaCog } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import './GroupBoardModal-animations.css';
import PollVotersModal from './PollVotersModal';

interface Message {
  messageID: string;
  groupID?: string;
  chatID?: string;
  senderID: string;
  content: string;
  type: string;
  media_url?: string[];
  timestamp: string;
  pinnedInfo?: {
    pinnedBy: string;
    pinnedAt: string;
  };
  senderInfo?: {
    name: string;
    avatar?: string;
  };
}

interface Note {
  noteID: string;
  groupID: string;
  creatorID: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
}

interface Poll {
  pollID: string;
  groupID: string;
  creatorID: string;
  question: string;
  options: Array<{
    text: string;
    voters: string[];
  }>;
  isMultipleChoice: boolean;
  canAddOptions: boolean;
  hideResultsBeforeVote: boolean;
  isAnonymous: boolean;
  shouldPin?: boolean;
  createdAt: string;
  endTime?: string;
  isActive: boolean;
  creatorInfo?: {
    name: string;
    avatar?: string;
  };
}

interface GroupMember {
  userID: string;
  name: string;
  avatar?: string;
}

interface GroupBoardModalProps {
  show: boolean;
  onClose: () => void;
  groupID: string;
  userID: string;
  onViewMessage?: (messageID: string) => void;
  onPinLimitReached?: (noteID: string) => void;
  canCreateNotes?: boolean;
  canCreatePolls?: boolean;
  initialTab?: TabType;
  initialPollId?: string;
  members?: GroupMember[];
}

type TabType = 'all' | 'pinned' | 'notes' | 'polls';
type ViewMode = 'list' | 'create-note' | 'view-note' | 'edit-note' | 'create-poll' | 'view-poll';

const GroupBoardModal = ({
  show,
  onClose,
  groupID,
  userID,
  onViewMessage,
  onPinLimitReached,
  canCreateNotes = true,
  canCreatePolls = true,
  initialTab,
  initialPollId,
  members = []
}: GroupBoardModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [showPollMenu, setShowPollMenu] = useState(false);

  // Form states cho tạo/sửa ghi chú
  const [noteContent, setNoteContent] = useState('');
  const [notePinToTop, setNotePinToTop] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states cho tạo bình chọn
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMultipleChoice, setPollMultipleChoice] = useState(true);
  const [pollEndTime, setPollEndTime] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [pollCanAddOptions, setPollCanAddOptions] = useState(true);
  const [pollHideResults, setPollHideResults] = useState(false);
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);
  const [pollShouldPin, setPollShouldPin] = useState(false);
  const [duplicateIndices, setDuplicateIndices] = useState<number[]>([]);
  const [tempSelectedOptions, setTempSelectedOptions] = useState<number[]>([]);
  const [tempNewOptionsInView, setTempNewOptionsInView] = useState<Array<{ text: string, isChecked: boolean }>>([]);
  const [showVotersModal, setShowVotersModal] = useState(false);

  // Confirm Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>({
    title: '',
    message: '',
    onConfirm: () => { },
  });

  // 1. Reset form khi đóng modal
  useEffect(() => {
    if (!show) {
      setViewMode('list');
      setActiveTab('all');
      setSelectedNote(null);
      setNoteContent('');
      setNotePinToTop(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMultipleChoice(true);
      setPollEndTime('');
      setShowAdvancedSettings(false);
      setPollCanAddOptions(true);
      setPollHideResults(false);
      setPollIsAnonymous(false);
      setPollShouldPin(false);
      setDuplicateIndices([]);
      setSelectedPoll(null);
      setShowPollMenu(false);
      setTempSelectedOptions([]);
      setTempNewOptionsInView([]);
    }
  }, [show]);

  // 2. Fetch dữ liệu khi Tab hoặc Mode thay đổi
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'all' || activeTab === 'pinned') {
        const pinRes = await axiosInstance.get(`/groups/${groupID}/pinned-messages`);
        setPinnedMessages(pinRes.data.pinnedMessages || []);
      }
      if (activeTab === 'all' || activeTab === 'notes') {
        const noteRes = await axiosInstance.get(`/groups/${groupID}/notes`);
        setNotes(noteRes.data.notes || []);
      }
      if (activeTab === 'all' || activeTab === 'polls') {
        const pollRes = await axiosInstance.get(`/groups/${groupID}/polls`);
        setPolls(pollRes.data.polls || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchData();
    }
  }, [show, activeTab, groupID]);

  // 3. Xử lý Socket và Điều hướng
  useEffect(() => {
    if (!show) return;

    const handleNoteCreated = () => fetchData();
    const handleNoteUpdated = () => fetchData();
    const handleNoteDeleted = () => fetchData();
    const handleNotePinToggled = () => fetchData();
    const handlePollCreated = () => fetchData();
    const handlePollUpdated = (updatedPoll: Poll) => {
      setPolls(prev => prev.map(p => p.pollID === updatedPoll.pollID ? updatedPoll : p));
    };
    const handlePollDeleted = (data: { pollID: string }) => {
      setPolls(prev => prev.filter(p => p.pollID !== data.pollID));
    };

    socket.on('note_created', handleNoteCreated);
    socket.on('note_updated', handleNoteUpdated);
    socket.on('note_deleted', handleNoteDeleted);
    socket.on('note_pin_toggled', handleNotePinToggled);
    socket.on('poll_created', handlePollCreated);
    socket.on('poll_updated', handlePollUpdated);
    socket.on('poll_deleted', handlePollDeleted);

    if (initialPollId) {
      axiosInstance.get(`/groups/${groupID}/polls/${initialPollId}`).then(res => {
        if (res.data) {
          setSelectedPoll(res.data);
          const currentVotes = res.data.options.reduce((acc: number[], opt: { voters: string[] }, idx: number) => {
            if (opt.voters?.includes(userID)) acc.push(idx);
            return acc;
          }, []);
          setTempSelectedOptions(currentVotes);
          setViewMode('view-poll');
        }
      });
    } else if (initialTab) {
      setActiveTab(initialTab);
    }

    return () => {
      socket.off('note_created', handleNoteCreated);
      socket.off('note_updated', handleNoteUpdated);
      socket.off('note_deleted', handleNoteDeleted);
      socket.off('note_pin_toggled', handleNotePinToggled);
      socket.off('poll_created', handlePollCreated);
      socket.off('poll_updated', handlePollUpdated);
      socket.off('poll_deleted', handlePollDeleted);
    };
  }, [show, groupID, initialPollId, initialTab, fetchData, userID]);

  const handleBackToList = () => {
    if (viewMode === 'view-poll' || viewMode === 'create-poll') {
      setActiveTab('polls');
      setSelectedPoll(null);
      setTempNewOptionsInView([]);
      setTempSelectedOptions([]);
    } else if (viewMode === 'view-note' || viewMode === 'edit-note' || viewMode === 'create-note') {
      setActiveTab('notes');
      setSelectedNote(null);
    }
    setViewMode('list');
    fetchData();
  };

  const fetchPinnedMessages = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/pinned-messages`);
      const pinned = response.data.pinnedMessages || [];
      setPinnedMessages(pinned);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      setPinnedMessages([]);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/notes`);
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    }
  };

  const fetchPolls = async () => {
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/polls`);
      setPolls(response.data.polls || []);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setPolls([]);
    }
  };

  const handleCreatePoll = () => {
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollMultipleChoice(true);
    setPollEndTime('');
    setShowAdvancedSettings(false);
    setPollCanAddOptions(true);
    setPollHideResults(false);
    setPollIsAnonymous(false);
    setPollShouldPin(false);
    setDuplicateIndices([]);
    setViewMode('create-poll');
  };

  // ── Group Reminder handlers ──────────────────────────────────────────────
  // (Reminder logic moved to GroupReminderModal)

  const handleSubmitVotes = async () => {
    if (!selectedPoll) return;
    try {
      setIsSaving(true);
      let currentPoll = { ...selectedPoll };
      const pollID = currentPoll.pollID;

      // 1. Xử lý các phương án mới được thêm vào (tempNewOptionsInView)
      // Lọc bỏ ô trống và các nội dung bị trùng lặp trong chính danh sách mới
      const rawNewOptions = tempNewOptionsInView.filter(opt => opt.text.trim());
      const uniqueNewOptions: Array<{text: string, isChecked: boolean}> = [];
      const seenTexts = new Set();
      
      for (const opt of rawNewOptions) {
        const normalized = opt.text.trim().toLowerCase();
        if (!seenTexts.has(normalized)) {
          seenTexts.add(normalized);
          uniqueNewOptions.push(opt);
        }
      }
      
      for (const newOpt of uniqueNewOptions) {
        try {
          const textToAdd = newOpt.text.trim();
          // Kiểm tra xem phương án này đã tồn tại trong danh sách cũ chưa (double check)
          const alreadyExists = currentPoll.options.some(o => o.text.toLowerCase() === textToAdd.toLowerCase());
          if (alreadyExists) continue;

          // Thêm phương án mới lên server
          const addRes = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/add-option`, {
            text: textToAdd
          });
          
          currentPoll = addRes.data;
          
          // Nếu user tick chọn phương án mới này, thực hiện vote luôn
          if (newOpt.isChecked) {
            const newIndex = currentPoll.options.findIndex(o => o.text.toLowerCase() === textToAdd.toLowerCase());
            if (newIndex !== -1) {
              const voteRes = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex: newIndex });
              currentPoll = voteRes.data.poll || voteRes.data;
            }
          }
        } catch (err: any) {
          const msg = err.response?.data?.message || 'Không xác định';
          toast.error(`Không thể thêm "${newOpt.text}": ${msg}`);
          // Nếu lỗi trùng lặp thì bỏ qua và làm tiếp cái khác, các lỗi khác có thể cần dừng lại
          if (err.response?.status !== 400) throw err;
        }
      }

      // 2. Xử lý thay đổi bình chọn cho các phương án cũ
      const currentServerVotes: number[] = [];
      currentPoll.options.forEach((opt, idx) => {
        if (opt.voters.includes(userID)) currentServerVotes.push(idx);
      });

      const toToggle = [
        ...tempSelectedOptions.filter(i => !currentServerVotes.includes(i)),
        ...currentServerVotes.filter(i => !tempSelectedOptions.includes(i))
      ];

      // Đảm bảo index hợp lệ với danh sách poll hiện tại nhất
      const validToToggle = toToggle.filter(idx => idx < currentPoll.options.length);

      for (const index of validToToggle) {
        try {
          const voteRes = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex: index });
          currentPoll = voteRes.data.poll || voteRes.data;
        } catch (err) {
          console.error("Lỗi khi vote phương án index", index, err);
        }
      }

      toast.success('Đã cập nhật bình chọn');
      setPolls(prev => prev.map(p => p.pollID === pollID ? currentPoll : p));
      setTempNewOptionsInView([]); 
      setViewMode('list');
      setActiveTab('polls');
    } catch (error: any) {
      console.error("Lỗi tổng quát khi gửi bình chọn:", error);
      toast.error(error.response?.data?.message || 'Lỗi khi gửi bình chọn');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOptionInView = () => {
    if (tempNewOptionsInView.length + (selectedPoll?.options.length || 0) >= 30) {
      toast.error('Tối đa 30 lựa chọn');
      return;
    }
    setTempNewOptionsInView(prev => [...prev, { text: '', isChecked: false }]);
  };

  const handleSavePoll = async () => {
    if (!pollQuestion.trim()) {
      toast.error('Vui lòng nhập câu hỏi');
      return;
    }
    const validOptions = pollOptions.filter(o => o.trim());
    if (validOptions.length < 2) {
      toast.error('Cần ít nhất 2 lựa chọn');
      return;
    }

    if (duplicateIndices.length > 0) {
      toast.error('Vui lòng loại bỏ các phương án trùng lặp');
      return;
    }

    setIsSaving(true);
    try {
      await axiosInstance.post(`/groups/${groupID}/polls`, {
        question: pollQuestion.trim(),
        options: validOptions,
        isMultipleChoice: pollMultipleChoice,
        endTime: pollEndTime || undefined,
        canAddOptions: pollCanAddOptions,
        hideResultsBeforeVote: pollHideResults,
        isAnonymous: pollIsAnonymous,
        shouldPin: pollShouldPin,
      });
      toast.success('Đã tạo bình chọn');
      await fetchPolls();
      handleBackToList();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi tạo bình chọn');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVotePoll = async (pollID: string, optionIndex: number) => {
    try {
      const response = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/vote`, { optionIndex });
      // Cập nhật poll trong state local ngay lập tức
      if (response.data.poll) {
        setPolls(prev => prev.map(p => p.pollID === pollID ? response.data.poll : p));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi bình chọn');
    }
  };

  const handleDeletePoll = (pollID: string) => {
    setConfirmModalConfig({
      title: 'Xóa bình chọn',
      message: 'Bạn có chắc chắn muốn xóa cuộc bình chọn này? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      type: 'danger',
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/groups/${groupID}/polls/${pollID}`);
          toast.success('Đã xóa bình chọn');
          await fetchPolls();
          setShowConfirmModal(false);
          if (viewMode === 'view-poll') setViewMode('list');
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Lỗi khi xóa bình chọn');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleLockPoll = (pollID: string) => {
    setShowPollMenu(false);
    setConfirmModalConfig({
      title: 'Khóa bình chọn',
      message: 'Không ai có thể thêm phương án hoặc bình chọn sau khi khóa. Bạn có chắc muốn khóa bình chọn này?',
      confirmText: 'Khóa bình chọn',
      type: 'warning',
      onConfirm: async () => {
        try {
          const response = await axiosInstance.post(`/groups/${groupID}/polls/${pollID}/lock`);
          toast.success('Đã khóa bình chọn');
          if (response.data.poll) {
            setPolls(prev => prev.map(p => p.pollID === pollID ? response.data.poll : p));
            if (selectedPoll?.pollID === pollID) setSelectedPoll(response.data.poll);
          }
          setShowConfirmModal(false);
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Lỗi khi khóa bình chọn');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleSendPollToChat = async (poll: Poll) => {
    try {
      await axiosInstance.post(`/groups/${groupID}/polls/${poll.pollID}/share`);
      toast.success('Đã chia sẻ bình chọn vào nhóm');
      setShowPollMenu(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi chia sẻ bình chọn');
    }
  };

  const addPollOption = () => {
    if (pollOptions.length >= 30) {
      toast.error('Tối đa 30 lựa chọn');
      return;
    }
    setPollOptions([...pollOptions, '']);
  };

  // Kiểm tra trùng lặp poll options mỗi khi danh sách thay đổi
  useEffect(() => {
    const duplicates: number[] = [];
    pollOptions.forEach((opt, i) => {
      if (opt.trim() && pollOptions.some((other, j) => i !== j && other.trim().toLowerCase() === opt.trim().toLowerCase())) {
        duplicates.push(i);
      }
    });
    setDuplicateIndices(duplicates);
  }, [pollOptions]);

  const removePollOption = (index: number) => {
    if (pollOptions.length <= 2) return;
    const newOptions = pollOptions.filter((_, i) => i !== index);
    setPollOptions(newOptions);
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleCloseAttempt = () => {
    const hasData = pollQuestion.trim() !== '' || pollOptions.some(opt => opt.trim() !== '');
    if (hasData) {
      setConfirmModalConfig({
        title: 'Hủy bình chọn',
        message: 'Bạn có muốn hủy bình chọn đang tạo? Các thông tin đã nhập sẽ bị mất.',
        confirmText: 'Hủy bỏ',
        type: 'danger',
        onConfirm: () => {
          handleBackToList();
          setShowConfirmModal(false);
        }
      });
      setShowConfirmModal(true);
    } else {
      handleBackToList();
    }
  };

  const handleCreateNote = () => {
    setSelectedNote(null);
    setNoteContent('');
    setNotePinToTop(false);
    setViewMode('create-note');
  };

  const handleViewNote = (note: Note) => {
    setSelectedNote(note);
    setNoteContent(note.content);
    setNotePinToTop(note.isPinned || false);
    setViewMode('view-note');
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setNoteContent(note.content);
    setNotePinToTop(note.isPinned || false);
    setViewMode('edit-note');
  };

  const handleViewPoll = async (poll: Poll) => {
    setSelectedPoll(poll);
    // Init tempSelectedOptions từ votes hiện tại của user
    const currentVotes = poll.options.reduce((acc: number[], opt, idx) => {
      if (opt.voters?.includes(userID)) acc.push(idx);
      return acc;
    }, []);
    setTempSelectedOptions(currentVotes);
    setViewMode('view-poll');

    // Fetch fresh poll data to get voters info if needed
    try {
      const response = await axiosInstance.get(`/groups/${groupID}/polls/${poll.pollID}`);
      if (response.data) {
        setSelectedPoll(response.data);
        // Re-init với data mới nhất
        const freshVotes = response.data.options.reduce((acc: number[], opt: { voters: string[] }, idx: number) => {
          if (opt.voters?.includes(userID)) acc.push(idx);
          return acc;
        }, []);
        setTempSelectedOptions(freshVotes);
      }
    } catch (error) {
      console.error('Error fetching poll details:', error);
    }
  };


  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Vui lòng nhập nội dung ghi chú');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedNote) {
        // Edit existing note
        await axiosInstance.put(`/groups/${groupID}/notes/${selectedNote.noteID}`, { content: noteContent });

        // Toggle pin if needed
        if (selectedNote.isPinned !== notePinToTop) {
          // If trying to pin, check limit
          if (notePinToTop) {
            const totalPinned = pinnedMessages.length + notes.filter(n => n.isPinned).length;
            if (totalPinned >= 3) {
              // Notify parent to show pin limit modal
              if (onPinLimitReached) {
                onPinLimitReached(selectedNote.noteID);
                // Refresh data and go back to list immediately
                await fetchNotes();
                await fetchPinnedMessages();
                handleBackToList();
                toast.success('Đã cập nhật ghi chú');
                setIsSaving(false);
                return;
              }
              setIsSaving(false);
              return;
            }
          }
          await axiosInstance.post(`/groups/${groupID}/notes/${selectedNote.noteID}/toggle-pin`);
        }

        toast.success('Đã cập nhật ghi chú');
      } else {
        // Create new note
        const response = await axiosInstance.post(`/groups/${groupID}/notes`, { content: noteContent });
        const newNote = response.data.note;

        // Pin if needed
        if (notePinToTop) {
          const totalPinned = pinnedMessages.length + notes.filter(n => n.isPinned).length;
          if (totalPinned >= 3) {
            // Notify parent to show pin limit modal with the new note ID
            if (onPinLimitReached) {
              onPinLimitReached(newNote.noteID);
              // Refresh to show the new note (but not pinned yet)
              await fetchNotes();
              await fetchPinnedMessages();
              // Go back to list immediately after creating note
              handleBackToList();
              toast.success('Đã tạo ghi chú');
              setIsSaving(false);
              return;
            }
            // Note is created but not pinned
            await fetchNotes();
            await fetchPinnedMessages();
            handleBackToList();
            toast.success('Đã tạo ghi chú');
            setIsSaving(false);
            return;
          }
          await axiosInstance.post(`/groups/${groupID}/notes/${newNote.noteID}/toggle-pin`);
        }

        toast.success('Đã tạo ghi chú');
      }

      // Refresh data and go back to list
      await fetchNotes();
      await fetchPinnedMessages();
      handleBackToList();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi lưu ghi chú');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = (noteID: string) => {
    setConfirmModalConfig({
      title: 'Xóa ghi chú',
      message: 'Bạn có chắc chắn muốn xóa ghi chú này?',
      confirmText: 'Xóa',
      type: 'danger',
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/groups/${groupID}/notes/${noteID}`);
          toast.success('Đã xóa ghi chú');
          await fetchNotes();
          await fetchPinnedMessages();
          setShowConfirmModal(false);
        } catch (error: any) {
          toast.error(error.response?.data?.message || 'Lỗi khi xóa ghi chú');
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleTogglePinNote = async (note: Note) => {
    try {
      // If unpinning, just do it
      if (note.isPinned) {
        await axiosInstance.post(`/groups/${groupID}/notes/${note.noteID}/toggle-pin`);
        toast.success('Đã bỏ ghim ghi chú');
        await Promise.all([fetchNotes(), fetchPinnedMessages()]);
        return;
      }

      // If pinning, check limit (3 total including messages and notes)
      const totalPinned = pinnedMessages.length + notes.filter(n => n.isPinned).length;
      if (totalPinned >= 3) {
        // Notify parent to show pin limit modal
        if (onPinLimitReached) {
          onPinLimitReached(note.noteID);
        }
        return;
      }

      await axiosInstance.post(`/groups/${groupID}/notes/${note.noteID}/toggle-pin`);
      toast.success('Đã ghim ghi chú');

      // Refresh both notes and pinned messages to update the list
      await Promise.all([
        fetchNotes(),
        fetchPinnedMessages()
      ]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi ghim/bỏ ghim');
    }
  };

  const getContentPreview = (msg: Message) => {
    if (msg.type === 'text') return msg.content;
    if (msg.type === 'image') return '[Hình ảnh]';
    if (msg.type === 'video') return '[Video]';
    if (msg.type === 'file') return `[File] ${msg.content}`;
    if (msg.type === 'audio') return '[Tin nhắn thoại]';
    if (msg.type === 'notification') {
      if (msg.content?.startsWith('POLL_NOTIF|')) {
        const parts = msg.content.split('|');
        const [_, action, pollID, pollName, userName] = parts;
        let actionText = 'đã tham gia bình chọn:';
        if (action === 'CREATE') actionText = 'đã tạo bình chọn:';
        if (action === 'LEAVE') actionText = 'đã bỏ bình chọn:';
        if (action === 'CHANGE') actionText = 'đã đổi lựa chọn:';
        if (action === 'LOCK') actionText = 'đã khóa bình chọn:';
        if (action === 'SHARE') actionText = 'đã chia sẻ bình chọn:';
        return `${actionText} ${pollName}`;
      }
      return msg.content;
    }
    return '[Media]';
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-1000 p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
          {viewMode !== 'list' && (
            <button className="flex items-center gap-2 bg-transparent border-none text-[#0084ff] text-sm font-medium cursor-pointer px-3 py-2 rounded-md transition-all hover:bg-[#0084ff]/5" 
              onClick={(e) => {
                e.stopPropagation();
                if (viewMode === 'create-poll') {
                  handleCloseAttempt();
                } else {
                  handleBackToList();
                }
              }}
            >
              <FaArrowLeft /> Quay lại
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-900 m-0">
            {viewMode === 'list' && 'Bảng tin nhóm'}
            {viewMode === 'create-note' && 'Tạo ghi chú'}
            {viewMode === 'view-note' && 'Xem ghi chú'}
            {viewMode === 'edit-note' && 'Chỉnh sửa ghi chú'}
            {viewMode === 'create-poll' && 'Tạo bình chọn'}
            {viewMode === 'view-poll' && 'Chi tiết bình chọn'}
          </h2>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full border-none bg-gray-100 text-gray-700 flex items-center justify-center cursor-pointer transition-all hover:bg-gray-200 hover:scale-105" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Tabs - only show in list view */}
        {viewMode === 'list' && (
          <div className="flex bg-white border-b border-gray-200">
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'all' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-gray-600 border-b-transparent hover:text-[#0084ff] hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('all')}
            >
              Tất cả
            </button>
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'pinned' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-gray-600 border-b-transparent hover:text-[#0084ff] hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('pinned')}
            >
              Tin ghim
            </button>
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'notes' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-gray-600 border-b-transparent hover:text-[#0084ff] hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('notes')}
            >
              Ghi chú
            </button>
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'polls' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-gray-600 border-b-transparent hover:text-[#0084ff] hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('polls')}
            >
              Bình chọn
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-15 px-5">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0084ff]"></div>
                </div>
              ) : (
                <>
                  {/* Pinned Messages Tab */}
                  {activeTab === 'pinned' && (
                <div>
                  {pinnedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-15 px-5 gap-4">
                      <span className="text-6xl opacity-30">📌</span>
                      <p className="text-base text-gray-500 m-0">Chưa có tin ghim</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {pinnedMessages.map((msg) => (
                        <div key={msg.messageID} className="bg-white rounded-xl p-4 transition-all hover:bg-gray-50 border border-gray-200">
                          <div className="flex items-center gap-3 mb-3">
                            <img
                              src={msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`}
                              alt="avatar"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="flex-1">
                              <div className="text-[15px] font-semibold text-gray-900 mb-1">{msg.senderInfo?.name || 'Người dùng'}</div>
                              <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                                <span className="text-sm">📌</span>
                                Tin ghim
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-700 leading-relaxed mb-3 break-words">{getContentPreview(msg)}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{formatDateTime(msg.timestamp)}</span>
                            <button
                              className="text-[13px] text-[#0084ff] bg-transparent border-none cursor-pointer px-2 py-1 rounded transition-all hover:bg-[#0084ff]/10"
                              onClick={() => {
                                onViewMessage?.(msg.messageID);
                                onClose();
                              }}
                            >
                              Xem tin nhắn gốc
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div>
                  <div className="flex flex-col gap-3">
                    {notes.map((note) => (
                      <div key={note.noteID} className="bg-white rounded-xl p-4 transition-all hover:bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={note.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${note.creatorID}`}
                            alt="avatar"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <div className="text-[15px] font-semibold text-gray-900 mb-1">{note.creatorInfo?.name || "Nguoi dung"}</div>
                            <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                              <span className="text-sm">📝</span>
                              Ghi chu
                            </div>
                          </div>
                          <div className="flex gap-2 ml-auto">
                            <button
                              className="w-8 h-8 rounded-full border-none bg-gray-100 text-gray-700 text-base cursor-pointer transition-all flex items-center justify-center hover:bg-gray-200 hover:scale-110"
                              onClick={() => handleTogglePinNote(note)}
                              title={note.isPinned ? 'Bỏ ghim' : 'Ghim'}
                            >
                              📌
                            </button>
                            {note.creatorID === userID && (
                              <button
                                className="w-8 h-8 rounded-full border-none bg-gray-100 text-gray-700 text-base cursor-pointer transition-all flex items-center justify-center hover:bg-red-100 hover:text-red-600 hover:scale-110"
                                onClick={() => handleDeleteNote(note.noteID)}
                                title="Xóa"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed mb-3 break-words cursor-pointer transition-colors p-2 -m-2 rounded-md hover:bg-gray-100" onClick={() => handleViewNote(note)}>
                          {note.content}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{formatDateTime(note.createdAt)}</span>
                          <button className="text-[13px] text-[#0084ff] bg-transparent border-none cursor-pointer px-2 py-1 rounded transition-all hover:bg-[#0084ff]/10" onClick={() => handleViewNote(note)}>
                            Xem ghi chú
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Create Note Button at bottom */}
                  {canCreateNotes ? (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent z-10">
                    <button className="w-full py-3.5 px-6 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,132,255,0.3)] hover:bg-[#0073e6] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,132,255,0.4)]" onClick={handleCreateNote}>
                      Tạo ghi chú
                    </button>
                  </div>
                  ) : (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent z-10">
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-base">🔒</span>
                      <span className="text-sm text-gray-600">Chỉ trưởng nhóm và phó nhóm mới có thể tạo ghi chú</span>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Polls Tab */}
              {activeTab === 'polls' && (
                <div>
                  {polls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-15 px-5 gap-4">
                      <span className="text-6xl opacity-30">📊</span>
                      <p className="text-base text-gray-500 m-0">Chưa có bình chọn</p>
                      {canCreatePolls && (
                        <button className="py-3 px-6 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#0073e6] hover:-translate-y-px" onClick={handleCreatePoll}>Tạo bình chọn</button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {polls.map((poll) => {
                        const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0);
                        const isExpired = poll.endTime ? new Date() > new Date(poll.endTime) : false;
                        return (
                          <div key={poll.pollID} className="bg-white rounded-xl p-5 transition-all hover:bg-gray-50 border border-gray-200 cursor-pointer" onClick={() => handleViewPoll(poll)}>
                            <div className="text-base font-semibold text-gray-900 mb-2">{poll.question}</div>
                            {poll.endTime && (
                              <div className={`text-[13px] mb-1 ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                                {isExpired ? 'Đã kết thúc' : `Kết thúc lúc ${formatDateTime(poll.endTime)}`}
                              </div>
                            )}
                            <div className="text-[13px] text-[#0084ff] my-3">{totalVotes} người bình chọn</div>
                            <div className="flex flex-col gap-2 mb-4">
                              {poll.options.map((option, index) => {
                                const voteCount = option.voters?.length || 0;
                                const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                                return (
                                  <div key={index} className="relative bg-gray-100 rounded-lg overflow-hidden min-h-[44px]">
                                    <div className="absolute left-0 top-0 bottom-0 bg-[#0084ff]/30 transition-[width] duration-300" style={{ width: `${percentage}%` }}></div>
                                    <div className="relative flex items-center justify-between px-4 py-3 z-[1]">
                                      <span className="text-sm text-gray-900">{option.text}</span>
                                      <span className="text-sm font-semibold text-gray-900">{voteCount}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <button className="w-full py-3 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#0073e6]" onClick={(e) => { e.stopPropagation(); handleViewPoll(poll); }}>Xem chi tiết</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Create Poll Button at bottom */}
                  {canCreatePolls ? (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent z-10">
                    <button className="w-full py-3.5 px-6 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,132,255,0.3)] hover:bg-[#0073e6] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,132,255,0.4)]" onClick={handleCreatePoll}>
                      Tạo bình chọn
                    </button>
                  </div>
                  ) : (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent z-10">
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white rounded-lg border border-gray-200">
                      <span className="text-base">🔒</span>
                      <span className="text-sm text-gray-600">Chỉ trưởng nhóm và phó nhóm mới có thể tạo bình chọn</span>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* All Tab */}
              {activeTab === 'all' && (
                <div>
                  {pinnedMessages.length === 0 && notes.filter(n => n.isPinned).length === 0 && polls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-15 px-5 gap-4">
                      <span className="text-6xl opacity-30">📂</span>
                      <p className="text-base text-gray-500 m-0">Chưa có nội dung được ghim</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                      {/* Combined pinned messages and notes */}
                      {(pinnedMessages.length > 0 || notes.filter(n => n.isPinned).length > 0) && (
                        <div className="flex flex-col gap-3">
                          <h3 className="text-base font-semibold text-gray-900 m-0 mb-2">
                            Danh sách ghim ({pinnedMessages.length + notes.filter(n => n.isPinned).length})
                          </h3>
                          <div className="flex flex-col gap-3">
                            {/* Pinned Notes */}
                            {notes.filter(n => n.isPinned).map((note) => (
                              <div key={note.noteID} className="bg-white rounded-xl p-4 transition-all hover:bg-gray-50 border border-gray-200">
                                <div className="flex items-center gap-3 mb-3">
                                  <img
                                    src={note.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${note.creatorID}`}
                                    alt="avatar"
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-[15px] font-semibold text-gray-900 mb-1">{note.creatorInfo?.name || 'Người dùng'}</div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                                      <span className="text-sm">📝</span>
                                      Ghi chú
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 leading-relaxed mb-3 break-words cursor-pointer transition-colors p-2 -m-2 rounded-md hover:bg-gray-100" onClick={() => handleViewNote(note)}>
                                  {note.content}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">{formatDateTime(note.createdAt)}</span>
                                  <button className="text-[13px] text-[#0084ff] bg-transparent border-none cursor-pointer px-2 py-1 rounded transition-all hover:bg-[#0084ff]/10" onClick={() => handleViewNote(note)}>
                                    Xem ghi chú
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            {/* Pinned Messages */}
                            {pinnedMessages.slice(0, 3).map((msg) => (
                              <div key={msg.messageID} className="bg-white rounded-xl p-4 transition-all hover:bg-gray-50 border border-gray-200">
                                <div className="flex items-center gap-3 mb-3">
                                  <img
                                    src={msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`}
                                    alt="avatar"
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-[15px] font-semibold text-gray-900 mb-1">{msg.senderInfo?.name || 'Người dùng'}</div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
                                      <span className="text-sm">📌</span>
                                      Tin nhắn
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 leading-relaxed mb-3 break-words">{getContentPreview(msg)}</div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">{formatDateTime(msg.timestamp)}</span>
                                  <button
                                    className="text-[13px] text-[#0084ff] bg-transparent border-none cursor-pointer px-2 py-1 rounded transition-all hover:bg-[#0084ff]/10"
                                    onClick={() => {
                                      onViewMessage?.(msg.messageID);
                                      onClose();
                                    }}
                                  >
                                    Xem tin nhắn gốc
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {polls.length > 0 && (
                        <div className="flex flex-col gap-3">
                          <h3 className="text-base font-bold text-[#050505] m-0 mb-2">Bình chọn ({polls.length})</h3>
                          <div className="flex flex-col gap-3">
                            {polls.slice(0, 3).map((poll) => {
                              const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0);
                              const isExpired = poll.endTime ? new Date() > new Date(poll.endTime) : false;
                              return (
                                <div key={poll.pollID} className="bg-white rounded-xl p-5 transition-all hover:bg-[#f2f2f2] shadow-sm border border-[#e4e6eb] cursor-pointer" onClick={() => handleViewPoll(poll)}>
                                  <div className="text-base font-bold text-[#050505] mb-2">{poll.question}</div>
                                  {poll.endTime && (
                                    <div className={`text-[13px] mb-1 ${isExpired ? 'text-[#ff3b30]' : 'text-[#65676b]'}`}>
                                      {isExpired ? 'Đã kết thúc' : `Kết thúc lúc ${formatDateTime(poll.endTime)}`}
                                    </div>
                                  )}
                                  <div className="text-[13px] text-[#0084ff] font-semibold my-3">{totalVotes} lượt bình chọn</div>
                                  <div className="flex flex-col gap-2 mb-4">
                                    {poll.options.map((option, index) => {
                                      const voteCount = option.voters?.length || 0;
                                      const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                                      const hasVoted = option.voters?.includes(userID);
                                      return (
                                        <div key={index} className={`relative rounded-lg overflow-hidden min-h-[44px] border ${hasVoted ? 'border-[#0084ff] bg-[#0084ff]/5' : 'border-[#e4e6eb] bg-[#f0f2f5]'}`}>
                                          <div className="absolute left-0 top-0 bottom-0 bg-[#0084ff]/10 transition-[width] duration-500 ease-out" style={{ width: `${percentage}%` }}></div>
                                          <div className="relative flex items-center justify-between px-4 py-3 z-[1]">
                                            <div className="flex items-center gap-2">
                                              {hasVoted && <span className="text-[#0084ff]">✓</span>}
                                              <span className={`text-sm ${hasVoted ? 'font-bold text-[#0084ff]' : 'text-[#1c1e21]'}`}>{option.text}</span>
                                            </div>
                                            <span className="text-sm font-bold text-[#050505]">{voteCount} ({percentage.toFixed(0)}%)</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="text-xs text-[#65676b] text-right">
                                    Tạo bởi {(poll as any).creatorInfo?.name || 'Người dùng'} • {formatDateTime(poll.createdAt)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

            </>
          )}

          {/* Note/Poll views */}
          {viewMode === 'create-note' && (
            <div className="p-6 note-form-container">
              <div className="mb-4">
                <label className="block mb-2 text-sm font-semibold text-gray-700">Nội dung</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nhập nội dung ghi chú..."
                  rows={10}
                  className="w-full min-h-[200px] p-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-[15px] font-[inherit] leading-relaxed resize-y transition-all focus:outline-none focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              
              <div className="flex items-center gap-2.5 mb-5">
                <input
                  type="checkbox"
                  id="pin-to-top"
                  checked={notePinToTop}
                  onChange={(e) => setNotePinToTop(e.target.checked)}
                  className="w-[18px] h-[18px] cursor-pointer accent-[#0084ff]"
                />
                <label htmlFor="pin-to-top" className="text-sm text-gray-700 cursor-pointer select-none">Ghim lên đầu trò chuyện</label>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button 
                  className="py-2.5 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-gray-200 text-gray-700 hover:bg-gray-300"
                  onClick={handleBackToList}
                >
                  Đóng
                </button>
                <button
                  className="py-2.5 px-6 rounded-lg text-sm font-bold bg-[#0084ff] text-white hover:bg-[#0073e6] transition-all disabled:opacity-50"
                  onClick={handleSaveNote}
                  disabled={isSaving || !noteContent.trim()}
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}
                </button>
              </div>
            </div>
          )}

          {/* VIEW NOTE VIEW */}
          {viewMode === 'view-note' && selectedNote && (
            <div className="p-6 note-view-container">
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedNote.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedNote.creatorID}`}
                    alt="avatar"
                    className="w-12 h-12 rounded-full object-cover border border-[#e4e6eb]"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedNote.creatorInfo?.name || 'Người dùng'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDateTime(selectedNote.createdAt)}
                    </div>
                  </div>
                </div>
                
                {selectedNote.creatorID === userID && (
                  <button 
                    className="px-4 py-2 bg-transparent border border-[#0084ff] rounded-md text-[#0084ff] text-[13px] font-medium cursor-pointer transition-all hover:bg-[#0084ff]/10"
                    onClick={() => handleEditNote(selectedNote)}
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>
              
              <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap mb-5 min-h-[100px] break-words">
                {selectedNote.content}
              </div>

              <div className="flex gap-3 pt-6 border-t border-[#f0f2f5]">
                <button
                  className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${selectedNote.isPinned
                    ? 'bg-[#0084ff] text-white hover:bg-[#0073e6]'
                    : 'bg-[#f0f2f5] text-[#050505] hover:bg-[#e4e6eb]'
                    }`}
                  onClick={() => handleTogglePinNote(selectedNote)}
                >
                  📌 {selectedNote.isPinned ? 'Bỏ ghim' : 'Ghim ghi chú'}
                </button>

                {selectedNote.creatorID === userID && (
                  <button 
                    className="flex-1 py-2.5 px-4 border-none rounded-lg text-sm font-medium cursor-pointer transition-all bg-red-50 text-red-600 hover:bg-red-100"
                    onClick={() => handleDeleteNote(selectedNote.noteID)}
                  >
                    🗑️ Xóa ghi chú
                  </button>
                )}
              </div>
            </div>
          )}

          {/* EDIT NOTE VIEW */}
          {viewMode === 'edit-note' && selectedNote && (
            <div className="p-6 note-form-container">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-200">
                <img
                  src={selectedNote.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedNote.creatorID}`}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover border border-[#e4e6eb]"
                />
                <div className="flex-1">
                  <div className="text-[13px] text-gray-500">
                    Tạo bởi {selectedNote.creatorInfo?.name || 'Người dùng'} - {formatDateTime(selectedNote.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2 text-sm font-semibold text-gray-700">Nội dung</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nhập nội dung ghi chú..."
                  rows={10}
                  className="w-full min-h-[200px] p-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-[15px] font-[inherit] leading-relaxed resize-y transition-all focus:outline-none focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/20 placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              
              <div className="flex items-center gap-2.5 mb-5">
                <input
                  type="checkbox"
                  id="pin-to-top-edit"
                  checked={notePinToTop}
                  onChange={(e) => setNotePinToTop(e.target.checked)}
                  className="w-[18px] h-[18px] cursor-pointer accent-[#0084ff]"
                />
                <label htmlFor="pin-to-top-edit" className="text-sm text-gray-700 cursor-pointer select-none">Ghim lên đầu trò chuyện</label>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button 
                  className="py-2.5 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-gray-200 text-gray-700 hover:bg-gray-300"
                  onClick={handleBackToList}
                >
                  Hủy
                </button>
                <button
                  className="py-2.5 px-6 rounded-lg text-sm font-bold bg-[#0084ff] text-white hover:bg-[#0073e6] transition-all disabled:opacity-50"
                  onClick={handleSaveNote}
                  disabled={isSaving || !noteContent.trim()}
                >
                  {isSaving ? 'Đang lưu...' : 'Cập nhật ghi chú'}
                </button>
              </div>
            </div>
          )}

          {/* CREATE POLL VIEW */}
          {viewMode === 'create-poll' && (
            <div className={`flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-sm border border-[#e4e6eb] ${showAdvancedSettings ? 'max-w-[900px]' : 'max-w-[500px]'} mx-auto transition-all duration-300`}>
              <div className="flex h-full">
                {/* Main Form */}
                <div className="flex-1 p-6 border-r border-[#e4e6eb] overflow-y-auto custom-scrollbar">
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-[#050505]">Chủ đề bình chọn</label>
                      <span className="text-[11px] text-[#65676b]">{pollQuestion.length}/200</span>
                    </div>
                    <textarea
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value.substring(0, 200))}
                      placeholder="Nhập chủ đề bình chọn..."
                      className="w-full p-4 rounded-lg border border-[#e4e6eb] bg-[#f0f2f5] text-[#050505] text-[15px] focus:outline-none focus:border-[#0084ff] focus:bg-white transition-all resize-none min-h-[100px]"
                      autoFocus
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block mb-3 text-sm font-bold text-[#050505]">Các lựa chọn</label>
                    <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {pollOptions.map((option, index) => (
                        <div key={index} className="flex flex-col gap-1">
                          <div className="relative group flex items-center">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updatePollOption(index, e.target.value)}
                              placeholder={`Lựa chọn ${index + 1}`}
                              className={`flex-1 p-3 pr-10 rounded-lg border bg-[#f0f2f5] text-[#050505] text-[15px] transition-all focus:outline-none focus:border-[#0084ff] focus:bg-white ${duplicateIndices.includes(index) ? 'border-red-500' : 'border-[#e4e6eb]'
                                }`}
                            />
                            {pollOptions.length > 2 && (
                              <button
                                onClick={() => removePollOption(index)}
                                className="absolute right-2 w-8 h-8 rounded-full border-none bg-transparent text-[#65676b] flex items-center justify-center cursor-pointer hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <FaTimes />
                              </button>
                            )}
                          </div>
                          {duplicateIndices.includes(index) && (
                            <span className="text-[11px] text-red-500 px-1">Phương án được thêm đã tồn tại</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={addPollOption}
                    disabled={pollOptions.length >= 30}
                    className="flex items-center gap-2 text-[#0084ff] bg-transparent border-none font-semibold text-sm cursor-pointer py-2 disabled:text-gray-400 disabled:no-underline"
                  >
                    <span className="text-lg hover:underline">+</span> Thêm lựa chọn (Tối đa 30)
                  </button>

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#f0f2f5]">
                    <button
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${showAdvancedSettings ? 'bg-[#0084ff] text-white' : 'bg-[#f0f2f5] text-[#65676b] hover:bg-[#e4e6eb]'
                        }`}
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                      title="Thiết lập nâng cao"
                    >
                      <FaCog />
                    </button>
                    <div className="flex gap-3">
                      <button
                        className="py-2.5 px-6 rounded-lg text-sm font-bold bg-[#f0f2f5] text-[#050505] hover:bg-[#e4e6eb] transition-all"
                        onClick={handleCloseAttempt}
                      >
                        Hủy
                      </button>
                      <button
                        className="py-2.5 px-6 rounded-lg text-sm font-bold bg-[#0084ff] text-white hover:bg-[#0073e6] transition-all disabled:opacity-50"
                        onClick={handleSavePoll}
                        disabled={isSaving || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2 || duplicateIndices.length > 0}
                      >
                        {isSaving ? 'Đang tạo...' : 'Tạo bình chọn'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings Panel */}
                {showAdvancedSettings && (
                  <div className="w-[350px] p-6 bg-[#f9fafb] overflow-y-auto custom-scrollbar border-l border-[#e4e6eb]">
                    <div className="mb-6">
                      <label className="block mb-3 text-sm font-bold text-[#050505]">Thời hạn bình chọn</label>
                      <input
                        type="datetime-local"
                        value={pollEndTime}
                        onChange={(e) => setPollEndTime(e.target.value)}
                        className="w-full p-3 rounded-lg border border-[#e4e6eb] bg-white text-[#050505] text-sm focus:outline-none focus:border-[#0084ff] [color-scheme:light]"
                      />
                      <p className="text-[11px] text-[#65676b] mt-2 underline">Không thời hạn</p>
                    </div>

                    <div className="mb-6">
                      <label className="block mb-3 text-sm font-bold text-[#050505]">Thiết lập nâng cao</label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-[#1c1e21]">Ghim lên đầu trò chuyện</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={pollShouldPin} onChange={(e) => setPollShouldPin(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0084ff]"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-[#1c1e21]">Chọn nhiều phương án</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={pollMultipleChoice} onChange={(e) => setPollMultipleChoice(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0084ff]"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-[#1c1e21]">Có thể thêm phương án</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={pollCanAddOptions} onChange={(e) => setPollCanAddOptions(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0084ff]"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#e4e6eb] pt-6 mt-6">
                      <label className="block mb-3 text-sm font-bold text-[#050505]">Bình chọn ẩn danh</label>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-[#1c1e21]">Ẩn kết quả khi chưa bình chọn</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={pollHideResults} onChange={(e) => setPollHideResults(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0084ff]"></div>
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-[#1c1e21]">Ẩn người bình chọn</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={pollIsAnonymous} onChange={(e) => setPollIsAnonymous(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0084ff]"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* VIEW POLL VIEW */}
          {viewMode === 'view-poll' && selectedPoll && (() => {
            const totalVotes = selectedPoll.options.reduce((sum, opt) => sum + (opt.voters?.length || 0), 0);
            const totalVoters = new Set(selectedPoll.options.flatMap(opt => opt.voters || [])).size;
            const isExpired = selectedPoll.endTime ? new Date() > new Date(selectedPoll.endTime) : false;
            const hasChanges = (
              JSON.stringify([...tempSelectedOptions].sort()) !== JSON.stringify(
                selectedPoll.options.reduce((acc: number[], opt, idx) => {
                  if (opt.voters.includes(userID)) acc.push(idx);
                  return acc;
                }, []).sort()
              )
            ) || tempNewOptionsInView.some(opt => opt.text.trim().length > 0);
            return (
            <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-sm animate-fade-in border border-[#e4e6eb]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#f0f2f5] flex items-center justify-between">
                <h3 className="text-[17px] font-bold text-[#050505]">Bình chọn</h3>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer text-gray-500 text-xl"
                  onClick={(e) => { e.stopPropagation(); handleBackToList(); }}
                >✕</button>
              </div>
              {/* Poll info */}
              <div className="px-5 pt-4 pb-3 border-b border-[#f0f2f5]">
                <h4 className="text-[18px] font-bold text-[#050505] mb-1">{selectedPoll.question}</h4>
                <p className="text-[13px] text-gray-500 mb-3">
                  Tạo bởi {selectedPoll.creatorInfo?.name || 'Người dùng'} · {formatDateTime(selectedPoll.createdAt)}
                  {isExpired && <span className="text-red-500 ml-1">· Đã kết thúc</span>}
                </p>
                <div className="flex items-center gap-1.5 text-[13px] text-gray-600">
                  <span>☰</span>
                  <span>{selectedPoll.isMultipleChoice ? 'Chọn nhiều phương án' : 'Chọn một phương án'}</span>
                </div>
              </div>
              {/* Tổng số người + lượt */}
              <div className="px-5 py-2.5 border-b border-[#f0f2f5]">
                <button
                  className="flex items-center gap-1 text-[13px] text-[#0068ff] font-semibold bg-transparent border-none cursor-pointer p-0 hover:underline"
                  onClick={(e) => { e.stopPropagation(); setShowVotersModal(true); }}
                >
                  {totalVoters} người bình chọn, {totalVotes} lượt bình chọn
                  <span className="text-[10px] ml-0.5">▶</span>
                </button>
              </div>

              {/* Poll Options List */}
              <div className="flex-1 px-5 py-3 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-2">
                  {selectedPoll.options.map((option, index) => {
                    const isSelectedTemp = tempSelectedOptions.includes(index);
                    const voteCount = option.voters?.length || 0;
                    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                    const voterAvatars = option.voters?.slice(0, 3).map(vid => members.find(m => m.userID === vid));
                    return (
                      <div key={index} className="flex items-center gap-3">
                        {/* Radio circle */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                            isSelectedTemp ? 'border-[#0068ff] bg-white' : 'border-gray-400'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isExpired) {
                              if (isSelectedTemp) {
                                setTempSelectedOptions(tempSelectedOptions.filter(i => i !== index));
                              } else {
                                if (selectedPoll.isMultipleChoice) {
                                  setTempSelectedOptions([...tempSelectedOptions, index]);
                                } else {
                                  setTempSelectedOptions([index]);
                                }
                              }
                            }
                          }}
                        >
                          {isSelectedTemp && <div className="w-2.5 h-2.5 rounded-full bg-[#0068ff]" />}
                        </div>
                        {/* Option bar */}
                        <div
                          className="flex-1 relative rounded-lg overflow-hidden cursor-pointer"
                          style={{ minHeight: 44 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isExpired) {
                              if (isSelectedTemp) {
                                setTempSelectedOptions(tempSelectedOptions.filter(i => i !== index));
                              } else {
                                if (selectedPoll.isMultipleChoice) {
                                  setTempSelectedOptions([...tempSelectedOptions, index]);
                                } else {
                                  setTempSelectedOptions([index]);
                                }
                              }
                            }
                          }}
                        >
                          <div className="absolute inset-0 bg-[#f0f2f5] rounded-lg" />
                          {voteCount > 0 && (
                            <div
                              className="absolute left-0 top-0 bottom-0 bg-[#c8deff] rounded-lg transition-[width] duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          )}
                          <div className="relative flex items-center justify-between px-3 h-[44px]">
                            <span className={`text-[14px] font-medium ${isSelectedTemp ? 'text-[#0068ff]' : 'text-[#050505]'}`}>
                              {option.text}
                            </span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {!selectedPoll.isAnonymous && voteCount > 0 && (
                                <div className="flex -space-x-2">
                                  {voterAvatars?.map((m, i) => (
                                    m?.avatar ? (
                                      <img key={i} src={m.avatar} alt={m.name} className="w-6 h-6 rounded-full border-2 border-white object-cover" />
                                    ) : (
                                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-[10px] text-white font-bold">
                                        {(m?.name || '?').charAt(0).toUpperCase()}
                                      </div>
                                    )
                                  ))}
                                </div>
                              )}
                              <span className="text-[13px] text-gray-600 font-medium w-4 text-right">{voteCount}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Thêm lựa chọn mới */}
                  {selectedPoll.canAddOptions && (
                    <>
                      {tempNewOptionsInView.map((newOpt, idx) => {
                        const isDuplicateWithOld = selectedPoll.options.some(opt => opt.text.trim().toLowerCase() === newOpt.text.trim().toLowerCase());
                        const isDuplicateWithOtherNew = tempNewOptionsInView.some((other, i) => i !== idx && other.text.trim() && other.text.trim().toLowerCase() === newOpt.text.trim().toLowerCase());
                        const isDuplicate = newOpt.text.trim() && (isDuplicateWithOld || isDuplicateWithOtherNew);
                        return (
                          <div key={idx} className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  placeholder={`Lựa chọn ${selectedPoll.options.length + idx + 1}`}
                                  value={newOpt.text}
                                  onChange={(e) => {
                                    const updated = [...tempNewOptionsInView];
                                    updated[idx].text = e.target.value;
                                    setTempNewOptionsInView(updated);
                                  }}
                                  className={`w-full px-3 py-2.5 pr-9 text-[14px] border rounded-lg outline-none transition-all bg-white ${
                                    isDuplicate ? 'border-red-400 text-red-500' : 'border-[#0068ff]'
                                  }`}
                                  autoFocus={idx === tempNewOptionsInView.length - 1}
                                />
                                <button
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTempNewOptionsInView(tempNewOptionsInView.filter((_, i) => i !== idx));
                                  }}
                                >
                                  <FaTimes size={13} />
                                </button>
                              </div>
                            </div>
                            {isDuplicate && (
                              <div className="ml-8 text-[12px] text-red-500">Phương án đã tồn tại</div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAddOptionInView(); }}
                        className="flex items-center gap-1.5 text-[#0068ff] bg-transparent border-none font-semibold text-[14px] cursor-pointer hover:underline px-0 py-1 ml-8 mt-1"
                      >
                        <span className="text-lg font-normal">+</span> Thêm lựa chọn
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Footer Actions */}
              <div className="px-5 py-4 border-t border-[#f0f2f5] flex items-center justify-between bg-white">
                <div className="relative">
                  <button
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-[#65676b] bg-[#f0f2f5] hover:bg-[#e4e6eb] transition-all ${showPollMenu ? 'bg-blue-50 text-[#0068ff]' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setShowPollMenu(!showPollMenu); }}
                  >
                    <FaCog size={20} />
                  </button>
                  {showPollMenu && (
                    <div
                      className="absolute bottom-full left-0 mb-2 w-[210px] bg-white rounded-xl shadow-2xl border border-[#e4e6eb] py-1 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="w-full px-4 py-3 text-left text-[14px] text-[#050505] hover:bg-[#f0f2f5] border-none bg-transparent cursor-pointer"
                        onClick={() => handleSendPollToChat(selectedPoll)}
                      >Gửi vào nhóm</button>
                      <button
                        className="w-full px-4 py-3 text-left text-[14px] text-[#050505] hover:bg-[#f0f2f5] border-none bg-transparent cursor-pointer"
                        onClick={() => handleLockPoll(selectedPoll.pollID)}
                      >Khóa bình chọn</button>
                      {selectedPoll.creatorID === userID && (
                        <button
                          className="w-full px-4 py-3 text-left text-[14px] text-red-500 hover:bg-red-50 border-none bg-transparent cursor-pointer"
                          onClick={() => handleDeletePoll(selectedPoll.pollID)}
                        >Xóa bình chọn</button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    className="py-2.5 px-7 rounded-xl text-[14px] font-semibold bg-[#f0f2f5] text-[#050505] hover:bg-[#e4e6eb] transition-all"
                    onClick={(e) => { e.stopPropagation(); handleBackToList(); }}
                  >Hủy</button>
                  <button
                    className={`py-2.5 px-7 rounded-xl text-[14px] font-semibold text-white transition-all ${
                      hasChanges && !isSaving ? 'bg-[#0068ff] hover:bg-[#0056d6] cursor-pointer' : 'bg-[#bed9ff] cursor-not-allowed'
                    }`}
                    disabled={isSaving || !hasChanges || tempNewOptionsInView.some((newOpt, idx) => {
                      const isDupOld = selectedPoll.options.some(opt => opt.text.trim().toLowerCase() === newOpt.text.trim().toLowerCase());
                      const isDupNew = tempNewOptionsInView.some((other, i) => i !== idx && other.text.trim() && other.text.trim().toLowerCase() === newOpt.text.trim().toLowerCase());
                      return newOpt.text.trim() && (isDupOld || isDupNew);
                    })}
                    onClick={async (e) => { e.stopPropagation(); if (!isSaving) await handleSubmitVotes(); }}
                  >{isSaving ? 'Đang gửi...' : 'Xác nhận'}</button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* Poll Voters Modal */}
          {showVotersModal && selectedPoll && (
            <PollVotersModal
              poll={selectedPoll}
              members={members}
              userID={userID}
              groupID={groupID}
              onClose={() => setShowVotersModal(false)}
            />
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[2000] p-4 animate-fade-in group-board-modal-overlay"
          onClick={(e) => { e.stopPropagation(); setShowConfirmModal(false); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
          <div
            className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl relative z-10 overflow-hidden animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${confirmModalConfig.type === 'danger' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-[#0084ff]'
                  }`}>
                  {confirmModalConfig.type === 'danger' ? '⚠️' : 'ℹ️'}
                </div>
                <h3 className="text-[18px] font-bold text-[#050505] m-0">{confirmModalConfig.title}</h3>
              </div>
              <p className="text-[15px] text-[#65676b] leading-relaxed m-0">
                {confirmModalConfig.message}
              </p>
            </div>
            <div className="bg-[#f0f2f5] p-4 flex gap-3 justify-end border-t border-[#e4e6eb]">
              <button
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-[#050505] border border-[#e4e6eb] cursor-pointer transition-all hover:bg-[#f2f2f2]"
                onClick={(e) => { e.stopPropagation(); setShowConfirmModal(false); }}
              >
                Tiếp tục
              </button>
              <button
                className={`px-6 py-2.5 rounded-lg text-sm font-bold text-white border-none cursor-pointer transition-all ${confirmModalConfig.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#0084ff] hover:bg-[#0073e6]'
                  }`}
                onClick={(e) => { e.stopPropagation(); confirmModalConfig.onConfirm(); }}
              >
                {confirmModalConfig.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupBoardModal;
