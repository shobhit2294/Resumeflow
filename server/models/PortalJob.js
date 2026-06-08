const mongoose = require('mongoose');

// Application by a user for a portal job
const applicationSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resumeScore:    { type: Number, default: null },
  resumeFeedback: { type: mongoose.Schema.Types.Mixed, default: null },
  status: {
    type: String,
    enum: ['applied', 'screening', 'interview', 'rejected', 'offer'],
    default: 'applied',
  },
  appliedAt: { type: Date, default: Date.now },
  mockInterviewId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
  codingRoundScore: { type: Number, default: null },
  codingRoundDone:  { type: Boolean, default: false },
}, { _id: true });

const portalJobSchema = new mongoose.Schema({
  // Source info
  externalId:   { type: String, unique: true, sparse: true },
  source:       { type: String, default: 'Remotive' },
  fetchedAt:    { type: Date, default: Date.now },

  // Job details
  title:        { type: String, required: true },
  company:      { type: String, required: true },
  location:     { type: String, default: '' },
  remote:       { type: Boolean, default: false },
  jobType:      { type: String, default: 'full-time' },
  salaryMin:    { type: Number, default: null },
  salaryMax:    { type: Number, default: null },
  currency:     { type: String, default: 'USD' },
  description:  { type: String, default: '' },
  requirements: { type: String, default: '' },
  url:          { type: String, default: '' },
  tags:         [{ type: String }],
  category:     { type: String, default: 'Engineering' },
  postedAt:     { type: Date, default: Date.now },
  expiresAt:    { type: Date, default: null },
  isActive:     { type: Boolean, default: true },

  // Portal features
  hasMockInterview: { type: Boolean, default: true },
  hasCodingRound:   { type: Boolean, default: true },
  difficulty:       { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },

  // Applications
  applications: [applicationSchema],
  applicantCount: { type: Number, default: 0 },
}, { timestamps: true });

// Index for fast search
portalJobSchema.index({ title: 'text', company: 'text', description: 'text' });
portalJobSchema.index({ isActive: 1, postedAt: -1 });
portalJobSchema.index({ 'applications.user': 1 });

module.exports = mongoose.model('PortalJob', portalJobSchema);