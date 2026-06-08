const express = require('express');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const Interview = require('../models/Interview');
const Job = require('../models/Job');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit reached, please wait a moment and try again.' },
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Groq model — llama3 is fast and free on Groq
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const buildSystemPrompt = (type, jobInfo) => {
  const jobContext = jobInfo
    ? `The candidate is interviewing for: ${jobInfo.role} at ${jobInfo.company}. Job description: ${jobInfo.jobDescription || 'Not provided'}.`
    : 'This is a general software engineering interview.';

  const typeInstructions = {
    behavioral:      'Focus exclusively on behavioral questions using the STAR method (Situation, Task, Action, Result).',
    technical:       'Focus on technical coding questions, algorithms, and data structures.',
    'system-design': 'Focus on system design: scalability, databases, APIs, caching, architecture.',
    mixed:           'Cover: behavioral (3 questions), technical (3 questions), system design (2 questions).',
  };

  return `You are an expert technical interviewer at a top tech company.

${jobContext}

Interview type: ${typeInstructions[type] || typeInstructions.mixed}

STRICT RULES:
1. Ask ONE question at a time. Never ask multiple questions.
2. After each answer, give brief feedback (1-2 sentences) with a score like [Score: X/10].
3. Then immediately ask the next question.
4. Keep ALL responses under 120 words.
5. Be professional but encouraging.
6. After 8 questions answered, write "INTERVIEW_COMPLETE" and give a final summary with: overall score, top 2 strengths, top 2 areas for improvement.
7. Never break character as the interviewer.`;
};

// Call Groq with full conversation history
async function askGroq(systemPrompt, messages) {
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: chatMessages,
    max_tokens: 400,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

// POST /api/interview/start
router.post('/start', aiLimiter, async (req, res, next) => {
  try {
    const { jobId, type = 'mixed' } = req.body;

    let jobInfo = null;
    if (jobId) {
      jobInfo = await Job.findOne({ _id: jobId, user: req.user._id }).select('role company jobDescription');
    }

    const systemPrompt = buildSystemPrompt(type, jobInfo);

    const firstQuestion = await askGroq(systemPrompt, [
      { role: 'user', content: 'Please start the interview with your first question.' },
    ]);

    const interview = await Interview.create({
      user: req.user._id,
      job: jobId || null,
      type,
      status: 'active',
      totalQuestions: 8,
      messages: [{ role: 'assistant', content: firstQuestion }],
    });

    if (jobId) {
      await Job.findByIdAndUpdate(jobId, { $push: { interviewSessions: interview._id } });
    }

    res.status(201).json({ interview, systemPrompt });
  } catch (err) {
    console.error('Interview start error:', err.message);
    next(err);
  }
});

// POST /api/interview/:id/message
router.post('/:id/message', aiLimiter, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content is required.' });

    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) return res.status(404).json({ error: 'Interview not found.' });
    if (interview.status === 'completed') {
      return res.status(400).json({ error: 'This interview session is already completed.' });
    }

    interview.messages.push({ role: 'user', content });

    let jobInfo = null;
    if (interview.job) {
      jobInfo = await Job.findById(interview.job).select('role company jobDescription');
    }
    const systemPrompt = buildSystemPrompt(interview.type, jobInfo);

    const aiReply = await askGroq(systemPrompt, interview.messages.map(m => ({
      role: m.role,
      content: m.content,
    })));

    interview.messages.push({ role: 'assistant', content: aiReply });
    interview.questionsAsked = Math.min(interview.questionsAsked + 1, 8);

    if (aiReply.includes('INTERVIEW_COMPLETE')) {
      interview.status = 'completed';
      interview.completedAt = new Date();
      interview.duration = Math.round((new Date() - interview.startedAt) / 60000);

      const scores = interview.messages
        .filter(m => m.role === 'assistant')
        .map(m => {
          const match = m.content.match(/\[Score:\s*(\d+(?:\.\d+)?)/i);
          return match ? parseFloat(match[1]) : null;
        })
        .filter(Boolean);

      if (scores.length > 0) {
        interview.averageScore = Math.round(
          (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
        ) / 10;
      }
      interview.summary = aiReply;
    }

    await interview.save();

    res.json({
      message: { role: 'assistant', content: aiReply },
      interview: {
        _id: interview._id,
        status: interview.status,
        questionsAsked: interview.questionsAsked,
        averageScore: interview.averageScore,
      },
    });
  } catch (err) {
    console.error('Interview message error:', err.message);
    next(err);
  }
});

