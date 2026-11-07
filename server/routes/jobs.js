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
      // Whitelist allowed fields to prevent mass-assignment
      const {
        company, role, stage, salaryMin, salaryMax, currency, location,
        remote, jobUrl, jobDescription, source, contactName, contactEmail,
        appliedDate, tags, priority, followUpDate,
      } = req.body;
      const job = await Job.create({
        company, role, stage, salaryMin, salaryMax, currency, location,
        remote, jobUrl, jobDescription, source, contactName, contactEmail,
        appliedDate, tags, priority, followUpDate,
        user: req.user._id,
      });
      res.status(201).json({ job });
    } catch (err) { next(err); }
  }
);

// POST /api/jobs/bulk-import — Import multiple jobs from CSV or JSON
router.post('/bulk-import', async (req, res, next) => {
  try {
    const { jobs: importedJobs } = req.body;
    if (!Array.isArray(importedJobs) || importedJobs.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of jobs to import.' });
    }

    const validStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
    const docs = importedJobs.slice(0, 100).map((item) => ({
      company: item.company || 'Unknown Company',
      role: item.role || item.title || 'Unknown Role',
      stage: validStages.includes(item.stage) ? item.stage : 'Applied',
      salaryMin: Number(item.salaryMin) || null,
      salaryMax: Number(item.salaryMax) || null,
      currency: item.currency || 'USD',
      location: item.location || '',
      remote: Boolean(item.remote),
      jobUrl: item.jobUrl || '',
      jobDescription: item.jobDescription || item.description || '',
      source: item.source || 'Other',
      contactName: item.contactName || '',
      contactEmail: item.contactEmail || '',
      appliedDate: item.appliedDate ? new Date(item.appliedDate) : new Date(),
      priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
      tags: Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim()) : []),
      user: req.user._id,
    }));

    const created = await Job.insertMany(docs);
    res.status(201).json({ count: created.length, message: `Successfully imported ${created.length} jobs!` });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, user: req.user._id })
      .populate('interviewSessions');
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (err) { next(err); }
});

// PUT /api/jobs/:id — whitelist fields to prevent mass-assignment
router.put('/:id', async (req, res, next) => {
  try {
    const {
      company, role, stage, salaryMin, salaryMax, currency, location,
      remote, jobUrl, jobDescription, source, contactName, contactEmail,
      appliedDate, tags, priority, followUpDate, interviewDate, interviewType,
      offerAmount, offerDeadline, rejectionReason,
    } = req.body;
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        company, role, stage, salaryMin, salaryMax, currency, location,
        remote, jobUrl, jobDescription, source, contactName, contactEmail,
        appliedDate, tags, priority, followUpDate, interviewDate, interviewType,
        offerAmount, offerDeadline, rejectionReason,
      },
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

    // Save previous stage for hook — merge into $locals instead of replacing
    Object.assign(job.$locals, { previousStage: prevStage });
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