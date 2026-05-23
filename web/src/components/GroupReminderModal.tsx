import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FaTimes, FaBell, FaTrash, FaClock, FaCheck, FaBan,
  FaUsers, FaChevronDown, FaChevronUp, FaUser,
} from 'react-icons/fa';
import axiosInstance from '../utils/axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';

export interface GroupReminderParticipant {
  userID: string;
  name: string;
  avatar?: string;
  status: 'joined' | 'declined' | 'pending';
  updatedAt: string;
}

export interface GroupReminder {
  reminderID: string;
  groupID: string;
  creatorID: string;
  title: string;
  datetime: string;
  repeat: 'none' | 'daily' | 'weekly';
  note?: string;
  participants: GroupReminderParticipant[];
  done: boolean;
  createdAt: string;
}

const repeatLabel: Record<GroupReminder['repeat'], string> = {
  none: 'Không lặp',
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${dd}/${mm}/${d.getFullYear()} lúc ${hh}:${min}`;
};

const defaultDatetime = () => {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
};

interface Props {
  groupID: string;
  userID: string;
  onClose: () => void;
  initialReminder?: GroupReminder;
}

type Tab = 'list' | 'create';
type DetailView = GroupReminder | null;

const GroupReminderModal = ({ groupID, userID, onClose, initialReminder }: Props) => {
  const [reminders, setReminders] = useState<GroupReminder[]>([]);
  const [tab, setTab] = useState<Tab>('list');
  const [loading, setLoading] = useState(false);
  // Nếu có initialReminder, mở thẳng detail view ngay từ đầu
  const [detailReminder, setDetailReminder] = useState<DetailView>(initialReminder ?? null);

  // Form
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState(defaultDatetime());
  const [repeat, setRepeat] = useState<GroupReminder['repeat']>('none');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const fetchReminders = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/group-reminders/${groupID}`);
      setReminders(res.data);
    } catch {
      // silent
    }
  }, [groupID]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Real-time socket
  useEffect(() => {
    const onCreated = (reminder: GroupReminder) => {
      if (reminder.groupID === groupID) {
        setReminders((prev) => {
          const exists = prev.find((r) => r.reminderID === reminder.reminderID);
          return exists ? prev.map((r) => r.reminderID === reminder.reminderID ? reminder : r) : [...prev, reminder];
        });
      }
    };

    const onUpdated = (reminder: GroupReminder) => {
      if (reminder.groupID === groupID) {
        setReminders((prev) => prev.map((r) => r.reminderID === reminder.reminderID ? reminder : r));
        setDetailReminder((prev) => prev?.reminderID === reminder.reminderID ? reminder : prev);
      }
    };

    const onDeleted = ({ reminderID }: { reminderID: string }) => {
      setReminders((prev) => prev.filter((r) => r.reminderID !== reminderID));
      setDetailReminder((prev) => prev?.reminderID === reminderID ? null : prev);
    };

    socket.on('group_reminder_created', onCreated);
    socket.on('group_reminder_updated', onUpdated);
    socket.on('group_reminder_deleted', onDeleted);

    return () => {
      socket.off('group_reminder_created', onCreated);
      socket.off('group_reminder_updated', onUpdated);
      socket.off('group_reminder_deleted', onDeleted);
    };
  }, [groupID]);

  const handleCreate = async () => {
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề'); return; }
    if (new Date(datetime) <= new Date()) { setError('Thời gian phải ở tương lai'); return; }

    setLoading(true);
    try {
      socket.emit('create_group_reminder', {
        groupID,
        creatorID: userID,
        title: title.trim(),
        datetime: new Date(datetime).toISOString(),
        repeat,
        note: note.trim(),
      });
      setTitle(''); setDatetime(defaultDatetime()); setRepeat('none'); setNote(''); setError('');
      setTab('list');
      toast.success('Đã tạo nhắc hẹn');
    } catch {
      setError('Không thể tạo nhắc hẹn');
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = (reminderID: string, status: 'joined' | 'declined') => {
    socket.emit('group_reminder_rsvp', { reminderID, userID, status });
  };

  const handleDelete = (reminderID: string) => {
    if (!confirm('Bạn có chắc muốn xóa nhắc hẹn này?')) return;
    socket.emit('delete_group_reminder', { reminderID, userID });
    if (detailReminder?.reminderID === reminderID) setDetailReminder(null);
  };

  const upcoming = reminders.filter((r) => !r.done && new Date(r.datetime) > new Date())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const past = reminders.filter((r) => r.done || new Date(r.datetime) <= new Date())
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, 5);

  // Detail view
  if (detailReminder) {
    return createPortal(
      <DetailModal
        reminder={detailReminder}
        userID={userID}
        onClose={() => setDetailReminder(null)}
        onRSVP={handleRSVP}
        onDelete={handleDelete}
      />,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[440px] flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
            <FaBell className="text-blue-500 text-sm" />
          </div>
          <span className="flex-1 text-[15px] font-bold text-gray-900">Nhắc hẹn nhóm</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <FaTimes className="text-xs" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {(['list', 'create'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors border-b-2 ${tab === t ? 'text-blue-500 border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
              {t === 'list' ? `Danh sách${reminders.length ? ` (${reminders.length})` : ''}` : '+ Tạo mới'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Tab tạo mới */}
          {tab === 'create' && (
            <div className="px-5 py-4 flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Tiêu đề</label>
                <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }}
                  placeholder="Ví dụ: Họp nhóm, Sinh nhật..." maxLength={100} autoFocus
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-gray-900 placeholder:text-gray-400 transition-all" />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Thời gian</label>
                <input type="datetime-local" value={datetime} onChange={(e) => { setDatetime(e.target.value); setError(''); }}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-gray-900 transition-all" />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Lặp lại</label>
                <div className="flex gap-2">
                  {(['none', 'daily', 'weekly'] as GroupReminder['repeat'][]).map((r) => (
                    <button key={r} onClick={() => setRepeat(r)}
                      className={`flex-1 py-2 rounded-xl text-[12.5px] font-medium border-2 transition-all ${repeat === r ? 'bg-blue-500 text-white border-blue-500 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                      {repeatLabel[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Ghi chú (tùy chọn)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300}
                  placeholder="Thêm ghi chú cho nhắc hẹn..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-gray-900 placeholder:text-gray-400 transition-all resize-none" />
              </div>

              {error && <p className="text-[12px] text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button onClick={handleCreate} disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-500 text-white text-[14px] font-bold hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Đang tạo...' : 'Tạo nhắc hẹn'}
              </button>
            </div>
          )}

          {/* Tab danh sách */}
          {tab === 'list' && (
            <div className="px-5 py-4 flex flex-col gap-3">
              {upcoming.length === 0 && past.length === 0 && (
                <div className="flex flex-col items-center py-10 gap-3 text-gray-400">
                  <FaBell className="text-4xl opacity-20" />
                  <p className="text-sm">Chưa có nhắc hẹn nào</p>
                  <button onClick={() => setTab('create')} className="text-[13px] text-blue-500 font-semibold hover:underline">
                    Tạo nhắc hẹn đầu tiên →
                  </button>
                </div>
              )}

              {upcoming.length > 0 && (
                <>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sắp tới</p>
                  {upcoming.map((r) => (
                    <ReminderCard key={r.reminderID} reminder={r} userID={userID}
                      onClick={() => setDetailReminder(r)}
                      onRSVP={handleRSVP} onDelete={handleDelete} />
                  ))}
                </>
              )}

              {past.length > 0 && (
                <>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-2">Đã qua</p>
                  {past.map((r) => (
                    <ReminderCard key={r.reminderID} reminder={r} userID={userID} isPast
                      onClick={() => setDetailReminder(r)}
                      onRSVP={handleRSVP} onDelete={handleDelete} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Card component ──────────────────────────────────────────────────────────
const ReminderCard = ({
  reminder, userID, isPast, onClick, onRSVP, onDelete,
}: {
  reminder: GroupReminder;
  userID: string;
  isPast?: boolean;
  onClick: () => void;
  onRSVP: (id: string, status: 'joined' | 'declined') => void;
  onDelete: (id: string) => void;
}) => {
  const myStatus = reminder.participants.find((p) => p.userID === userID)?.status || 'pending';
  const joined = reminder.participants.filter((p) => p.status === 'joined');
  const declined = reminder.participants.filter((p) => p.status === 'declined');
  const pending = reminder.participants.filter((p) => p.status === 'pending');

  return (
    <div className={`rounded-xl border transition-colors ${isPast ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
      {/* Main info - clickable */}
      <button onClick={onClick} className="w-full text-left p-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
          <FaBell className="text-blue-500 text-xs" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold truncate ${isPast ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {reminder.title}
          </p>
          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
            <FaClock className="text-[9px]" />
            {formatDate(reminder.datetime)}
            {reminder.repeat !== 'none' && (
              <span className="ml-1 bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded-full text-[10px]">
                {repeatLabel[reminder.repeat]}
              </span>
            )}
          </p>
          {/* Participant summary */}
          <div className="flex items-center gap-2 mt-1.5">
            {joined.length > 0 && (
              <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <FaCheck className="text-[8px]" /> {joined.length} tham gia
              </span>
            )}
            {declined.length > 0 && (
              <span className="text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <FaBan className="text-[8px]" /> {declined.length} từ chối
              </span>
            )}
            {pending.length > 0 && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <FaClock className="text-[8px]" /> {pending.length} chờ
              </span>
            )}
          </div>
        </div>
      </button>

      {/* RSVP buttons */}
      {!isPast && (
        <div className="px-3 pb-3 flex items-center gap-2">
          <button
            onClick={() => onRSVP(reminder.reminderID, 'joined')}
            className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${myStatus === 'joined' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
            <FaCheck className="text-[10px]" /> Tham gia
          </button>
          <button
            onClick={() => onRSVP(reminder.reminderID, 'declined')}
            className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center gap-1 ${myStatus === 'declined' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
            <FaBan className="text-[10px]" /> Từ chối
          </button>
          <button onClick={() => onDelete(reminder.reminderID)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
            <FaTrash className="text-[10px]" />
          </button>
        </div>
      )}
    </div>
  );
};

// ── Detail Modal ────────────────────────────────────────────────────────────
const DetailModal = ({
  reminder, userID, onClose, onRSVP, onDelete,
}: {
  reminder: GroupReminder;
  userID: string;
  onClose: () => void;
  onRSVP: (id: string, status: 'joined' | 'declined') => void;
  onDelete: (id: string) => void;
}) => {
  const [expandSection, setExpandSection] = useState<'joined' | 'declined' | 'pending' | null>('joined');
  const myStatus = reminder.participants.find((p) => p.userID === userID)?.status || 'pending';
  const joined = reminder.participants.filter((p) => p.status === 'joined');
  const declined = reminder.participants.filter((p) => p.status === 'declined');
  const pending = reminder.participants.filter((p) => p.status === 'pending');
  const isPast = new Date(reminder.datetime) <= new Date();

  const sections = [
    { key: 'joined' as const, label: 'Tham gia', count: joined.length, color: 'text-green-600', bg: 'bg-green-50', items: joined },
    { key: 'declined' as const, label: 'Từ chối', count: declined.length, color: 'text-red-500', bg: 'bg-red-50', items: declined },
    { key: 'pending' as const, label: 'Chưa xác nhận', count: pending.length, color: 'text-gray-500', bg: 'bg-gray-50', items: pending },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[440px] flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <FaTimes className="text-xs" />
          </button>
          <span className="flex-1 text-[15px] font-bold text-gray-900">Chi tiết nhắc hẹn</span>
          {(reminder.creatorID === userID) && (
            <button onClick={() => { onDelete(reminder.reminderID); onClose(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors">
              <FaTrash className="text-xs" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Info */}
          <div className="bg-blue-50 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <FaBell className="text-blue-500 text-base" />
              <p className="text-[15px] font-bold text-gray-900">{reminder.title}</p>
            </div>
            <p className="text-[12px] text-gray-500 flex items-center gap-1">
              <FaClock className="text-[10px]" />
              {formatDate(reminder.datetime)}
              {reminder.repeat !== 'none' && (
                <span className="ml-1 bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded-full text-[10px]">
                  {repeatLabel[reminder.repeat]}
                </span>
              )}
            </p>
            {reminder.note && (
              <p className="text-[12px] text-gray-600 bg-white rounded-lg px-3 py-2 mt-1">{reminder.note}</p>
            )}
          </div>

          {/* RSVP buttons */}
          {!isPast && (
            <div className="flex gap-2">
              <button onClick={() => onRSVP(reminder.reminderID, 'joined')}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${myStatus === 'joined' ? 'bg-green-500 text-white shadow-sm' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                <FaCheck className="text-[11px]" />
                {myStatus === 'joined' ? 'Đã tham gia' : 'Tham gia'}
              </button>
              <button onClick={() => onRSVP(reminder.reminderID, 'declined')}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-1.5 ${myStatus === 'declined' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                <FaBan className="text-[11px]" />
                {myStatus === 'declined' ? 'Đã từ chối' : 'Từ chối'}
              </button>
            </div>
          )}

          {/* Participant sections */}
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FaUsers className="text-[10px]" /> Danh sách thành viên
            </p>
            {sections.map((s) => (
              <div key={s.key} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandSection(expandSection === s.key ? null : s.key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className={`text-[13px] font-semibold ${s.color}`}>
                    {s.label} ({s.count})
                  </span>
                  {expandSection === s.key ? <FaChevronUp className="text-[10px] text-gray-400" /> : <FaChevronDown className="text-[10px] text-gray-400" />}
                </button>
                {expandSection === s.key && (
                  <div className={`${s.bg} px-3 py-2 flex flex-col gap-2`}>
                    {s.items.length === 0 ? (
                      <p className="text-[12px] text-gray-400 text-center py-2">Chưa có ai</p>
                    ) : (
                      s.items.map((p) => (
                        <div key={p.userID} className="flex items-center gap-2">
                          {p.avatar ? (
                            <img src={p.avatar} alt={p.name} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                              <FaUser className="text-gray-400 text-[10px]" />
                            </div>
                          )}
                          <span className="text-[13px] text-gray-700 font-medium">
                            {p.name}{p.userID === userID ? ' (bạn)' : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupReminderModal;
