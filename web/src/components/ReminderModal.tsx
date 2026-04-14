import { useState, useEffect } from 'react';
import { FaTimes, FaBell, FaTrash, FaClock } from 'react-icons/fa';
import {
  loadReminders,
  createReminder,
  deleteReminder,
  formatReminderDate,
  type Reminder,
} from '../hooks/useReminderChecker';

const defaultDatetime = () => {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
};

const repeatLabel: Record<Reminder['repeat'], string> = {
  none: 'Không lặp',
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
};

interface Props {
  chatID: string;
  userID: string;
  userName: string;
  onClose: () => void;
  onCreated: (reminder: Reminder) => void;
  onDeleted: (reminder: Reminder) => void;
}

const ReminderModal = ({ chatID, userID, userName, onClose, onCreated, onDeleted }: Props) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState(defaultDatetime());
  const [repeat, setRepeat] = useState<Reminder['repeat']>('none');
  const [error, setError] = useState('');

  // Load reminders from API
  useEffect(() => {
    loadReminders(chatID).then((data) => {
      setReminders(data);
    });
  }, [chatID]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề');
      return;
    }
    if (new Date(datetime) <= new Date()) {
      setError('Thời gian phải ở tương lai');
      return;
    }

    setLoading(true);
    const result = await createReminder(
      chatID,
      userID,
      userName,
      title.trim(),
      new Date(datetime).toISOString(),
      repeat
    );
    setLoading(false);

    if (result) {
      setReminders((prev) => [...prev, result.reminder]);
      onCreated(result.reminder);

      setTitle('');
      setDatetime(defaultDatetime());
      setRepeat('none');
      setError('');
      setTab('list');
    } else {
      setError('Không thể tạo nhắc hẹn. Vui lòng thử lại.');
    }
  };

  const handleDelete = async (r: Reminder) => {
    const success = await deleteReminder(r.reminderID, userID, userName, chatID);
    if (success) {
      setReminders((prev) => prev.filter((x) => x.reminderID !== r.reminderID));
      onDeleted(r);
    }
  };

  const upcoming = reminders
    .filter((r) => !r.done && new Date(r.datetime) > new Date())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const past = reminders
    .filter((r) => r.done || new Date(r.datetime) <= new Date())
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[420px] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <FaBell className="text-red-400 text-sm" />
          </div>
          <span className="flex-1 text-[15px] font-bold text-gray-900 dark:text-gray-100">
            Nhắc hẹn
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0">
          {(['list', 'create'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors border-b-2 ${
                tab === t
                  ? 'text-[#0e9de8] border-[#0e9de8]'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {t === 'list'
                ? `Danh sách${reminders.length ? ` (${reminders.length})` : ''}`
                : '+ Tạo mới'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Tab tạo mới */}
          {tab === 'create' && (
            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Tiêu đề */}
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">
                  Tiêu đề nhắc hẹn
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setError('');
                  }}
                  placeholder="Ví dụ: Họp nhóm, Gọi điện cho bạn..."
                  maxLength={100}
                  autoFocus
                  className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-[#0e9de8] focus:ring-2 focus:ring-[#0e9de8]/10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 transition-all"
                />
              </div>

              {/* Thời gian */}
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">
                  Thời gian
                </label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => {
                    setDatetime(e.target.value);
                    setError('');
                  }}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-[#0e9de8] focus:ring-2 focus:ring-[#0e9de8]/10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
                />
              </div>

              {/* Lặp lại */}
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block uppercase tracking-wide">
                  Lặp lại
                </label>
                <div className="flex gap-2">
                  {(['none', 'daily', 'weekly'] as Reminder['repeat'][]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRepeat(r)}
                      className={`flex-1 py-2 rounded-xl text-[12.5px] font-medium border-2 transition-all ${
                        repeat === r
                          ? 'bg-[#0e9de8] text-white border-[#0e9de8] shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#0e9de8]/50'
                      }`}
                    >
                      {repeatLabel[r]}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              {/* Preview card */}
              {title && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex flex-col items-center gap-2 border border-gray-100 dark:border-gray-700">
                  <FaBell className="text-red-400 text-xl" />
                  <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100 text-center">
                    {title}
                  </p>
                  <p className="text-[12px] text-gray-500 flex items-center gap-1">
                    <FaClock className="text-[10px]" />
                    {formatReminderDate(datetime || new Date().toISOString())}
                  </p>
                  {repeat !== 'none' && (
                    <span className="text-[11px] bg-blue-100 dark:bg-blue-900/40 text-[#0e9de8] px-2 py-0.5 rounded-full">
                      {repeatLabel[repeat]}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#0e9de8] text-white text-[14px] font-bold hover:bg-[#0077c2] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
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
                  <button
                    onClick={() => setTab('create')}
                    className="text-[13px] text-[#0e9de8] font-semibold hover:underline"
                  >
                    Tạo nhắc hẹn đầu tiên →
                  </button>
                </div>
              )}

              {upcoming.length > 0 && (
                <>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Sắp tới
                  </p>
                  {upcoming.map((r) => (
                    <ReminderCard key={r.reminderID} reminder={r} onDelete={() => handleDelete(r)} />
                  ))}
                </>
              )}

              {past.length > 0 && (
                <>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-2">
                    Đã qua
                  </p>
                  {past.map((r) => (
                    <ReminderCard
                      key={r.reminderID}
                      reminder={r}
                      onDelete={() => handleDelete(r)}
                      isPast
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReminderCard = ({
  reminder,
  onDelete,
  isPast,
}: {
  reminder: Reminder;
  onDelete: () => void;
  isPast?: boolean;
}) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
      isPast
        ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 opacity-60'
        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'
    }`}
  >
    <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
      <FaBell className="text-red-400 text-xs" />
    </div>
    <div className="flex-1 min-w-0">
      <p
        className={`text-[13px] font-semibold truncate ${
          isPast ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {reminder.title}
      </p>
      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
        <FaClock className="text-[9px]" />
        {formatReminderDate(reminder.datetime)}
        {reminder.repeat !== 'none' && (
          <span className="ml-1 bg-blue-100 dark:bg-blue-900/40 text-[#0e9de8] px-1.5 py-0.5 rounded-full text-[10px]">
            {reminder.repeat === 'daily' ? 'Hàng ngày' : 'Hàng tuần'}
          </span>
        )}
      </p>
    </div>
    <button
      onClick={onDelete}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
    >
      <FaTrash className="text-[10px]" />
    </button>
  </div>
);

export default ReminderModal;
