const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Job = require('../models/Job');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Rate limiter
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'AI rate limit reached, please wait a moment and try again.',
  },
});

// Groq setup
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// AI helper
async function askAI(prompt) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  return response.choices[0].message.content;
}

// File upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('text/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are supported.'));
    }
  },
});

// POST /api/resume/upload
router.post('/upload', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded.',
      });
    }

    let resumeText = '';

    if (req.file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(req.file.buffer);
      resumeText = parsed.text;
    } else {
      resumeText = req.file.buffer.toString('utf-8');
    }

    if (!resumeText.trim()) {
      return res.status(400).json({
        error: 'Could not extract text from the file.',
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      resumeText,
    });

    res.json({
      message: 'Resume uploaded successfully.',
      length: resumeText.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/resume/analyze
router.post('/analyze', aiLimiter, async (req, res, next) => {
  try {
    const { jobDescription, jobId } = req.body;

    const user = await User.findById(req.user._id);

    if (!user.resumeText) {
      return res.status(400).json({
        error: 'No resume on file. Please upload your resume first.',
      });
    }

    let jd = jobDescription || '';

    if (jobId && !jd) {
      const job = await Job.findOne({
        _id: jobId,
        user: req.user._id,
      });

      if (job) jd = job.jobDescription;
    }

    const prompt = `Analyze this resume and provide a detailed assessment.

RESUME:
${user.resumeText.substring(0, 4000)}

${
  jd
    ? `JOB DESCRIPTION:\n${jd.substring(0, 2000)}`
    : 'Analyze for general software engineering roles.'
}

Respond ONLY with valid JSON in this exact format:
{
  "overallScore": 82,
  "summary": "Brief 2-sentence overall assessment",
  "skillScores": [
    {"skill": "React", "score": 88, "found": true},
    {"skill": "Node.js", "score": 75, "found": true},
    {"skill": "System Design", "score": 60, "found": false}
  ],
  "strengths": ["Strong frontend skills"],
  "improvements": ["Add quantified results"],
  "keywordsMissing": ["Kubernetes"],
  "formattingScore": 85,
  "atsCompatible": true,
  "suggestions": ["Add GitHub project links"]
}`;

    const text = await askAI(prompt);

    let analysis;

    try {
      const clean = text.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(clean);
    } catch {
      return res.status(500).json({
        error: 'Failed to parse AI analysis. Please try again.',
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      resumeScore: analysis.overallScore,
    });

    if (jobId) {
      await Job.findOneAndUpdate(
        {
          _id: jobId,
          user: req.user._id,
        },
        {
          resumeMatchScore: analysis.overallScore,
          matchedSkills: analysis.skillScores.map((s) => ({
            skill: s.skill,
            score: s.score,
          })),
        }
      );
    }

    res.json({ analysis });
  } catch (err) {
    console.error('Resume analyze error:', err.message);
    next(err);
  }
});

// POST /api/resume/improve
router.post('/improve', aiLimiter, async (req, res, next) => {
  try {
    const { bullet, role, company } = req.body;

    if (!bullet) {
      return res.status(400).json({
        error: 'Bullet point text is required.',
      });
    }

    const prompt = `Rewrite this resume bullet point to be more impactful for a ${
      role || 'software engineer'
    } role${company ? ` at ${company}` : ''}.

Original: "${bullet}"

Rules:
- Start with a strong action verb
- Include specific metrics
- Keep under 20 words
- Focus on impact

Respond ONLY with rewritten bullet.`;

    const improved = await askAI(prompt);

    res.json({
      improved: improved.trim(),
    });
  } catch (err) {
    console.error('Resume improve error:', err.message);
    next(err);
  }
});

// GET /api/resume
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'resumeText resumeScore'
    );

    res.json({
      hasResume: !!user.resumeText,
      resumeScore: user.resumeScore,
      length: user.resumeText ? user.resumeText.length : 0,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;