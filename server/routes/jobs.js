const express = require('express');
const { body, validationResult } = require('express-validator');
const Job = require('../models/Job');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];

// Stage metadata for auto-generated timeline messages
const STAGE_META = {
  Applied:   { icon: '📝', message: 'Application submitted' },
  Screening: { icon: '📞', message: 'Moved to recruiter screening' },
  Interview: { icon: '🎯', message: 'Interview stage reached' },
  Offer:     { icon: '🎉', message: 'Offer received!' },
  Rejected:  { icon: '❌', message: 'Application rejected' },
  Withdrawn: { icon: '↩️', message: 'Application withdrawn' },
};

// GET /api/jobs
router.get('/', async (req, res, next) => {
  try {
    const { stage, source, priority, search, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = { user: req.user._id };
    if (stage)    filter.stage = stage;
    if (source)   filter.source = source;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { company: { $regex: search, $options: 'i' } },
        { role:    { $regex: search, $options: 'i' } },
      ];
    }
    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };
    const jobs = await Job.find(filter).sort(sort).populate('interviewSessions', 'averageScore status type');
    res.json({ jobs, count: jobs.length });
  } catch (err) { next(err); }
});

// POST /api/jobs
router.post('/',
  [
    body('company').trim().notEmpty().withMessage('Company is required'),
    body('role').trim().notEmpty().withMessage('Role is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
      const job = await Job.create({ ...req.body, user: req.user._id });
      res.status(201).json({ job });
    } catch (err) { next(err); }
  }
);

// GET /api/jobs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, user: req.user._id })
      .populate('interviewSessions');
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (err) { next(err); }
});

// PUT /api/jobs/:id
router.put('/:id', async (req, res, next) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/jobs/:id/stage  — rich stage update with context
// Body: { stage, note, interviewDate, interviewType,
//         offerAmount, offerDeadline, rejectionReason }
// ═══════════════════════════════════════════════════════════════
router.patch('/:id/stage', async (req, res, next) => {
  try {
    const {
      stage, note,
      interviewDate, interviewType,
      offerAmount, offerDeadline,
      rejectionReason,
    } = req.body;

    if (!STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage.' });
    }

    const job = await Job.findOne({ _id: req.params.id, user: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const prevStage = job.stage;
    if (prevStage === stage) {
      return res.status(400).json({ error: `Job is already in ${stage} stage.` });
    }

    // Save previous stage for hook
    job.$locals = { previousStage: prevStage };
    job.stage = stage;

    // Stage-specific fields
    if (stage === 'Interview') {
      if (interviewDate) job.interviewDate = new Date(interviewDate);
      if (interviewType) job.interviewType = interviewType;
    }
    if (stage === 'Offer') {
      if (offerAmount)   job.offerAmount   = Number(offerAmount);
      if (offerDeadline) job.offerDeadline = new Date(offerDeadline);
    }
    if (stage === 'Rejected') {
      if (rejectionReason) job.rejectionReason = rejectionReason;
    }

    // Add user note to timeline if provided
    if (note?.trim()) {
      job.timeline.push({
        event:   note.trim(),
        stage,
        type:    'note',
        addedBy: 'user',
        date:    new Date(),
      });
    }

    // Auto follow-up reminder for screening/interview
    if (stage === 'Screening' && !job.followUpDate) {
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 5);
      job.followUpDate = followUp;
      job.timeline.push({
        event:   'Follow-up reminder set for 5 days',
        stage,
        type:    'custom',
        addedBy: 'system',
        date:    new Date(),
      });
    }

    await job.save();

    res.json({
      job,
      transition: {
        from:    prevStage,
        to:      stage,
        message: STAGE_META[stage]?.message || `Moved to ${stage}`,
      },
    });
  } catch (err) { next(err); }
});

// DELETE /api/jobs/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ message: 'Job deleted successfully.' });
  } catch (err) { next(err); }
});

// POST /api/jobs/:id/notes
router.post('/:id/notes', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Note text is required.' });
    const job = await Job.findOne({ _id: req.params.id, user: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    job.notes.push({ text });
    // Also add note to timeline
    job.timeline.push({
      event:   text,
      type:    'note',
      addedBy: 'user',
      date:    new Date(),
    });
    await job.save();
    res.json({ notes: job.notes, timeline: job.timeline });
  } catch (err) { next(err); }
});

// DELETE /api/jobs/:id/notes/:noteId
router.delete('/:id/notes/:noteId', async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, user: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    job.notes = job.notes.filter(n => n._id.toString() !== req.params.noteId);
    await job.save();
    res.json({ notes: job.notes });
  } catch (err) { next(err); }
});

// POST /api/jobs/:id/timeline
router.post('/:id/timeline', async (req, res, next) => {
  try {
    const { event, note, type } = req.body;
    if (!event) return res.status(400).json({ error: 'Event is required.' });
    const job = await Job.findOne({ _id: req.params.id, user: req.user._id });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    job.timeline.push({ event, note, type: type || 'custom', addedBy: 'user' });
    await job.save();
    res.json({ timeline: job.timeline });
  } catch (err) { next(err); }
});

module.exports = router;