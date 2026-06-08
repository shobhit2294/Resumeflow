const express = require('express');
const Reminder = require('../models/Reminder');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/reminders
router.get('/', async (req, res, next) => {
  try {
    const { completed, upcoming } = req.query;
    const filter = { user: req.user._id };

    if (completed === 'false') filter.completed = false;
    if (completed === 'true') filter.completed = true;
    if (upcoming === 'true') {
      filter.dueDate = { $gte: new Date() };
      filter.completed = false;
    }

    const reminders = await Reminder.find(filter)
      .populate('job', 'company role')
      .sort({ dueDate: 1 });

    res.json({ reminders });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders
router.post('/', async (req, res, next) => {
  try {
    const { title, description, dueDate, type, priority, jobId } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: 'Title and due date are required.' });
    }

    const reminder = await Reminder.create({
      user: req.user._id,
      job: jobId || null,
      title,
      description,
      dueDate,
      type,
      priority,
    });

    await reminder.populate('job', 'company role');
    res.status(201).json({ reminder });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reminders/:id/complete
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { completed: true, completedAt: new Date() },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ error: 'Reminder not found.' });
    res.json({ reminder });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Reminder.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Reminder deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
