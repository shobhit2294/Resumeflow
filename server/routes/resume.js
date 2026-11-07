const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Job = require('../models/Job');
const { protect } = require('../middleware/auth');
const {
  rankSkillEvidence,
  sentenceEvidence,
  verifiedResumeEvidence,
  weightedSkillScore,
} = require('../utils/readiness-matching');

const router = express.Router();
router.use(protect);
const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const MAX_RESUME_PDF_PAGES = 50;
const MAX_RESUME_TEXT_LENGTH = 100000;

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
    model: 'qwen/qwen3.8-27b',
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

function parseAIJson(text) {
  const clean = String(text || '').replace(/```json|```/g, '').trim();
  const start = clean.search(/[{[]/);
  const end = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('AI response did not contain JSON');
  return JSON.parse(clean.slice(start, end + 1));
}

// File upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and plain text files are supported.'));
    }
  },
});

// POST /api/resume/upload
router.post('/upload', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Resume file exceeds the 5 MB upload limit.' });
    }
    return res.status(400).json({ error: err.message || 'Resume upload was rejected.' });
  });
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded.',
      });
    }

    let resumeText = '';

    if (req.file.mimetype === 'application/pdf') {
      if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ error: 'The uploaded file is not a valid PDF document.' });
      }
      let parsed;
      try {
        parsed = await pdfParse(req.file.buffer);
      } catch (err) {
        console.warn('Resume PDF parse rejected:', err.message);
        return res.status(400).json({ error: 'The PDF could not be parsed safely. Try exporting it again or upload a TXT file.' });
      }
      if (parsed.numpages > MAX_RESUME_PDF_PAGES) {
        return res.status(400).json({ error: `PDF resumes are limited to ${MAX_RESUME_PDF_PAGES} pages.` });
      }
      resumeText = parsed.text;
    } else {
      resumeText = req.file.buffer.toString('utf-8');
    }

    if (!resumeText.trim()) {
      return res.status(400).json({
        error: 'Could not extract text from the file.',
      });
    }
    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return res.status(413).json({ error: 'Extracted resume text exceeds the 100,000 character limit.' });
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

// POST /api/resume/match-job
router.post('/match-job', aiLimiter, async (req, res, next) => {
  try {
    const { jobId } = req.body;
    if (typeof jobId !== 'string' || !/^[a-f\d]{24}$/i.test(jobId)) {
      return res.status(400).json({ error: 'A valid saved job ID is required.' });
    }

    const [job, user] = await Promise.all([
      Job.findOne({ _id: jobId, user: req.user._id }),
      User.findById(req.user._id).select('resumeText'),
    ]);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    if (!user?.resumeText?.trim()) {
      return res.status(400).json({ error: 'Upload your resume before comparing it with this job.' });
    }
    if (!job.jobDescription?.trim()) {
      return res.status(400).json({ error: 'Add the job description to this application before running a resume match.' });
    }

    const resumeText = user.resumeText.substring(0, 12000);
    const description = job.jobDescription.substring(0, 12000);
    const extracted = parseAIJson(await askAI(`Extract job requirements and relevant candidate evidence.

JOB TITLE: ${job.role}
JOB DESCRIPTION:
${description}

RESUME:
${resumeText}

Return valid JSON with requiredSkills and preferredSkills arrays of {skill, importance, context}; experienceRequired and educationRequired strings; responsibilities array; experienceMatch {evidence, gaps}; educationMatch {evidence}; projects array.
Only quote evidence that appears verbatim in the resume. Do not invent candidate experience, projects, metrics, employers, education, or qualifications. Do not treat a skill as a requirement unless the job description states it. Limit each skill list to 25 entries and each other list to 10.`));

    const skills = [
      ...(Array.isArray(extracted.requiredSkills) ? extracted.requiredSkills : [])
        .map((item) => ({ ...item, category: 'required' })),
      ...(Array.isArray(extracted.preferredSkills) ? extracted.preferredSkills : [])
        .map((item) => ({ ...item, category: 'preferred' })),
    ].filter((item) => typeof item.skill === 'string' && item.skill.trim())
      .slice(0, 50)
      .map((item) => ({
        skill: item.skill.trim(),
        context: typeof item.context === 'string' ? item.context : '',
        category: item.category,
        importance: ['critical', 'high', 'medium', 'nice-to-have'].includes(item.importance)
          ? item.importance
          : item.category === 'preferred' ? 'nice-to-have' : 'medium',
      }));
    const uniqueSkills = skills.filter((skill, index) => (
      skills.findIndex((candidate) => candidate.skill.toLowerCase() === skill.skill.toLowerCase()) === index
    ));
    if (!uniqueSkills.length) {
      return res.status(422).json({ error: 'No specific job skills could be extracted. Add a detailed job description and try again.' });
    }

    const resumeSentences = sentenceEvidence(resumeText);
    const embeddingInput = [
      ...uniqueSkills.map((skill) => `${skill.skill}. ${skill.context}`.trim()),
      ...resumeSentences,
    ];
    const embeddingResponse = await groq.embeddings.create({
      model: process.env.GROQ_EMBEDDING_MODEL || 'nomic-embed-text-v1_5',
      input: embeddingInput,
      encoding_format: 'float',
    });
    const embeddings = [...(embeddingResponse.data || [])].sort((a, b) => a.index - b.index);
    if (embeddings.length !== embeddingInput.length) {
      return res.status(502).json({ error: 'Semantic matching returned incomplete embeddings. Please try again.' });
    }

    const sentenceEmbeddings = embeddings.slice(uniqueSkills.length).map((entry) => entry.embedding);
    const matchedSkills = uniqueSkills.map((skill, index) => ({
      ...skill,
      ...rankSkillEvidence(skill.skill, resumeSentences, embeddings[index].embedding, sentenceEmbeddings),
    }));
    const required = matchedSkills.filter((item) => item.category === 'required');
    const preferred = matchedSkills.filter((item) => item.category === 'preferred');
    const requiredScore = weightedSkillScore(required);
    const preferredScore = weightedSkillScore(preferred);
    const skillsScore = required.length && preferred.length
      ? Math.round(requiredScore * 0.8 + preferredScore * 0.2)
      : required.length ? requiredScore : preferredScore;
    const experienceEvidence = verifiedResumeEvidence(extracted.experienceMatch?.evidence, resumeText);
    const educationEvidence = verifiedResumeEvidence(extracted.educationMatch?.evidence, resumeText);
    const experienceRequired = typeof extracted.experienceRequired === 'string' ? extracted.experienceRequired.trim() : '';
    const educationRequired = typeof extracted.educationRequired === 'string' ? extracted.educationRequired.trim() : '';
    const experienceScore = experienceRequired ? (experienceEvidence ? 100 : 0) : 100;
    const educationScore = educationRequired ? (educationEvidence ? 100 : 0) : 100;
    const overallScore = Math.round(skillsScore * 0.6 + experienceScore * 0.25 + educationScore * 0.15);
    const analysis = {
      overallScore,
      scoreBreakdown: {
        skillsScore,
        requiredSkillsScore: requiredScore,
        preferredSkillsScore: preferredScore,
        experienceScore,
        educationScore,
        weights: { skills: 60, experience: 25, education: 15 },
      },
      requiredSkills: matchedSkills.filter((item) => item.category === 'required'),
      preferredSkills: matchedSkills.filter((item) => item.category === 'preferred'),
      experienceMatch: {
        score: experienceScore,
        evidence: experienceEvidence,
        gaps: Array.isArray(extracted.experienceMatch?.gaps)
          ? extracted.experienceMatch.gaps.filter((item) => typeof item === 'string').slice(0, 10)
          : [],
      },
      educationMatch: { score: educationScore, evidence: educationEvidence },
      jobProfile: {
        experienceRequired,
        educationRequired,
        responsibilities: Array.isArray(extracted.responsibilities)
          ? extracted.responsibilities.filter((item) => typeof item === 'string').slice(0, 10)
          : [],
      },
      projects: (Array.isArray(extracted.projects) ? extracted.projects : [])
        .filter((item) => typeof item === 'string')
        .map((item) => verifiedResumeEvidence(item, resumeText))
        .filter(Boolean)
        .slice(0, 10),
    };

    job.resumeMatchScore = overallScore;
    job.matchedSkills = matchedSkills.map((item) => ({
      skill: item.skill,
      score: item.score,
      found: item.found,
      importance: item.importance,
      evidence: item.evidence,
      keywordSimilarity: item.keywordSimilarity,
      embeddingSimilarity: item.embeddingSimilarity,
    }));
    job.resumeMatchAnalysis = analysis;
    await job.save();

    res.json({ analysis });
  } catch (err) {
    console.error('Resume job-match error:', err.message);
    next(err);
  }
});

