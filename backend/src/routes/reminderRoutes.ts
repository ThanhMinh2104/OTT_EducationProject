import express from 'express';
import Reminder from '../models/Reminder';
import ReminderEvent from '../models/ReminderEvent';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get all reminders for a chat
router.get('/chat/:chatID', authMiddleware, async (req, res) => {
  try {
    const { chatID } = req.params;
    const reminders = await Reminder.find({ chatID, done: false }).sort({ datetime: 1 });
    res.json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// Get reminder events for a chat (for timeline display)
router.get('/events/:chatID', authMiddleware, async (req, res) => {
  try {
    const { chatID } = req.params;
    const events = await ReminderEvent.find({ chatID })
      .sort({ createdAt: 1 })
      .limit(50);
    res.json(events);
  } catch (error) {
    console.error('Error fetching reminder events:', error);
    res.status(500).json({ error: 'Failed to fetch reminder events' });
  }
});

// Create a new reminder
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { reminderID, chatID, userID, userName, title, datetime, repeat } = req.body;

    // Create reminder
    const reminder = new Reminder({
      reminderID,
      chatID,
      userID,
      title,
      datetime: new Date(datetime),
      repeat: repeat || 'none',
      done: false,
    });
    await reminder.save();

    // Create event for timeline
    const event = new ReminderEvent({
      eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatID,
      type: 'created',
      reminderID,
      reminderData: {
        title,
        datetime: new Date(datetime),
        repeat: repeat || 'none',
      },
      userName,
      userID,
    });
    await event.save();

    res.json({ reminder, event });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// Update reminder (mark as done or update repeat)
router.put('/:reminderID', authMiddleware, async (req, res) => {
  try {
    const { reminderID } = req.params;
    const updates = req.body;

    const reminder = await Reminder.findOneAndUpdate(
      { reminderID },
      updates,
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    res.json(reminder);
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// Delete a reminder
router.delete('/:reminderID', authMiddleware, async (req, res) => {
  try {
    const { reminderID } = req.params;
    const { userID, userName, chatID } = req.body;

    const reminder = await Reminder.findOne({ reminderID });
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Create delete event for timeline
    const event = new ReminderEvent({
      eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatID: chatID || reminder.chatID,
      type: 'deleted',
      reminderID,
      reminderData: {
        title: reminder.title,
        datetime: reminder.datetime,
        repeat: reminder.repeat,
      },
      userName,
      userID,
    });
    await event.save();

    // Delete reminder
    await Reminder.deleteOne({ reminderID });

    res.json({ message: 'Reminder deleted', event });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// Get upcoming reminders (for checking/notifications)
router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60 * 1000); // Next hour

    const reminders = await Reminder.find({
      done: false,
      datetime: { $gte: now, $lte: soon },
    }).sort({ datetime: 1 });

    res.json(reminders);
  } catch (error) {
    console.error('Error fetching upcoming reminders:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming reminders' });
  }
});

export default router;
