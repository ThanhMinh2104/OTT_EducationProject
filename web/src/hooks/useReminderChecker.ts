import { useEffect, useRef } from 'react';
import axiosInstance from '../utils/axios';

export interface Reminder {
  reminderID: string;
  chatID: string;
  userID: string;
  title: string;
  datetime: string;
  repeat: 'none' | 'daily' | 'weekly';
  done: boolean;
}

export interface ReminderEvent {
  eventID: string;
  chatID: string;
  type: 'created' | 'deleted';
  reminderID: string;
  reminderData: {
    title: string;
    datetime: string;
    repeat: string;
  };
  userName: string;
  userID: string;
  createdAt: string;
}

// Load reminders from API
export const loadReminders = async (chatID: string): Promise<Reminder[]> => {
  try {
    const response = await axiosInstance.get(`/reminders/chat/${chatID}`);
    return response.data;
  } catch (error) {
    console.error('Error loading reminders:', error);
    return [];
  }
};

// Load reminder events from API
export const loadReminderEvents = async (chatID: string): Promise<ReminderEvent[]> => {
  try {
    const response = await axiosInstance.get(`/reminders/events/${chatID}`);
    return response.data;
  } catch (error) {
    console.error('Error loading reminder events:', error);
    return [];
  }
};

// Create reminder via API
export const createReminder = async (
  chatID: string,
  userID: string,
  userName: string,
  title: string,
  datetime: string,
  repeat: 'none' | 'daily' | 'weekly'
): Promise<{ reminder: Reminder; event: ReminderEvent } | null> => {
  try {
    const reminderID = `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const response = await axiosInstance.post('/reminders', {
      reminderID,
      chatID,
      userID,
      userName,
      title,
      datetime,
      repeat,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating reminder:', error);
    return null;
  }
};

// Delete reminder via API
export const deleteReminder = async (
  reminderID: string,
  userID: string,
  userName: string,
  chatID: string
): Promise<boolean> => {
  try {
    await axiosInstance.delete(`/reminders/${reminderID}`, {
      data: { userID, userName, chatID },
    });
    return true;
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return false;
  }
};

// Update reminder via API
export const updateReminder = async (
  reminderID: string,
  updates: Partial<Reminder>
): Promise<Reminder | null> => {
  try {
    const response = await axiosInstance.put(`/reminders/${reminderID}`, updates);
    return response.data;
  } catch (error) {
    console.error('Error updating reminder:', error);
    return null;
  }
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

// Hook to check reminders periodically
export const useReminderChecker = (
  chatID: string | null,
  onFire: (reminder: Reminder) => void
) => {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!chatID) return;

    const check = async () => {
      const reminders = await loadReminders(chatID);
      const now = new Date();
      
      reminders.forEach((r) => {
        if (r.done) return;
        const dt = new Date(r.datetime);
        const diff = now.getTime() - dt.getTime();
        
        // Fire if within 1 minute window and not already fired
        if (diff >= 0 && diff < 60000 && !firedRef.current.has(r.reminderID)) {
          firedRef.current.add(r.reminderID);
          onFire(r);

          // Handle repeat
          if (r.repeat !== 'none') {
            const next = new Date(r.datetime);
            if (r.repeat === 'daily') next.setDate(next.getDate() + 1);
            if (r.repeat === 'weekly') next.setDate(next.getDate() + 7);
            
            updateReminder(r.reminderID, { datetime: next.toISOString() });
            
            // Allow firing again after 70 seconds
            setTimeout(() => firedRef.current.delete(r.reminderID), 70000);
          }
        }
      });
    };

    check();
    const interval = setInterval(check, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [chatID, onFire]);
};
