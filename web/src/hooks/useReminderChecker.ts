import { useEffect, useRef } from 'react';

export interface Reminder {
  id: string;
  chatID: string;
  title: string;
  datetime: string;
  repeat: 'none' | 'daily' | 'weekly';
  done: boolean;
}

const STORAGE_KEY = 'ott_reminders';
const EVENTS_KEY = 'ott_reminder_events';

export interface ReminderEvent {
  id: string;
  chatID: string;
  type: 'created' | 'deleted';
  reminder: Reminder;
  userName: string;
  userID: string;
  createdAt: string;
}

export const loadReminders = (): Reminder[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};

export const saveReminders = (list: Reminder[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

export const loadReminderEvents = (chatID: string): ReminderEvent[] => {
  try {
    const all: ReminderEvent[] = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    return all.filter((e) => e.chatID === chatID);
  } catch { return []; }
};

export const saveReminderEvent = (evt: ReminderEvent) => {
  try {
    const all: ReminderEvent[] = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    // Giữ tối đa 50 events mỗi chat
    const filtered = all.filter((e) => e.chatID === evt.chatID);
    const others = all.filter((e) => e.chatID !== evt.chatID);
    const updated = [...others, ...filtered.slice(-49), evt];
    localStorage.setItem(EVENTS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
};

// Format: T6 17/04/2026 lúc 00:01
export const formatReminderDate = (iso: string) => {
  const d = new Date(iso);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${dd}/${mm}/${d.getFullYear()} lúc ${hh}:${min}`;
};

export const useReminderChecker = (onFire: (reminder: Reminder) => void) => {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const check = () => {
      const all = loadReminders();
      const now = new Date();
      all.forEach((r) => {
        if (r.done) return;
        const dt = new Date(r.datetime);
        const diff = now.getTime() - dt.getTime();
        if (diff >= 0 && diff < 60000 && !firedRef.current.has(r.id)) {
          firedRef.current.add(r.id);
          onFire(r);

          if (r.repeat !== 'none') {
            const next = new Date(r.datetime);
            if (r.repeat === 'daily') next.setDate(next.getDate() + 1);
            if (r.repeat === 'weekly') next.setDate(next.getDate() + 7);
            const updated = all.map((x) =>
              x.id === r.id ? { ...x, datetime: next.toISOString() } : x
            );
            saveReminders(updated);
            setTimeout(() => firedRef.current.delete(r.id), 70000);
          }
        }
      });
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [onFire]);
};