// GET /api/resume/content — current user's extracted resume text
router.get('/content', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('resumeText');
    res.json({ resumeText: user?.resumeText || '' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/resume/content — save edits only when the user explicitly submits them
router.put('/content', async (req, res, next) => {
  try {
    const { currentText, updatedText } = req.body;
    if (typeof currentText !== 'string' || typeof updatedText !== 'string' || !updatedText.trim()) {
      return res.status(400).json({ error: 'Current and updated resume text are required.' });
    }
    if (updatedText.length > MAX_RESUME_TEXT_LENGTH) {
      return res.status(413).json({ error: 'Resume text exceeds the 100,000 character limit.' });
    }

    const result = await User.updateOne(
      { _id: req.user._id, resumeText: currentText },
      { $set: { resumeText: updatedText, resumeScore: null } }
    );
    if (!result.matchedCount) {
      return res.status(409).json({ error: 'Your saved resume changed since this draft was opened. Reload it before saving to avoid overwriting newer edits.' });
    }

    res.json({ message: 'Approved resume edits saved.', length: updatedText.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/resume/improve
router.post('/improve', aiLimiter, async (req, res, next) => {
  try {
    const { bullet, role, company } = req.body;

    if (typeof bullet !== 'string' || !bullet.trim()) {
      return res.status(400).json({
        error: 'Bullet point text is required.',
      });
    }
    if (bullet.length > 2000) {
      return res.status(400).json({ error: 'Bullet point must be under 2,000 characters.' });
    }

    const prompt = `Rewrite this resume bullet point to be clearer and more impactful for a ${
      role || 'software engineer'
    } role${company ? ` at ${company}` : ''}.

Original candidate-provided text:
${bullet}

Rules:
- Start with a strong action verb
- Preserve the original facts, scope, technologies, and qualifiers
- Never invent or infer metrics, responsibilities, outcomes, employers, or qualifications
- Do not add facts that are not present in the original text
- Do not add any numbers, percentages, dates, or quantities that are not present in the original
- Keep under 20 words
- Focus on impact

Respond ONLY with rewritten bullet.`;

    const improved = await askAI(prompt);
    const originalNumbers = bullet.match(/\b\d+(?:[.,]\d+)*%?\b/g) || [];
    const rewrittenNumbers = improved.match(/\b\d+(?:[.,]\d+)*%?\b/g) || [];
    if (rewrittenNumbers.some((number) => !originalNumbers.includes(number))) {
      return res.status(502).json({ error: 'The rewrite introduced a number not present in your original bullet. Please retry or edit the bullet yourself.' });
    }

    res.json({
      improved: improved.trim(),
      requiresApproval: true,
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