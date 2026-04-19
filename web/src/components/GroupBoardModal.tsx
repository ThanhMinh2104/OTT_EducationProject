import { useState, useEffect } from 'react';
import { FaTimes, FaArrowLeft } from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import './GroupBoardModal-animations.css';

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
  question: string;
  options: Array<{
    text: string;
    votes: number;
  }>;
  createdBy: string;
  createdAt: string;
  endDate?: string;
  voters: Array<{
    userID: string;
    optionIndex: number;
  }>;
}

interface GroupBoardModalProps {
  show: boolean;
  onClose: () => void;
  groupID: string;
  userID: string;
  onViewMessage?: (messageID: string) => void;
  onPinLimitReached?: (noteID: string) => void;
  canCreateNotes?: boolean;
}

type TabType = 'all' | 'pinned' | 'notes' | 'polls';
type ViewMode = 'list' | 'create-note' | 'view-note' | 'edit-note';

const GroupBoardModal = ({
  show,
  onClose,
  groupID,
  userID,
  onViewMessage,
  onPinLimitReached,
  canCreateNotes = true,
}: GroupBoardModalProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Form states for create/edit note
  const [noteContent, setNoteContent] = useState('');
  const [notePinToTop, setNotePinToTop] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset to list view when modal closes
  useEffect(() => {
    if (!show) {
      setViewMode('list');
      setSelectedNote(null);
      setNoteContent('');
      setNotePinToTop(false);
    }
  }, [show]);

  useEffect(() => {
    if (show) {
      fetchData();
      
      // Listen for note socket events
      const handleNoteCreated = () => fetchNotes();
      const handleNoteUpdated = () => fetchNotes();
      const handleNoteDeleted = () => fetchNotes();
      const handleNotePinToggled = () => {
        fetchNotes();
        fetchPinnedMessages();
        // After pin toggle, go back to list view if we're in create/edit mode
        if (viewMode === 'create-note' || viewMode === 'edit-note') {
          setViewMode('list');
          setSelectedNote(null);
          setNoteContent('');
          setNotePinToTop(false);
        }
      };

      socket.on('note_created', handleNoteCreated);
      socket.on('note_updated', handleNoteUpdated);
      socket.on('note_deleted', handleNoteDeleted);
      socket.on('note_pin_toggled', handleNotePinToggled);

      return () => {
        socket.off('note_created', handleNoteCreated);
        socket.off('note_updated', handleNoteUpdated);
        socket.off('note_deleted', handleNoteDeleted);
        socket.off('note_pin_toggled', handleNotePinToggled);
      };
    }
  }, [show, activeTab, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'all' || activeTab === 'pinned') {
        await fetchPinnedMessages();
      }
      if (activeTab === 'all' || activeTab === 'notes') {
        await fetchNotes();
      }
      if (activeTab === 'all' || activeTab === 'polls') {
        await fetchPolls();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
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
      // TODO: Implement API endpoint for polls
      setPolls([]);
    } catch (error) {
      console.error('Error fetching polls:', error);
      setPolls([]);
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

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedNote(null);
    setNoteContent('');
    setNotePinToTop(false);
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

  const handleDeleteNote = async (noteID: string) => {
    if (!confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
    
    try {
      await axiosInstance.delete(`/groups/${groupID}/notes/${noteID}`);
      toast.success('Đã xóa ghi chú');
      await fetchNotes();
      await fetchPinnedMessages();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi xóa ghi chú');
    }
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
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#3a3a3a] bg-[#2a2a2a]">
          {viewMode !== 'list' && (
            <button className="flex items-center gap-2 bg-transparent border-none text-[#0084ff] text-sm font-medium cursor-pointer px-3 py-2 rounded-md transition-all hover:bg-[#0084ff]/10" onClick={handleBackToList}>
              <FaArrowLeft /> Quay lại
            </button>
          )}
          <h2 className="text-xl font-semibold text-white m-0">
            {viewMode === 'list' && 'Bảng tin nhóm'}
            {viewMode === 'create-note' && 'Tạo ghi chú'}
            {viewMode === 'view-note' && 'Xem ghi chú'}
            {viewMode === 'edit-note' && 'Chỉnh sửa ghi chú'}
          </h2>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full border-none bg-[#3a3a3a] text-white flex items-center justify-center cursor-pointer transition-all hover:bg-[#4a4a4a] hover:scale-105" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Tabs - only show in list view */}
        {viewMode === 'list' && (
          <div className="flex bg-[#2a2a2a] border-b border-[#3a3a3a]">
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'all' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-[#999] border-b-transparent hover:text-[#0084ff] hover:bg-[#0084ff]/5'
              }`}
              onClick={() => setActiveTab('all')}
            >
              Tất cả
            </button>
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'pinned' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-[#999] border-b-transparent hover:text-[#0084ff] hover:bg-[#0084ff]/5'
              }`}
              onClick={() => setActiveTab('pinned')}
            >
              Tin ghim
            </button>
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'notes' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-[#999] border-b-transparent hover:text-[#0084ff] hover:bg-[#0084ff]/5'
              }`}
              onClick={() => setActiveTab('notes')}
            >
              Ghi chú
            </button>
            <button
              className={`flex-1 px-4 py-3.5 border-none bg-transparent text-sm font-medium cursor-pointer border-b-2 transition-all ${
                activeTab === 'polls' 
                  ? 'text-[#0084ff] border-b-[#0084ff]' 
                  : 'text-[#999] border-b-transparent hover:text-[#0084ff] hover:bg-[#0084ff]/5'
              }`}
              onClick={() => setActiveTab('polls')}
            >
              Bình chọn
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#1a1a1a]">
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-15 px-5">
                  <div className="spinner"></div>
                </div>
              ) : (
                <>
                  {/* Pinned Messages Tab */}
                  {activeTab === 'pinned' && (
                <div>
                  {pinnedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-15 px-5 gap-4">
                      <span className="text-6xl opacity-30">📌</span>
                      <p className="text-base text-[#999] m-0">Chưa có tin ghim</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {pinnedMessages.map((msg) => (
                        <div key={msg.messageID} className="bg-[#2a2a2a] rounded-xl p-4 transition-all hover:bg-[#2f2f2f]">
                          <div className="flex items-center gap-3 mb-3">
                            <img
                              src={msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`}
                              alt="avatar"
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="flex-1">
                              <div className="text-[15px] font-semibold text-white mb-1">{msg.senderInfo?.name || 'Người dùng'}</div>
                              <div className="flex items-center gap-1.5 text-[13px] text-[#999]">
                                <span className="text-sm">📌</span>
                                Tin ghim
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-[#e0e0e0] leading-relaxed mb-3 break-words">{getContentPreview(msg)}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#999]">{formatDateTime(msg.timestamp)}</span>
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
                      <div key={note.noteID} className="bg-[#2a2a2a] rounded-xl p-4 transition-all hover:bg-[#2f2f2f]">
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={note.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${note.creatorID}`}
                            alt="avatar"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <div className="text-[15px] font-semibold text-white mb-1">{note.creatorInfo?.name || 'Người dùng'}</div>
                            <div className="flex items-center gap-1.5 text-[13px] text-[#999]">
                              <span className="text-sm">📝</span>
                              Ghi chú
                            </div>
                          </div>
                          <div className="flex gap-2 ml-auto">
                            <button
                              className="w-8 h-8 rounded-full border-none bg-[#3a3a3a] text-white text-base cursor-pointer transition-all flex items-center justify-center hover:bg-[#4a4a4a] hover:scale-110"
                              onClick={() => handleTogglePinNote(note)}
                              title={note.isPinned ? 'Bỏ ghim' : 'Ghim'}
                            >
                              📌
                            </button>
                            {note.creatorID === userID && (
                              <button
                                className="w-8 h-8 rounded-full border-none bg-[#3a3a3a] text-white text-base cursor-pointer transition-all flex items-center justify-center hover:bg-[#ff3b30] hover:scale-110"
                                onClick={() => handleDeleteNote(note.noteID)}
                                title="Xóa"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-[#e0e0e0] leading-relaxed mb-3 break-words cursor-pointer transition-colors p-2 -m-2 rounded-md hover:bg-white/5" onClick={() => handleViewNote(note)}>
                          {note.content}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#999]">{formatDateTime(note.createdAt)}</span>
                          <button className="text-[13px] text-[#0084ff] bg-transparent border-none cursor-pointer px-2 py-1 rounded transition-all hover:bg-[#0084ff]/10" onClick={() => handleViewNote(note)}>
                            Xem ghi chú
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Create Note Button at bottom */}
                  {canCreateNotes ? (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-linear-to-t from-[#1a1a1a] via-[#1a1a1a]/80 to-transparent z-10">
                    <button className="w-full py-3.5 px-6 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,132,255,0.3)] hover:bg-[#0073e6] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,132,255,0.4)]" onClick={handleCreateNote}>
                      Tạo ghi chú
                    </button>
                  </div>
                  ) : (
                  <div className="sticky bottom-0 left-0 right-0 p-4 bg-linear-to-t from-[#1a1a1a] via-[#1a1a1a]/80 to-transparent z-10">
                    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]">
                      <span className="text-base">🔒</span>
                      <span className="text-sm text-[#999]">Chỉ trưởng nhóm và phó nhóm mới có thể tạo ghi chú</span>
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
                      <p className="text-base text-[#999] m-0">Chưa có bình chọn</p>
                      <button className="py-3 px-6 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#0073e6] hover:-translate-y-px">Tạo bình chọn</button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {polls.map((poll) => {
                        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
                        return (
                          <div key={poll.pollID} className="bg-[#2a2a2a] rounded-xl p-5 transition-all hover:bg-[#2f2f2f]">
                            <div className="text-base font-semibold text-white mb-2">{poll.question}</div>
                            <div className="text-[13px] text-[#999] mb-1">
                              Kết thúc lúc {formatDateTime(poll.endDate || poll.createdAt)}
                            </div>
                            <div className="text-[13px] text-[#0084ff] my-3">{totalVotes} người bình chọn</div>
                            <div className="flex flex-col gap-2 mb-4">
                              {poll.options.map((option, index) => {
                                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                                return (
                                  <div key={index} className="relative bg-[#3a3a3a] rounded-lg overflow-hidden min-h-[44px]">
                                    <div className="absolute left-0 top-0 bottom-0 bg-[#0084ff]/30 transition-[width] duration-300" style={{ width: `${percentage}%` }}></div>
                                    <div className="relative flex items-center justify-between px-4 py-3 z-[1]">
                                      <span className="text-sm text-white">{option.text}</span>
                                      <span className="text-sm font-semibold text-white">{option.votes}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <button className="w-full py-3 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#0073e6]">Bình chọn</button>
                          </div>
                        );
                      })}
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
                      <p className="text-base text-[#999] m-0">Chưa có nội dung được ghim</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                      {/* Combined pinned messages and notes */}
                      {(pinnedMessages.length > 0 || notes.filter(n => n.isPinned).length > 0) && (
                        <div className="flex flex-col gap-3">
                          <h3 className="text-base font-semibold text-white m-0 mb-2">
                            Danh sách ghim ({pinnedMessages.length + notes.filter(n => n.isPinned).length})
                          </h3>
                          <div className="flex flex-col gap-3">
                            {/* Pinned Notes */}
                            {notes.filter(n => n.isPinned).map((note) => (
                              <div key={note.noteID} className="bg-[#2a2a2a] rounded-xl p-4 transition-all hover:bg-[#2f2f2f]">
                                <div className="flex items-center gap-3 mb-3">
                                  <img
                                    src={note.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${note.creatorID}`}
                                    alt="avatar"
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-[15px] font-semibold text-white mb-1">{note.creatorInfo?.name || 'Người dùng'}</div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-[#999]">
                                      <span className="text-sm">📝</span>
                                      Ghi chú
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-[#e0e0e0] leading-relaxed mb-3 break-words cursor-pointer transition-colors p-2 -m-2 rounded-md hover:bg-white/5" onClick={() => handleViewNote(note)}>
                                  {note.content}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-[#999]">{formatDateTime(note.createdAt)}</span>
                                  <button className="text-[13px] text-[#0084ff] bg-transparent border-none cursor-pointer px-2 py-1 rounded transition-all hover:bg-[#0084ff]/10" onClick={() => handleViewNote(note)}>
                                    Xem ghi chú
                                  </button>
                                </div>
                              </div>
                            ))}
                            
                            {/* Pinned Messages */}
                            {pinnedMessages.slice(0, 3).map((msg) => (
                              <div key={msg.messageID} className="bg-[#2a2a2a] rounded-xl p-4 transition-all hover:bg-[#2f2f2f]">
                                <div className="flex items-center gap-3 mb-3">
                                  <img
                                    src={msg.senderInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderID}`}
                                    alt="avatar"
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="text-[15px] font-semibold text-white mb-1">{msg.senderInfo?.name || 'Người dùng'}</div>
                                    <div className="flex items-center gap-1.5 text-[13px] text-[#999]">
                                      <span className="text-sm">📌</span>
                                      Tin nhắn
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-[#e0e0e0] leading-relaxed mb-3 break-words">{getContentPreview(msg)}</div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-[#999]">{formatDateTime(msg.timestamp)}</span>
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
                          <h3 className="text-base font-semibold text-white m-0 mb-2">Bình chọn ({polls.length})</h3>
                          <div className="flex flex-col gap-3">
                            {polls.slice(0, 3).map((poll) => {
                              const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
                              return (
                                <div key={poll.pollID} className="bg-[#2a2a2a] rounded-xl p-5 transition-all hover:bg-[#2f2f2f]">
                                  <div className="text-base font-semibold text-white mb-2">{poll.question}</div>
                                  <div className="text-[13px] text-[#999] mb-1">
                                    Kết thúc lúc {formatDateTime(poll.endDate || poll.createdAt)}
                                  </div>
                                  <div className="text-[13px] text-[#0084ff] my-3">{totalVotes} người bình chọn</div>
                                  <div className="flex flex-col gap-2 mb-4">
                                    {poll.options.map((option, index) => {
                                      const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                                      return (
                                        <div key={index} className="relative bg-[#3a3a3a] rounded-lg overflow-hidden min-h-[44px]">
                                          <div className="absolute left-0 top-0 bottom-0 bg-[#0084ff]/30 transition-[width] duration-300" style={{ width: `${percentage}%` }}></div>
                                          <div className="relative flex items-center justify-between px-4 py-3 z-1">
                                            <span className="text-sm text-white">{option.text}</span>
                                            <span className="text-sm font-semibold text-white">{option.votes}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <button className="w-full py-3 bg-[#0084ff] text-white border-none rounded-lg text-[15px] font-semibold cursor-pointer transition-all hover:bg-[#0073e6]">Bình chọn</button>
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

          {/* CREATE NOTE VIEW */}
          {viewMode === 'create-note' && (
            <div className="p-6 note-form-container">
              <div className="mb-4">
                <label className="block mb-2 text-sm font-semibold text-[#e0e0e0]">Nội dung</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nhập nội dung ghi chú..."
                  rows={10}
                  className="w-full min-h-[200px] p-3 rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] text-[#e0e0e0] text-[15px] font-[inherit] leading-relaxed resize-y transition-all focus:outline-none focus:border-[#0084ff] focus:bg-[#2f2f2f] placeholder:text-[#666]"
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
                <label htmlFor="pin-to-top" className="text-sm text-[#e0e0e0] cursor-pointer select-none">Ghim lên đầu trò chuyện</label>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button 
                  className="py-2.5 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-[#3a3a3a] text-white hover:bg-[#4a4a4a]"
                  onClick={handleBackToList}
                >
                  Đóng
                </button>
                <button 
                  className="py-2.5 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-[#0084ff] text-white hover:bg-[#0073e6] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveNote}
                  disabled={isSaving || !noteContent.trim()}
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          )}

          {/* VIEW NOTE VIEW */}
          {viewMode === 'view-note' && selectedNote && (
            <div className="p-6 note-view-container">
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-[#3a3a3a]">
                <div className="flex items-center gap-3">
                  <img 
                    src={selectedNote.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedNote.creatorID}`}
                    alt="avatar"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {selectedNote.creatorInfo?.name || 'Người dùng'}
                    </div>
                    <div className="text-xs text-[#999] mt-0.5">
                      {formatDateTime(selectedNote.createdAt)}
                    </div>
                  </div>
                </div>
                
                {selectedNote.creatorID === userID && canCreateNotes && (
                  <button 
                    className="px-4 py-2 bg-transparent border border-[#0084ff] rounded-md text-[#0084ff] text-[13px] font-medium cursor-pointer transition-all hover:bg-[#0084ff]/10"
                    onClick={() => handleEditNote(selectedNote)}
                  >
                    Chỉnh sửa
                  </button>
                )}
              </div>
              
              <div className="text-sm leading-relaxed text-[#e0e0e0] whitespace-pre-wrap mb-5 min-h-[100px] break-words">
                {selectedNote.content}
              </div>
              
              <div className="flex gap-3">
                <button 
                  className="flex-1 py-2.5 px-4 border-none rounded-lg text-sm font-medium cursor-pointer transition-all bg-[#0084ff]/10 text-[#0084ff] hover:bg-[#0084ff]/20"
                  onClick={() => handleTogglePinNote(selectedNote)}
                >
                  {selectedNote.isPinned ? '📌 Bỏ ghim' : '📌 Ghim'}
                </button>
                
                {selectedNote.creatorID === userID && (
                  <button 
                    className="flex-1 py-2.5 px-4 border-none rounded-lg text-sm font-medium cursor-pointer transition-all bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/20"
                    onClick={() => handleDeleteNote(selectedNote.noteID)}
                  >
                    🗑️ Xóa
                  </button>
                )}
              </div>
            </div>
          )}

          {/* EDIT NOTE VIEW */}
          {viewMode === 'edit-note' && selectedNote && (
            <div className="p-6 note-form-container">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#3a3a3a]">
                <img
                  src={selectedNote.creatorInfo?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedNote.creatorID}`}
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="text-[13px] text-[#999]">
                    Tạo bởi {selectedNote.creatorInfo?.name || 'Người dùng'} - {formatDateTime(selectedNote.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2 text-sm font-semibold text-[#e0e0e0]">Nội dung</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nhập nội dung ghi chú..."
                  rows={10}
                  className="w-full min-h-[200px] p-3 rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] text-[#e0e0e0] text-[15px] font-[inherit] leading-relaxed resize-y transition-all focus:outline-none focus:border-[#0084ff] focus:bg-[#2f2f2f] placeholder:text-[#666]"
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
                <label htmlFor="pin-to-top-edit" className="text-sm text-[#e0e0e0] cursor-pointer select-none">Ghim lên đầu trò chuyện</label>
              </div>
              
              <div className="flex gap-3 justify-end">
                <button 
                  className="py-2.5 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-[#3a3a3a] text-white hover:bg-[#4a4a4a]"
                  onClick={handleBackToList}
                >
                  Hủy
                </button>
                <button 
                  className="py-2.5 px-6 border-none rounded-lg text-sm font-semibold cursor-pointer transition-all bg-[#0084ff] text-white hover:bg-[#0073e6] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveNote}
                  disabled={isSaving || !noteContent.trim()}
                >
                  {isSaving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupBoardModal;
