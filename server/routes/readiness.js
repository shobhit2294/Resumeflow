const express = require('express');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const {
  rankSkillEvidence,
  sentenceEvidence,
  verifiedResumeEvidence,
  weightedSkillScore,
} = require('../utils/readiness-matching');

const router = express.Router();
router.use(protect);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key' });
const MODEL = 'qwen/qwen3.8-27b';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI rate limit reached, please wait a moment.' },
});

// ─── Readiness Report Schema ───────────────────────────────────
const ReadinessReportSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jobTitle:    { type: String, required: true },
  company:     { type: String, default: '' },
  jobDescription: { type: String, required: true },
  overallScore: { type: Number, default: 0 },
  requiredSkills: [{
    skill: String,
    importance: String,
    found: Boolean,
    evidence: String,
    score: Number,
    keywordSimilarity: Number,
    embeddingSimilarity: Number,
  }],
  preferredSkills: [{
    skill: String,
    found: Boolean,
    evidence: String,
    score: Number,
    keywordSimilarity: Number,
    embeddingSimilarity: Number,
  }],
  resumeProfile: {
    experience: [String],
    education: [String],
    projects: [String],
  },
  jobProfile: {
    responsibilities: [String],
    qualifications: [String],
    experienceRequired: String,
    educationRequired: String,
  },
  experienceMatch: { score: Number, evidence: String, gaps: [String] },
  educationMatch:  { score: Number, evidence: String },
  scoreBreakdown: {
    skillsScore:     Number,
    requiredSkillsScore: Number,
    preferredSkillsScore: Number,
    experienceScore: Number,
    educationScore:  Number,
    weights: {
      skills: Number,
      experience: Number,
      education: Number,
    },
  },
  interviewEvaluations: { type: [{
    question: String,
    answer: String,
    scores: {
      relevance: Number,
      technical: Number,
      clarity: Number,
      problemSolving: Number,
    },
    overallScore: Number,
    feedback: String,
    strengths: [String],
    improvements: [String],
    createdAt: { type: Date, default: Date.now },
  }], default: [] },
  skillGaps:   [{ skill: String, importance: String, reason: String }],
  learningPlan: [{
    skill:     String,
    priority:  String,
    resources: [{ title: String, type: String, url: String, duration: String }],
    timeline:  String,
  }],
  interviewQuestions: [{
    question: String,
    category: String,
    difficulty: String,
    rubric: {
      relevance:  String,
      technical:  String,
      clarity:    String,
      problemSolving: String,
    },
  }],
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const ReadinessReport = mongoose.model('ReadinessReport', ReadinessReportSchema);

