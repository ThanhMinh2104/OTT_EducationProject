import { useEffect } from 'react';
import toast from 'react-hot-toast';
import socket from '../utils/socket';

interface ReminderDuePayload {
  type: 'chat' | 'group';
  reminderID: string;
  chatID?: string;
  groupID?: string;
  title: string;
  datetime: string | Date;
}

export function useReminderNotification() {
  useEffect(() => {
    const handleReminderDue = (payload: ReminderDuePayload) => {
      const label = payload.type === 'group' ? 'Nhóm' : 'Chat';

      toast.custom(
        (t) => (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#34d399',
              color: '#fff',
              fontWeight: '600',
              padding: '14px 16px',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              maxWidth: '360px',
              opacity: t.visible ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            <span style={{ fontSize: '18px' }}>🔔</span>
            <span style={{ flex: 1, fontSize: '14px' }}>
              Nhắc hẹn ({label}): {payload.title}
            </span>
            <button
              onClick={() => toast.dismiss(t.id)}
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '700',
                padding: '2px 7px',
                lineHeight: '1.4',
              }}
            >
              ✕
            </button>
          </div>
        ),
        { duration: 8000, position: 'bottom-right' }
      );
    };

    socket.on('reminder_due', handleReminderDue);
    return () => {
      socket.off('reminder_due', handleReminderDue);
    };
  }, []);
}
