const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  score: { type: Number, default: null },
  feedback: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    type: {
      type: String,
      enum: ['behavioral', 'technical', 'system-design', 'mixed'],
      default: 'mixed',
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    messages: [messageSchema],
    questionsAsked: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 8 },
    averageScore: { type: Number, default: null },
    summary: { type: String, default: '' },
    strengths: [String],
    improvements: [String],
    duration: { type: Number, default: 0 }, // minutes
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    behaviorReport: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);

// Note: behaviorReport field added dynamically via Mongoose strict: false
// To enforce schema, add this before module.exports: