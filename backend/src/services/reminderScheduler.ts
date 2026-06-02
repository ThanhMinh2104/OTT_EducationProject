import { Server } from 'socket.io';
import Reminder from '../models/Reminder';
import GroupReminder from '../models/GroupReminder';
import GroupMember from '../models/GroupMember';

/**
 * Chạy mỗi 60 giây, tìm các reminder đến giờ và emit socket event
 * Hoạt động cho cả chat 1-1 và group
 */
export function startReminderScheduler(io: Server) {
  const INTERVAL_MS = 60 * 1000; // 60 giây
  const WINDOW_MS = 60 * 1000;   // Cửa sổ check: [now, now + 60s]

  setInterval(async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + WINDOW_MS);

    try {
      // ── Chat 1-1 reminders ──────────────────────────────────────────
      const dueReminders = await Reminder.find({
        done: false,
        datetime: { $gte: now, $lt: windowEnd },
      });

      for (const reminder of dueReminders) {
        const payload = {
          type: 'chat' as const,
          reminderID: reminder.reminderID,
          chatID: reminder.chatID,
          title: reminder.title,
          datetime: reminder.datetime,
        };

        // Emit tới chat room (cả 2 người trong chat đều nhận)
        io.to(reminder.chatID).emit('reminder_due', payload);

        // Nếu repeat = none → mark done
        if (reminder.repeat === 'none') {
          reminder.done = true;
          await reminder.save();
        } else if (reminder.repeat === 'daily') {
          reminder.datetime = new Date(reminder.datetime.getTime() + 24 * 60 * 60 * 1000);
          await reminder.save();
        } else if (reminder.repeat === 'weekly') {
          reminder.datetime = new Date(reminder.datetime.getTime() + 7 * 24 * 60 * 60 * 1000);
          await reminder.save();
        }
      }

      // ── Group reminders ─────────────────────────────────────────────
      const dueGroupReminders = await GroupReminder.find({
        done: false,
        datetime: { $gte: now, $lt: windowEnd },
      });

      for (const reminder of dueGroupReminders) {
        const payload = {
          type: 'group' as const,
          reminderID: reminder.reminderID,
          groupID: reminder.groupID,
          title: reminder.title,
          datetime: reminder.datetime,
        };

        // Emit tới group room
        io.to(reminder.groupID).emit('reminder_due', payload);

        // Emit cá nhân tới từng thành viên joined (để mobile nhận khi không trong room)
        const members = await GroupMember.find({ groupID: reminder.groupID, isActive: true });
        for (const member of members) {
          io.to(member.userID).emit('reminder_due', payload);
        }

        if (reminder.repeat === 'none') {
          reminder.done = true;
          await reminder.save();
        } else if (reminder.repeat === 'daily') {
          reminder.datetime = new Date(reminder.datetime.getTime() + 24 * 60 * 60 * 1000);
          await reminder.save();
        } else if (reminder.repeat === 'weekly') {
          reminder.datetime = new Date(reminder.datetime.getTime() + 7 * 24 * 60 * 60 * 1000);
          await reminder.save();
        }
      }
    } catch (err) {
      console.error('❌ Reminder scheduler error:', err);
    }
  }, INTERVAL_MS);

  console.log('⏰ Reminder scheduler started (interval: 60s)');
}
