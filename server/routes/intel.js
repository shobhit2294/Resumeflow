const express = require('express');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key' });
const MODEL = 'qwen/qwen3.8-27b';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Intel AI rate limit reached. Please wait a moment.' },
});

async function askAI(prompt, maxTokens = 2500) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: maxTokens,
  });
  return response.choices[0].message.content;
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  const start = clean.search(/[{[]/);
  const end = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
  if (start === -1 || end === -1) throw new Error('No JSON found in AI response');
  return JSON.parse(clean.slice(start, end + 1));
}

// ─────────────────────────────────────────────────────────────
// 1. Ghosting Radar & 1-Click Follow-Up Generator
// ─────────────────────────────────────────────────────────────
router.post('/follow-up', aiLimiter, async (req, res, next) => {
  try {
    const { jobTitle, company, stage, daysSinceLastContact = 7, recipientName = 'Hiring Team', notes = '' } = req.body;
    if (!jobTitle || !company) {
      return res.status(400).json({ error: 'Job title and company are required.' });
    }

    const days = Number(daysSinceLastContact) || 0;
    let status = 'on_track';
    let riskLevel = 'Low';
    if (days >= 11) {
      status = 'stalled_ghost_risk';
      riskLevel = 'High Risk of Ghosting';
    } else if (days >= 6) {
      status = 'follow_up_window';
      riskLevel = 'Prime Re-engagement Window';
    }

    const user = await User.findById(req.user._id);
    const candidateName = user?.name || 'Candidate';

    const prompt = `You are an executive career strategist and recruiter.
Candidate "${candidateName}" applied for "${jobTitle}" at "${company}".
Current application stage: "${stage || 'Applied'}".
Days since last communication: ${days} days.
Notes/context: "${notes || 'No extra notes'}".
Recipient name: "${recipientName}".

Return a JSON object with EXACTLY this structure:
{
  "recommendation": "A 1-2 sentence tactical recommendation on how and when to reach out",
  "politeCheckIn": {
    "subject": "Clear, professional email subject line",
    "body": "Concise, respectful status check-in email under 90 words. Keep candidate enthusiasm high.",
    "bestTiming": "e.g. Tuesday morning 9:30 AM"
  },
  "valueAddUpdate": {
    "subject": "Engaging subject line showing continuous momentum",
    "body": "High-value re-engagement email (under 120 words) referencing a relevant recent project update or thought related to ${company}'s domain.",
    "bestTiming": "e.g. Thursday afternoon"
  },
  "linkedInInMail": {
    "message": "Punchy LinkedIn DM under 280 characters asking for a quick 2-minute status update.",
    "characterCount": 250
  }
}
Output only valid JSON with no markdown wrapping.`;

    const aiRes = await askAI(prompt, 1800);
    const parsed = parseJSON(aiRes);

    res.json({
      status,
      days,
      riskLevel,
      jobTitle,
      company,
      recipientName,
      ...parsed,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Company Interview Intel Dossier
// ─────────────────────────────────────────────────────────────
router.post('/company-dossier', aiLimiter, async (req, res, next) => {
  try {
    const { company, jobTitle, jobDescription = '' } = req.body;
    if (!company || !jobTitle) {
      return res.status(400).json({ error: 'Company and job title are required.' });
    }

    const prompt = `You are a Principal Tech Recruiter and Engineering Hiring Manager.
Create an in-depth Interview Intelligence Dossier for a candidate interviewing for:
Company: "${company}"
Role: "${jobTitle}"
Job Description context: "${jobDescription.slice(0, 2000)}"

Return a comprehensive JSON object matching this schema:
{
  "companyProfile": {
    "engineeringCulture": "1-2 paragraphs detailing the engineering ethos, autonomy, shipping velocity, and what they prize most",
    "techStackFocus": ["Skill/Tech 1", "Skill/Tech 2", "Skill/Tech 3", "Skill/Tech 4", "Skill/Tech 5"],
    "hiringBar": "What separates an offer from a rejection at ${company}"
  },
  "interviewLoop": [
    {
      "roundNumber": 1,
      "roundName": "Recruiter Screen / Initial Chat",
      "duration": "30 mins",
      "primaryFocus": "What they are screening for",
      "typicalQuestions": ["Question 1", "Question 2"],
      "trapsToAvoid": "Common pitfalls candidate must avoid in this round"
    },
    {
      "roundNumber": 2,
      "roundName": "Technical Assessment / Coding Screen",
      "duration": "45-60 mins",
      "primaryFocus": "Core technical challenges, coding style, data structures or live problem solving",
      "typicalQuestions": ["Question 1", "Question 2"],
      "trapsToAvoid": "Silent bugs, lack of communication, poor edge case coverage"
    },
    {
      "roundNumber": 3,
      "roundName": "System Architecture / Deep-Dive",
      "duration": "60 mins",
      "primaryFocus": "Scalability, modularity, real-world trade-offs",
      "typicalQuestions": ["Question 1", "Question 2"],
      "trapsToAvoid": "Over-engineering without justifying tradeoffs"
    },
    {
      "roundNumber": 4,
      "roundName": "Cultural & Behavioral / Leadership",
      "duration": "45 mins",
      "primaryFocus": "Ownership, handling conflict, cross-functional empathy",
      "typicalQuestions": ["Question 1", "Question 2"],
      "trapsToAvoid": "Saying 'we' without clarifying your individual contribution"
    }
  ],
  "cultureSignals": [
    {
      "principle": "Core culture attribute (e.g. Bias for Action, Extreme Ownership, Customer Obsession)",
      "whatItMeans": "How ${company} defines this",
      "howToDemonstrate": "Concrete example of what the candidate should say to demonstrate this"
    },
    {
      "principle": "Second core attribute",
      "whatItMeans": "Description",
      "howToDemonstrate": "Actionable example"
    }
  ],
  "killerReverseQuestions": [
    {
      "question": "An impressive, high-signal question the candidate should ask the interviewer",
      "targetInterviewer": "Hiring Manager / Tech Lead / Peer",
      "whyItImpresses": "Why this question makes the candidate stand out from 99% of other applicants"
    },
    {
      "question": "Second killer reverse question",
      "targetInterviewer": "Product / Leadership",
      "whyItImpresses": "Reasoning"
    },
    {
      "question": "Third killer reverse question",
      "targetInterviewer": "Engineering Team",
      "whyItImpresses": "Reasoning"
    }
  ],
  "salaryContext": {
    "estimatedMarketRange": "e.g. $135,000 - $175,000 + Equity",
    "negotiationLeverageNotes": "Key tips on when and how to leverage counteroffers with ${company}"
  }
}
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 2600);
    const parsed = parseJSON(aiRes);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Day-of-Interview Battlecard / Cheat Sheet
// ─────────────────────────────────────────────────────────────
router.post('/cheat-sheet', aiLimiter, async (req, res, next) => {
  try {
    const { company, jobTitle, jobDescription = '', customNotes = '' } = req.body;
    if (!company || !jobTitle) {
      return res.status(400).json({ error: 'Company and job title are required.' });
    }

    const user = await User.findById(req.user._id);
    const resumeText = user?.resumeText || '';

    const prompt = `You are an elite interview preparation coach.
Create an immediate "Day-of-Interview Battlecard / Cheat Sheet" that a candidate can glance at during their interview for:
Company: "${company}"
Role: "${jobTitle}"
Candidate Resume text: "${resumeText.slice(0, 3000)}"
Job Description: "${jobDescription.slice(0, 2000)}"
Notes: "${customNotes}"

Synthesize realistic, punchy bullet points directly from the candidate's real background.
Return a JSON object with this schema:
{
  "elevatorPitch": "A razor-sharp 60-second 'Tell me about yourself' pitch tailored to ${company}'s needs (under 120 words).",
  "topStarStories": [
    {
      "title": "Short Story Catchphrase (e.g. The Redis Cache Migration)",
      "mapsToRequirement": "What requirement in the JD this story proves",
      "situation": "Brief 1-sentence context",
      "task": "What was expected of you",
      "action": "The specific technical/leadership action you took",
      "result": "The quantifiable outcome or metric achieved"
    },
    {
      "title": "Second Story Catchphrase",
      "mapsToRequirement": "Target requirement",
      "situation": "Context",
      "task": "Task",
      "action": "Action",
      "result": "Result"
    },
    {
      "title": "Third Story Catchphrase",
      "mapsToRequirement": "Target requirement",
      "situation": "Context",
      "task": "Task",
      "action": "Action",
      "result": "Result"
    }
  ],
  "powerMetricsToDrop": [
    "e.g. 45% reduction in API response latency",
    "e.g. Scaled system to 100k daily active users",
    "e.g. Zero production downtime during deployment"
  ],
  "technicalTalkingPoints": [
    {
      "topic": "Key Architecture or Framework topic expected in this interview",
      "talkingPoint": "Crucial distinction, pattern, or trade-off to mention casually",
      "caution": "Common mistake candidates make on this topic"
    },
    {
      "topic": "Second expected topic",
      "talkingPoint": "Crucial talking point",
      "caution": "Common mistake"
    }
  ],
  "top3ReverseQuestions": [
    "Question to ask at the end of the interview",
    "Second question to ask",
    "Third question to ask"
  ]
}
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 2400);
    const parsed = parseJSON(aiRes);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 4. Offer Comparison & Salary Negotiation Strategist
// ─────────────────────────────────────────────────────────────
router.post('/negotiate', aiLimiter, async (req, res, next) => {
  try {
    const {
      company,
      jobTitle,
      baseSalary,
      annualBonus = 0,
      signOnBonus = 0,
      equityTotal = 0,
      equityVestingYears = 4,
      targetBase,
      competingOffers = [],
      strategy = 'competing_offer', // 'competing_offer' | 'market_rate' | 'non_salary_perks'
      notes = '',
    } = req.body;

    if (!company || !jobTitle || !baseSalary) {
      return res.status(400).json({ error: 'Company, job title, and base salary are required.' });
    }

    const base = Number(baseSalary) || 0;
    const bonus = Number(annualBonus) || 0;
    const signOn = Number(signOnBonus) || 0;
    const equity = Number(equityTotal) || 0;
    const vestYears = Number(equityVestingYears) || 4;

    const annualizedEquity = vestYears > 0 ? Math.round(equity / vestYears) : 0;
    const firstYearTC = base + bonus + signOn + annualizedEquity;
    const standardAnnualTC = base + bonus + annualizedEquity;

    const user = await User.findById(req.user._id);
    const candidateName = user?.name || 'Candidate';

    const prompt = `You are a world-class executive compensation negotiator.
A candidate "${candidateName}" received an offer from "${company}" for the role "${jobTitle}".
Offer breakdown:
- Base Salary: $${base}
- Annual Bonus: $${bonus}
- Sign-on Bonus: $${signOn}
- Equity: $${equity} over ${vestYears} years ($${annualizedEquity}/year)
- First Year Total Comp: $${firstYearTC}
- Target Desired Base: $${targetBase || base * 1.15}
- Competing Offers Context: ${JSON.stringify(competingOffers)}
- Negotiation Strategy: "${strategy}"
- User Notes: "${notes}"

Generate a strategic negotiation response that is courteous, firm, and leaves zero money on the table without risking the offer.
Return a JSON object:
{
  "strategicAssessment": "A 2-3 sentence assessment of the offer and where the most leverage lies (base vs. sign-on vs. equity).",
  "leveragePoints": [
    "Specific point of leverage 1",
    "Specific point of leverage 2",
    "Specific point of leverage 3"
  ],
  "counterOfferEmail": {
    "subject": "Professional email subject line acknowledging the offer enthusiastically",
    "body": "Complete, polished counter-offer email draft ready to send. Enthusiastic, data-driven, and clearly stating the target number with justification.",
    "keyToneTips": "Advice on how to deliver this email"
  },
  "phoneScript": {
    "opening": "What to say when the recruiter calls to discuss the counter",
    "coreTalkingPoints": [
      "Talking point 1",
      "Talking point 2"
    ],
    "fallbackCompromises": [
      "If they say base is strictly capped, ask for X instead (e.g. higher signing bonus)",
      "If equity is fixed, ask for Y instead (e.g. accelerated 6-month review)"
    ]
  }
}
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 2000);
    const parsed = parseJSON(aiRes);

    res.json({
      metrics: {
        base,
        bonus,
        signOn,
        annualizedEquity,
        firstYearTC,
        standardAnnualTC,
      },
      ...parsed,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 5. High-Impact "3-Point Proof Pitch" (Cover Pitch Generator)
// ─────────────────────────────────────────────────────────────
router.post('/proof-pitch', aiLimiter, async (req, res, next) => {
  try {
    const { company, jobTitle, jobDescription } = req.body;
    if (!company || !jobTitle || !jobDescription) {
      return res.status(400).json({ error: 'Company, job title, and job description are required.' });
    }

    const user = await User.findById(req.user._id);
    const resumeText = user?.resumeText || '';

    const prompt = `You are a master of cold outreach and direct hiring manager messaging.
Job title: "${jobTitle}" at "${company}".
Job Description: "${jobDescription.slice(0, 2000)}"
Candidate Resume: "${resumeText.slice(0, 3000)}"

Instead of a generic 400-word cover letter, produce a high-conversion "3-Point Proof Pitch" (under 160 words total).
Identify the 3 biggest technical or business problems this job requires solving, and pair each strictly with verified proof from the candidate's background.

Return a JSON object:
{
  "headline": "A punchy subject line or opening hook",
  "painPointsAndProof": [
    {
      "companyNeed": "The critical problem mentioned in the JD",
      "candidateProof": "Specific achievement or project proving candidate has done this",
      "impact": "Quantifiable metric or outcome"
    },
    {
      "companyNeed": "Second critical problem",
      "candidateProof": "Proof from resume",
      "impact": "Impact metric"
    },
    {
      "companyNeed": "Third critical problem",
      "candidateProof": "Proof from resume",
      "impact": "Impact metric"
    }
  ],
  "fullPitch": "The complete, ready-to-send message (under 160 words) structured with opening hook, 3 bullet proof points, and confident call-to-action.",
  "shortLinkedInDM": "A 280-character version optimized for LinkedIn connection requests."
}
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 1800);
    const parsed = parseJSON(aiRes);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Universal Job Post Parser (Smart Auto-Extract from Raw Text)
// ─────────────────────────────────────────────────────────────
router.post('/parse-job', aiLimiter, async (req, res, next) => {
  try {
    const { rawText } = req.body;
    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: 'Please provide the raw text or description of the job posting.' });
    }

    const prompt = `You are an expert ATS parser and job scraper.
Extract the key job application details from the raw job posting text below.

Raw Job Text:
"""${rawText.slice(0, 4500)}"""

Return ONLY a JSON object matching this exact structure:
{
  "company": "Company Name",
  "role": "Standardized Role Title (e.g. Senior Backend Engineer)",
  "location": "City, State or Country if specified, or Remote",
  "remote": true,
  "salaryMin": 120000,
  "salaryMax": 160000,
  "currency": "USD",
  "source": "One of: LinkedIn, Indeed, Company site, Referral, AngelList, Glassdoor, Greenhouse, Lever, Other",
  "tags": ["Skill1", "Skill2", "Skill3", "Skill4", "Skill5"],
  "jobDescription": "A clean, concise 2-3 paragraph summary of key responsibilities and requirements.",
  "contactName": "Hiring manager or recruiter name if mentioned, else empty string",
  "contactEmail": "Contact email if mentioned, else empty string"
}
If salary is not specified, set salaryMin and salaryMax to null.
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 1500);
    const parsed = parseJSON(aiRes);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 7. Post-Interview Debrief & Recovery Action Plan ("Interview Autopsy")
// ─────────────────────────────────────────────────────────────
router.post('/interview-debrief', aiLimiter, async (req, res, next) => {
  try {
    const {
      company,
      role,
      roundName = 'Technical Round',
      overallFeeling = 'mixed', // great, mixed, rough
      questionsAsked = '',
      stumbledQuestion = '',
    } = req.body;

    if (!company || !role) {
      return res.status(400).json({ error: 'Company and role are required.' });
    }

    const user = await User.findById(req.user._id);
    const candidateName = user?.name || 'Candidate';

    const prompt = `You are an elite Silicon Valley tech interview coach and executive career strategist.
A candidate just finished an interview round for "${role}" at "${company}".

Details:
- Interview Round: ${roundName}
- Candidate's Self-Assessment Feeling: ${overallFeeling}
- Questions Asked During Loop: "${questionsAsked.slice(0, 1500)}"
- Specific Question Candidate Stumbled On or Felt Incomplete: "${stumbledQuestion.slice(0, 1500)}"
- Candidate Name: ${candidateName}

Produce a tactical interview debrief and recovery package:
1. Honest post-mortem: Analyze if the stumble was minor, medium, or severe, and how interviewers typically weight this.
2. Graceful Clarification Thank-You Email: A same-day thank-you note that thanks the interviewer, references an interesting topic discussed, and seamlessly includes a brilliant, graceful 2-3 sentence clarification or enhanced solution to the stumbled question without sounding defensive.
3. Standalone Technical Clarification Script: What they could write in a code snippet or follow-up note.
4. Next-Round Study Focus: Top 3 specific technical/behavioral concepts to master before the next round based on what this interviewer probed.

Return a JSON object:
{
  "severityRating": "minor" | "medium" | "critical",
  "postMortemAnalysis": "Direct, empathetic, realistic analysis of where the candidate stands.",
  "thankYouEmail": {
    "subject": "Thank you - ${candidateName} / ${role} interview",
    "body": "Full text of email ready to send",
    "timingTip": "Send within 4-6 hours of interview"
  },
  "clarifiedAnswer": "The polished, master-level answer to the question they stumbled on.",
  "nextRoundPrepFocus": [
    "Focus area 1 with why it matters",
    "Focus area 2 with why it matters",
    "Focus area 3 with why it matters"
  ]
}
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 2200);
    const parsed = parseJSON(aiRes);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// 8. Warm Referral & Backchannel Pathmaker
// ─────────────────────────────────────────────────────────────
router.post('/referral-pitch', aiLimiter, async (req, res, next) => {
  try {
    const {
      company,
      role,
      contactType = 'alumni', // alumni, former_colleague, cold_manager, second_degree
      mutualContext = '',     // e.g. "We both studied CS at UC Berkeley" or "We both worked at Adobe"
      targetPersonName = 'there',
    } = req.body;

    if (!company || !role) {
      return res.status(400).json({ error: 'Company and role are required.' });
    }

    const user = await User.findById(req.user._id);
    const candidateName = user?.name || 'Candidate';
    const candidateSkills = (user?.skills || []).join(', ') || 'Software Engineering, Full Stack Development';

    const prompt = `You are a high-level executive networking expert.
A candidate (${candidateName}, skills: ${candidateSkills}) wants to get a warm referral or backchannel connection for the role "${role}" at "${company}".

Contact Type: ${contactType}
Target Person: ${targetPersonName}
Shared / Mutual Context: "${mutualContext}"

Referral requests that fail are generic, transactional, or ask for too much too soon.
Generate 3 high-conversion, respectful outreach variations:
1. Warm Intro / Coffee Chat: Asks for 10-15 minutes of insight on the engineering culture and team roadmap.
2. Direct Referral Pitch: Non-awkward, respectful ask for an internal referral link, providing 2 concise bullet points they can copy-paste to the hiring manager.
3. Direct Hiring Manager Value DM: For reaching out directly to the prospective manager with a specific value proposition hook.

Return a JSON object:
{
  "targetStrategyTip": "Tactical advice on when and how to approach this contact.",
  "coffeeChatRequest": {
    "subject": "Subject line",
    "message": "Message under 120 words"
  },
  "directReferralAsk": {
    "subject": "Subject line",
    "message": "Message with 2 bullet points of proof ready for them to submit to their internal ATS"
  },
  "hiringManagerDM": {
    "subject": "Subject line",
    "message": "Under 140 words, value-first message"
  },
  "followUpNudge": "Short 40-word polite reminder to send after 5 days if no reply"
}
Return ONLY valid JSON.`;

    const aiRes = await askAI(prompt, 2000);
    const parsed = parseJSON(aiRes);
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