// POST /api/interview/:id/analyze-behavior
router.post('/:id/analyze-behavior', aiLimiter, async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) return res.status(404).json({ error: 'Interview not found.' });

    const {
      transcript,
      fillerWordCount,
      totalFillerWords,
      speakingPaceWpm,
      silencePauseCount,
      answerLengths,
      eyeContactPercent,
      lookAwayCount,
      facialExpressions,
      headMovement,
      sessionDurationMins,
    } = req.body;

    const jobContext = interview.job ? 'interviewing for a specific role' : 'in a general software engineering interview';

    const prompt = `You are an expert interview coach and behavioral analyst. Analyze this interview performance and provide a comprehensive improvement report.

INTERVIEW TRANSCRIPT:
${transcript ? transcript.substring(0, 5000) : 'Not provided'}

BEHAVIORAL METRICS:
- Filler words: ${JSON.stringify(fillerWordCount || {})} (total: ${totalFillerWords || 0})
- Speaking pace: ${speakingPaceWpm || 'unknown'} wpm (ideal: 120-150)
- Long pauses: ${silencePauseCount || 0}
- Eye contact: ${eyeContactPercent !== undefined ? eyeContactPercent + '%' : 'unknown'} (ideal: 60-70%)
- Looked away: ${lookAwayCount || 0} times
- Facial expressions: ${JSON.stringify(facialExpressions || {})}
- Head movement: ${headMovement || 'unknown'}
- Duration: ${sessionDurationMins || 0} minutes
- Answer lengths (words): ${JSON.stringify(answerLengths || [])}

The candidate was ${jobContext}.

Respond ONLY with valid JSON (no markdown, no backticks, no explanation):
{
  "overallBehaviorScore": 72,
  "summary": "2-3 sentence overall behavioral assessment",
  "categories": {
    "eyeContact": {
      "score": 65,
      "rating": "needs improvement",
      "observation": "specific observation",
      "tip": "concrete actionable tip"
    },
    "speakingPace": {
      "score": 80,
      "rating": "good",
      "observation": "specific observation",
      "tip": "concrete tip"
    },
    "fillerWords": {
      "score": 55,
      "rating": "needs improvement",
      "topFillers": ["um", "like"],
      "observation": "specific observation",
      "tip": "concrete tip"
    },
    "confidence": {
      "score": 70,
      "rating": "good",
      "observation": "observation from expressions and movement",
      "tip": "concrete tip"
    },
    "articulation": {
      "score": 75,
      "rating": "good",
      "observation": "observation about clarity",
      "tip": "concrete tip"
    },
    "answerStructure": {
      "score": 68,
      "rating": "needs improvement",
      "observation": "observation about STAR method usage",
      "tip": "concrete tip"
    }
  },
  "topStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "criticalImprovements": [
    {
      "issue": "Issue name",
      "impact": "Impact description",
      "exercise": "Specific daily exercise",
      "timeToImprove": "2-3 weeks"
    }
  ],
  "weeklyPracticeplan": [
    "Day 1-2: specific exercise",
    "Day 3-4: specific exercise",
    "Day 5-7: specific exercise"
  ],
  "nextInterviewChecklist": [
    "Checklist item 1",
    "Checklist item 2",
    "Checklist item 3",
    "Checklist item 4",
    "Checklist item 5"
  ]
}`;

    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const text = response.choices[0].message.content;

    let report;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      report = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI report. Please try again.' });
    }

    interview.behaviorReport = report;
    await interview.save();

    res.json({ report });
  } catch (err) {
    console.error('Behavior analysis error:', err.message);
    next(err);
  }
});

// GET /api/interview
router.get('/', async (req, res, next) => {
  try {
    const interviews = await Interview.find({ user: req.user._id })
      .populate('job', 'company role')
      .sort({ createdAt: -1 })
      .select('-messages');
    res.json({ interviews });
  } catch (err) { next(err); }
});

// GET /api/interview/:id
router.get('/:id', async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id })
      .populate('job', 'company role');
    if (!interview) return res.status(404).json({ error: 'Interview not found.' });
    res.json({ interview });
  } catch (err) { next(err); }
});

// DELETE /api/interview/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Interview.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Interview deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;