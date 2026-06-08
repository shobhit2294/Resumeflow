const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const timelineEventSchema = new mongoose.Schema({
  event:    { type: String, required: true },
  note:     { type: String, default: '' },
  stage:    { type: String, default: '' },
  type:     {
    type: String,
    enum: ['stage_change', 'note', 'interview', 'offer', 'rejection', 'custom'],
    default: 'custom',
  },
  date:     { type: Date, default: Date.now },
  addedBy:  { type: String, default: 'user' }, // user | system
});

const jobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company:    { type: String, required: [true, 'Company name is required'], trim: true },
    role:       { type: String, required: [true, 'Role is required'], trim: true },
    stage: {
      type:    String,
      enum:    ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'],
      default: 'Applied',
    },
    // Progress tracking
    stageHistory: [{
      from:  String,
      to:    String,
      date:  { type: Date, default: Date.now },
      note:  { type: String, default: '' },
    }],
    salaryMin:      { type: Number, default: null },
    salaryMax:      { type: Number, default: null },
    currency:       { type: String, default: 'USD' },
    location:       { type: String, default: '' },
    remote:         { type: Boolean, default: false },
    jobUrl:         { type: String, default: '' },
    jobDescription: { type: String, default: '' },
    source: {
      type:    String,
      enum:    ['LinkedIn', 'Indeed', 'Company site', 'Referral', 'AngelList', 'Glassdoor', 'Remotive', 'Arbeitnow', 'Adzuna', 'JSearch', 'Other'],
      default: 'LinkedIn',
    },
    contactName:       { type: String, default: '' },
    contactEmail:      { type: String, default: '' },
    appliedDate:       { type: Date, default: Date.now },
    resumeMatchScore:  { type: Number, default: null },
    matchedSkills:     [{ skill: String, score: Number }],
    notes:             [noteSchema],
    timeline:          [timelineEventSchema],
    tags:              [{ type: String }],
    priority:          { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    followUpDate:      { type: Date, default: null },
    offerDeadline:     { type: Date, default: null },
    offerAmount:       { type: Number, default: null },
    interviewDate:     { type: Date, default: null },
    interviewType:     { type: String, default: '' },
    rejectionReason:   { type: String, default: '' },
    interviewSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Interview' }],
  },
  { timestamps: true }
);

// ── Auto timeline on stage change ─────────────────────────────
jobSchema.pre('save', function (next) {
  if (this.isNew) {
    this.timeline.push({
      event:   'Application submitted',
      stage:   'Applied',
      type:    'stage_change',
      date:    this.appliedDate || new Date(),
      addedBy: 'system',
    });
  } else if (this.isModified('stage')) {
    const prev = this._previousStage || '';
    this.stageHistory.push({ from: prev, to: this.stage, date: new Date() });
    this.timeline.push({
      event:   `Moved to ${this.stage}`,
      stage:   this.stage,
      type:    'stage_change',
      date:    new Date(),
      addedBy: 'system',
    });
  }
  next();
});

// Track previous stage before save
jobSchema.pre('save', function (next) {
  if (this.isModified('stage') && !this.isNew) {
    this._previousStage = this.$locals?.previousStage || '';
  }
  next();
});

module.exports = mongoose.model('Job', jobSchema);