// ─── AI helper ─────────────────────────────────────────────────
async function askAI(prompt, maxTokens = 2000) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: maxTokens,
  });
  return response.choices[0].message.content;
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  // Find the first { or [ and last } or ]
  const start = clean.search(/[{[]/);
  const end = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(clean.slice(start, end + 1));
}

function boundedScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function verifiedExperienceScore(match, resumeText, required) {
  if (!required) return 100;
  const evidence = verifiedResumeEvidence(match?.evidence, resumeText);
  return evidence ? boundedScore(match.score) : 0;
}

// ══════════════════════════════════════════════════════════════
// POST /api/readiness/analyze
// Full 5-step Job Readiness pipeline
// ══════════════════════════════════════════════════════════════
router.post('/analyze', aiLimiter, async (req, res, next) => {
  try {
    const { jobDescription, jobTitle, company } = req.body;
    if (
      typeof jobDescription !== 'string' ||
      !jobDescription.trim() ||
      typeof jobTitle !== 'string' ||
      !jobTitle.trim()
    ) {
      return res.status(400).json({ error: 'Job description and job title are required.' });
    }
    if (jobDescription.length > 12000 || jobTitle.length > 160 || (company && (typeof company !== 'string' || company.length > 160))) {
      return res.status(400).json({ error: 'Job title must be under 160 characters and job description under 12,000 characters.' });
    }

    const user = await User.findById(req.user._id);
    let resumeText = (req.body.resumeText || user?.resumeText || '').trim();

    if (!resumeText) {
      if (user?.skills?.length > 0) {
        resumeText = `Candidate: ${user.name}\nTarget Role: ${user.title || 'Software Engineer'}\nSkills: ${user.skills.join(', ')}`;
      } else {
        return res.status(400).json({
          error: 'No resume on file. Please upload your resume in the Resume AI section or paste your background/experience to analyze readiness.'
        });
      }
    }

    resumeText = resumeText.substring(0, 12000);
    const jdSnippet = jobDescription.substring(0, 12000);

    // ── STEP 1: Extract skills from JD ─────────────────────────
    const step1Prompt = `Parse this job description for a "${jobTitle}" role into structured requirements.

JOB DESCRIPTION:
${jdSnippet}

Respond ONLY with valid JSON:
{
  "requiredSkills": [
    { "skill": "React", "importance": "critical", "context": "Build customer-facing applications with React" },
    { "skill": "Node.js", "importance": "high", "context": "Build and maintain backend APIs" }
  ],
  "preferredSkills": [
    { "skill": "Docker", "importance": "nice-to-have", "context": "Experience with containerized deployments" }
  ],
  "experienceRequired": "3-5 years",
  "educationRequired": "Bachelor's in CS or equivalent",
  "responsibilities": ["Build and maintain APIs", "Collaborate with product teams"],
  "qualifications": ["Experience shipping production software"]
}

Only include skills and requirements stated in the job description. importance values: "critical", "high", "medium", "nice-to-have". Keep lists concise and do not infer requirements from the job title.`;

    let jdData;
    try {
      jdData = parseJSON(await askAI(step1Prompt, 1000));
    } catch {
      return res.status(500).json({ error: 'Failed to extract skills from job description. Please try again.' });
    }

    // ── STEP 2: Match resume against extracted skills ───────────
    const requiredSkills = (Array.isArray(jdData.requiredSkills) ? jdData.requiredSkills : [])
      .filter((item) => typeof item?.skill === 'string' && item.skill.trim())
      .slice(0, 30)
      .map((item) => ({
        skill: item.skill.trim(),
        importance: ['critical', 'high', 'medium', 'nice-to-have'].includes(item.importance)
          ? item.importance
          : 'medium',
        context: typeof item.context === 'string' ? item.context : '',
      }));
    const preferredSkills = (Array.isArray(jdData.preferredSkills) ? jdData.preferredSkills : [])
      .filter((item) => typeof item?.skill === 'string' && item.skill.trim())
      .slice(0, 30)
      .map((item) => ({
        skill: item.skill.trim(),
        importance: ['critical', 'high', 'medium', 'nice-to-have'].includes(item.importance)
          ? item.importance
          : 'nice-to-have',
        context: typeof item.context === 'string' ? item.context : '',
      }));
    const allSkills = [...requiredSkills, ...preferredSkills].filter(
      (skill, index, skills) => skills.findIndex((candidate) => candidate.skill.toLowerCase() === skill.skill.toLowerCase()) === index
    );
    if (!allSkills.length) {
      return res.status(422).json({ error: 'No skills could be extracted from this job description. Add specific role requirements and try again.' });
    }

    const step2Prompt = `Extract structured candidate evidence from this resume for the "${jobTitle}" role.

RESUME:
${resumeText}

Job responsibilities: ${JSON.stringify(jdData.responsibilities || [])}
Skills to assess: ${JSON.stringify(allSkills.map((skill) => skill.skill))}
Required experience: ${jdData.experienceRequired || 'Not specified'}
Required education: ${jdData.educationRequired || 'Not specified'}

Only quote evidence copied exactly from the resume. Do not infer skills, dates, employers, qualifications, projects, or outcomes. Return a match for every listed skill; when there is no direct evidence use an empty quote and score 0. Scores must reflect the quoted evidence, not assumptions.

Respond ONLY with valid JSON:
{
  "skillMatches": [
    { "skill": "React", "evidence": "Built customer-facing dashboard using React and Redux" }
  ],
  "experienceMatch": {
    "score": 75,
    "evidence": "Exact resume quote supporting relevant experience",
    "gaps": ["Missing team leadership experience"]
  },
  "educationMatch": {
    "score": 90,
    "evidence": "Exact resume quote supporting education"
  },
  "experience": ["Exact resume quote about a role, employer, and dates"],
  "education": ["Exact resume quote about a degree or certification"],
  "projects": ["Exact resume quote describing a candidate project"]
}`;

    let matchData;
    try {
      matchData = parseJSON(await askAI(step2Prompt, 1500));
    } catch {
      return res.status(500).json({ error: 'Failed to match resume against skills. Please try again.' });
    }

    const sentences = sentenceEvidence(resumeText);
    const embeddingInput = [
      ...allSkills.map((skill) => `${skill.skill}. ${skill.context}`.trim()),
      ...sentences,
    ];
    let embeddingResponse;
    try {
      embeddingResponse = await groq.embeddings.create({
        model: process.env.GROQ_EMBEDDING_MODEL || 'nomic-embed-text-v1_5',
        input: embeddingInput,
        encoding_format: 'float',
      });
    } catch (err) {
      console.error('Readiness embedding error:', err.message);
      return res.status(502).json({ error: 'Semantic matching is unavailable. Check the configured Groq embedding model and try again.' });
    }
    const embeddingData = [...(embeddingResponse.data || [])].sort((a, b) => a.index - b.index);
    if (embeddingData.length !== embeddingInput.length) {
      return res.status(502).json({ error: 'Semantic matching returned incomplete embeddings. Please try again.' });
    }
    const sentenceEmbeddings = embeddingData.slice(allSkills.length).map((entry) => entry.embedding);
    const skillMatches = allSkills.map((skill, index) => ({
      ...skill,
      ...rankSkillEvidence(
        skill.skill,
        sentences,
        embeddingData[index].embedding,
        sentenceEmbeddings
      ),
    }));
    const requiredSkillMatches = requiredSkills.map((skill) => ({
      ...skillMatches.find((match) => match.skill.toLowerCase() === skill.skill.toLowerCase()),
      importance: skill.importance,
    }));
    const preferredSkillMatches = preferredSkills.map((skill) => ({
      ...skillMatches.find((match) => match.skill.toLowerCase() === skill.skill.toLowerCase()),
      importance: skill.importance,
    }));

    // ── STEP 3: Compute a transparent, importance-weighted score ─
    const requiredSkillsScore = weightedSkillScore(requiredSkillMatches);
    const preferredSkillsScore = weightedSkillScore(preferredSkillMatches);
    const skillsScore = requiredSkillMatches.length && preferredSkillMatches.length
      ? Math.round(requiredSkillsScore * 0.8 + preferredSkillsScore * 0.2)
      : requiredSkillMatches.length
        ? requiredSkillsScore
        : preferredSkillsScore;
    const experienceRequired = typeof jdData.experienceRequired === 'string'
      ? jdData.experienceRequired.trim()
      : '';
    const educationRequired = typeof jdData.educationRequired === 'string'
      ? jdData.educationRequired.trim()
      : '';
    const experienceEvidence = verifiedResumeEvidence(matchData.experienceMatch?.evidence, resumeText);
    const educationEvidence = verifiedResumeEvidence(matchData.educationMatch?.evidence, resumeText);
    const experienceScore = verifiedExperienceScore(matchData.experienceMatch, resumeText, experienceRequired);
    const educationScore = educationRequired
      ? (educationEvidence ? boundedScore(matchData.educationMatch?.score) : 0)
      : 100;

    const overallScore = Math.round(
      skillsScore * 0.60 +
      experienceScore * 0.25 +
      educationScore * 0.15
    );

    // ── STEP 4: Learning plan for skill gaps ────────────────────
    const gaps = skillMatches
      .filter((match) => !match.found)
      .map((match) => ({ skill: match.skill, importance: match.importance }))
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, 'nice-to-have': 3 };
        return order[a.importance] - order[b.importance];
      });

    let learningPlan = [];
    if (gaps.length > 0) {
      const gapList = gaps.slice(0, 6).map(g => `${g.skill} (${g.importance})`).join(', ');
      const step4Prompt = `Create a concise learning plan for these skill gaps for a "${jobTitle}" candidate: ${gapList}

Respond ONLY with valid JSON array (max 6 items):
[
  {
    "skill": "Kubernetes",
    "priority": "high",
    "resources": [
      { "title": "Kubernetes Official Docs", "type": "documentation", "url": "https://kubernetes.io/docs/", "duration": "2 weeks" },
      { "title": "Kubernetes for Beginners - TechWorld with Nana", "type": "video", "url": "https://www.youtube.com/watch?v=X48VuDVv0do", "duration": "4 hours" }
    ],
    "timeline": "2-3 weeks"
  }
]`;

      try {
        learningPlan = parseJSON(await askAI(step4Prompt, 1200));
        if (!Array.isArray(learningPlan)) throw new Error('Learning plan response was not an array');
      } catch (err) {
        console.error('Readiness learning plan error:', err.message);
        return res.status(502).json({ error: 'Failed to generate a learning plan. Please try again.' });
      }
    }

    // ── STEP 5: Generate role-specific interview questions ──────
    const projectEvidence = (Array.isArray(matchData.projects) ? matchData.projects : [])
      .filter((project) => typeof project === 'string')
      .map((project) => verifiedResumeEvidence(project, resumeText))
      .filter(Boolean)
      .slice(0, 5);
    const step5Prompt = `Generate 6 interview questions for a "${jobTitle}" candidate.
Their strongest skills: ${requiredSkillMatches.filter(m => m.found).map(m => m.skill).slice(0, 4).join(', ') || 'general'}.
Their gaps: ${gaps.slice(0, 3).map(g => g.skill).join(', ') || 'none identified'}.
Candidate project evidence copied from their resume: ${JSON.stringify(projectEvidence)}.

Use project questions only when grounded in the supplied evidence. Do not invent candidate projects or accomplishments. Respond ONLY with valid JSON array:
[
  {
    "question": "Describe a time you optimized a React application's performance.",
    "category": "technical",
    "difficulty": "medium",
    "rubric": {
      "relevance": "Directly addresses React performance (profiling, memoization, code splitting)",
      "technical": "Mentions specific techniques: React.memo, useMemo, useCallback, lazy loading",
      "clarity": "Explains the problem, action taken, and measurable result",
      "problemSolving": "Shows systematic debugging approach"
    }
  }
]`;

    let interviewQuestions = [];
    try {
      interviewQuestions = parseJSON(await askAI(step5Prompt, 1200));
      if (!Array.isArray(interviewQuestions)) throw new Error('Interview question response was not an array');
    } catch (err) {
      console.error('Readiness interview generation error:', err.message);
      return res.status(502).json({ error: 'Failed to generate practice interview questions. Please try again.' });
    }

    // ── Build final report ──────────────────────────────────────
    const requiredSkillsFinal = requiredSkills.map(s => {
      const match = skillMatches.find(m => m.skill.toLowerCase() === s.skill.toLowerCase()) || {};
      return {
        skill: s.skill,
        importance: s.importance,
        found: match.found,
        evidence: match.evidence || '',
        score: match.score,
        keywordSimilarity: match.keywordSimilarity,
        embeddingSimilarity: match.embeddingSimilarity,
      };
    });

    const preferredSkillsFinal = preferredSkills.map(s => {
      const match = skillMatches.find(m => m.skill.toLowerCase() === s.skill.toLowerCase()) || {};
      return {
        skill: s.skill,
        found: match.found || false,
        evidence: match.evidence || '',
        score: match.score || 0,
        keywordSimilarity: match.keywordSimilarity || 0,
        embeddingSimilarity: match.embeddingSimilarity || 0,
      };
    });

    const skillGaps = gaps.map(g => ({
      skill: g.skill,
      importance: g.importance,
      reason: skillMatches.find((match) => match.skill === g.skill)?.evidence
        ? 'Relevant evidence was found, but the semantic and keyword match is below the readiness threshold.'
        : 'No sufficiently relevant supporting evidence was found in the resume.',
    }));

    // Save to DB
    const report = await ReadinessReport.create({
      user: req.user._id,
      jobTitle,
      company: company || '',
      jobDescription,
      overallScore,
      requiredSkills: requiredSkillsFinal,
      preferredSkills: preferredSkillsFinal,
      resumeProfile: {
        experience: (Array.isArray(matchData.experience) ? matchData.experience : [])
          .map((item) => verifiedResumeEvidence(item, resumeText)).filter(Boolean),
        education: (Array.isArray(matchData.education) ? matchData.education : [])
          .map((item) => verifiedResumeEvidence(item, resumeText)).filter(Boolean),
        projects: projectEvidence,
      },
      jobProfile: {
        responsibilities: Array.isArray(jdData.responsibilities) ? jdData.responsibilities.slice(0, 20) : [],
        qualifications: Array.isArray(jdData.qualifications) ? jdData.qualifications.slice(0, 20) : [],
        experienceRequired,
        educationRequired,
      },
      experienceMatch: {
        score: experienceScore,
        evidence: experienceEvidence,
        gaps: Array.isArray(matchData.experienceMatch?.gaps) ? matchData.experienceMatch.gaps : [],
      },
      educationMatch: { score: educationScore, evidence: educationEvidence },
      scoreBreakdown: {
        skillsScore,
        requiredSkillsScore,
        preferredSkillsScore,
        experienceScore,
        educationScore,
        weights: { skills: 60, experience: 25, education: 15 },
      },
      skillGaps,
      learningPlan,
      interviewQuestions,
    });

    res.json({ report });
  } catch (err) {
    console.error('Readiness analyze error:', err.message);
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/readiness/evaluate-answer
// Rubric-based evaluation of an interview answer
// ══════════════════════════════════════════════════════════════
router.post('/evaluate-answer', aiLimiter, async (req, res, next) => {
  try {
    const { question, answer, rubric, jobTitle, reportId } = req.body;
    if (
      typeof question !== 'string' ||
      !question.trim() ||
      typeof answer !== 'string' ||
      !answer.trim() ||
      typeof reportId !== 'string'
    ) {
      return res.status(400).json({ error: 'Question, answer, and readiness report are required.' });
    }
    if (question.length > 2000 || answer.length > 5000) {
      return res.status(400).json({ error: 'Question must be under 2,000 characters and answer under 5,000 characters.' });
    }
    const report = await ReadinessReport.findOne({ _id: reportId, user: req.user._id });
    if (!report) {
      return res.status(404).json({ error: 'Readiness report not found.' });
    }

    const prompt = `Evaluate this interview answer for the ${jobTitle || report.jobTitle || 'software engineer'} role.

QUESTION: ${question}

CANDIDATE'S ANSWER: ${answer}

RUBRIC:
- Relevance: ${rubric?.relevance || 'Does the answer address the question?'}
- Technical: ${rubric?.technical || 'Are technical claims accurate?'}
- Clarity: ${rubric?.clarity || 'Is the answer well-structured?'}
- Problem-solving: ${rubric?.problemSolving || 'Does it show systematic thinking?'}

Score each dimension 0-10. Be fair but rigorous.

Respond ONLY with valid JSON:
{
  "scores": {
    "relevance": 8,
    "technical": 7,
    "clarity": 9,
    "problemSolving": 7
  },
  "overallScore": 8,
  "strengths": ["Clear STAR format", "Specific metrics mentioned"],
  "improvements": ["Could mention specific technologies used", "Add quantified business impact"],
  "feedback": "Strong answer overall. Your use of the STAR method is excellent, but adding the specific React performance gains in milliseconds would make this answer memorable."
}`;

    let evaluation;
    try {
      evaluation = parseJSON(await askAI(prompt, 800));
    } catch {
      return res.status(500).json({ error: 'Failed to evaluate answer. Please try again.' });
    }

    const scoreOutOfTen = (value) => {
      const score = Number(value);
      return Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0;
    };
    const scores = {
      relevance: scoreOutOfTen(evaluation.scores?.relevance),
      technical: scoreOutOfTen(evaluation.scores?.technical),
      clarity: scoreOutOfTen(evaluation.scores?.clarity),
      problemSolving: scoreOutOfTen(evaluation.scores?.problemSolving),
    };
    const overallScore = Math.round(
      Object.values(scores).reduce((sum, score) => sum + score, 0) / 4 * 10
    ) / 10;
    const savedEvaluation = {
      question: question.trim(),
      answer: answer.trim(),
      scores,
      overallScore,
      feedback: typeof evaluation.feedback === 'string' ? evaluation.feedback : '',
      strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths.filter((item) => typeof item === 'string').slice(0, 5) : [],
      improvements: Array.isArray(evaluation.improvements) ? evaluation.improvements.filter((item) => typeof item === 'string').slice(0, 5) : [],
      createdAt: new Date(),
    };
    report.interviewEvaluations.push(savedEvaluation);
    if (report.interviewEvaluations.length > 200) {
      report.interviewEvaluations = report.interviewEvaluations.slice(-200);
    }
    await report.save();

    res.json({
      evaluation: savedEvaluation,
      interviewEvaluations: report.interviewEvaluations,
    });
  } catch (err) {
    console.error('Evaluate answer error:', err.message);
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/readiness/reports
// List user's readiness reports
// ══════════════════════════════════════════════════════════════
router.get('/reports', async (req, res, next) => {
  try {
    const reports = await ReadinessReport.find({ user: req.user._id })
      .select('jobTitle company overallScore createdAt scoreBreakdown skillGaps')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ reports });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════
// GET /api/readiness/reports/:id
// Get a single report
// ══════════════════════════════════════════════════════════════
router.get('/reports/:id', async (req, res, next) => {
  try {
    const report = await ReadinessReport.findOne({ _id: req.params.id, user: req.user._id });
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json({ report });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════
// DELETE /api/readiness/reports/:id
// ══════════════════════════════════════════════════════════════
router.delete('/reports/:id', async (req, res, next) => {
  try {
    const deleted = await ReadinessReport.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) return res.status(404).json({ error: 'Report not found.' });
    res.json({ message: 'Report deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
