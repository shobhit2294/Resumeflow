const express   = require('express');
const axios     = require('axios');
const Groq      = require('groq-sdk');
const NodeCache = require('node-cache');
const PortalJob = require('../models/PortalJob');
const Interview = require('../models/Interview');
const User      = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();
const cache  = new NodeCache({ stdTTL: 300 });
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL  = 'llama-3.3-70b-versatile';

async function askGroq(prompt, maxTokens = 1500) {
  const r = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
  return r.choices[0].message.content;
}

// ─────────────────────────────────────────────────────────────
// MNC companies list (for display / filtering)
// ─────────────────────────────────────────────────────────────
const MNC_COMPANIES = [
  'Google','Microsoft','Amazon','Meta','Apple','Netflix','Salesforce',
  'Adobe','Oracle','SAP','IBM','Accenture','Infosys','Wipro','TCS',
  'HCL','Cognizant','Capgemini','Deloitte','McKinsey','Goldman Sachs',
  'JPMorgan','Stripe','Shopify','Atlassian','Twilio','Datadog','Snowflake',
  'Databricks','Palantir','Uber','Lyft','Airbnb','DoorDash','Notion',
  'Figma','Vercel','Linear','Supabase','PlanetScale','Cloudflare'
];

// ─────────────────────────────────────────────────────────────
// Fetch from Remotive (free, reliable, great for remote MNC jobs)
// ─────────────────────────────────────────────────────────────
async function fetchRemotive(queries) {
  const jobs = [];
  for (const q of queries) {
    try {
      const { data } = await axios.get(
        `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=20`,
        { timeout: 10000 }
      );
      for (const j of (data.jobs || [])) {
        jobs.push({
          externalId:  `remotive-${j.id}`,
          source:      'Remotive',
          title:       j.title,
          company:     j.company_name,
          companyLogo: j.company_logo || '',
          location:    j.candidate_required_location || 'Worldwide',
          remote:      true,
          jobType:     j.job_type || 'full-time',
          description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 3000),
          url:         j.url,
          postedAt:    new Date(j.publication_date),
          tags:        (j.tags || []).slice(0, 15),
          category:    j.category || 'Engineering',
          salary:      j.salary || '',
          isMNC:       MNC_COMPANIES.some(m => j.company_name?.toLowerCase().includes(m.toLowerCase())),
          hasMockInterview: true,
          hasCodingRound:   true,
        });
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) { console.error('Remotive error:', e.message); }
  }
  return jobs;
}

// ─────────────────────────────────────────────────────────────
// Fetch from Arbeitnow (free, good startup coverage)
// ─────────────────────────────────────────────────────────────
async function fetchArbeitnow() {
  try {
    const { data } = await axios.get(
      'https://www.arbeitnow.com/api/job-board-api?page=1',
      { timeout: 10000 }
    );
    return (data.data || []).slice(0, 60).map(j => ({
      externalId:  `arbeitnow-${j.slug}`,
      source:      'Arbeitnow',
      title:       j.title,
      company:     j.company_name,
      companyLogo: '',
      location:    j.location || 'Remote',
      remote:      j.remote || false,
      jobType:     j.job_types?.[0] || 'full-time',
      description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 3000),
      url:         j.url,
      postedAt:    j.created_at ? new Date(j.created_at * 1000) : new Date(),
      tags:        (j.tags || []).slice(0, 15),
      category:    'Engineering',
      isMNC:       MNC_COMPANIES.some(m => j.company_name?.toLowerCase().includes(m.toLowerCase())),
      hasMockInterview: true,
      hasCodingRound:   true,
    }));
  } catch (e) { console.error('Arbeitnow error:', e.message); return []; }
}

// ─────────────────────────────────────────────────────────────
// Fetch from The Muse API (free, startup-heavy, good data)
// ─────────────────────────────────────────────────────────────
async function fetchTheMuse() {
  try {
    const { data } = await axios.get(
      'https://www.themuse.com/api/public/jobs?category=Computer+and+IT&level=Mid+Level&level=Senior+Level&page=1&descending=true',
      { timeout: 10000 }
    );
    return (data.results || []).slice(0, 40).map(j => ({
      externalId:  `muse-${j.id}`,
      source:      'The Muse',
      title:       j.name,
      company:     j.company?.name || '',
      companyLogo: j.company?.refs?.logo_image || '',
      location:    j.locations?.[0]?.name || 'Remote',
      remote:      j.locations?.some(l => l.name?.toLowerCase().includes('remote')) || false,
      jobType:     'full-time',
      description: (j.contents || '').replace(/<[^>]*>/g, '').substring(0, 3000),
      url:         j.refs?.landing_page || '',
      postedAt:    j.publication_date ? new Date(j.publication_date) : new Date(),
      tags:        (j.categories || []).map(c => c.name).slice(0, 10),
      category:    j.categories?.[0]?.name || 'Engineering',
      isMNC:       MNC_COMPANIES.some(m => j.company?.name?.toLowerCase().includes(m.toLowerCase())),
      hasMockInterview: true,
      hasCodingRound:   true,
    }));
  } catch (e) { console.error('Muse error:', e.message); return []; }
}

// ─────────────────────────────────────────────────────────────
// Fetch from Adzuna if key available
// ─────────────────────────────────────────────────────────────
async function fetchAdzuna(queries) {
  const appId  = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const jobs = [];
  for (const q of queries.slice(0, 3)) {
    try {
      const { data } = await axios.get(
        `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(q)}&content-type=application/json`,
        { timeout: 10000 }
      );
      for (const j of (data.results || [])) {
        jobs.push({
          externalId:  `adzuna-${j.id}`,
          source:      'Adzuna',
          title:       j.title,
          company:     j.company?.display_name || '',
          location:    j.location?.display_name || '',
          remote:      j.title?.toLowerCase().includes('remote'),
          jobType:     'full-time',
          salaryMin:   j.salary_min ? Math.round(j.salary_min) : null,
          salaryMax:   j.salary_max ? Math.round(j.salary_max) : null,
          description: (j.description || '').substring(0, 3000),
          url:         j.redirect_url,
          postedAt:    j.created ? new Date(j.created) : new Date(),
          isMNC:       MNC_COMPANIES.some(m => j.company?.display_name?.toLowerCase().includes(m.toLowerCase())),
          hasMockInterview: true,
          hasCodingRound:   true,
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { console.error('Adzuna error:', e.message); }
  }
  return jobs;
}

// ─────────────────────────────────────────────────────────────
// JSearch via RapidAPI (best MNC coverage)
// ─────────────────────────────────────────────────────────────
async function fetchJSearch(queries) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];

  const jobs = [];
  for (const q of queries.slice(0, 3)) {
    try {
      const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
        params: { query: q, page: '1', num_pages: '1', date_posted: 'week' },
        headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
        timeout: 10000,
      });
      for (const j of (data.data || []).slice(0, 15)) {
        jobs.push({
          externalId:  `jsearch-${j.job_id}`,
          source:      'JSearch',
          title:       j.job_title,
          company:     j.employer_name,
          companyLogo: j.employer_logo || '',
          location:    j.job_city ? `${j.job_city}, ${j.job_country}` : j.job_country || '',
          remote:      j.job_is_remote || false,
          salaryMin:   j.job_min_salary ? Math.round(j.job_min_salary) : null,
          salaryMax:   j.job_max_salary ? Math.round(j.job_max_salary) : null,
          currency:    j.job_salary_currency || 'USD',
          description: (j.job_description || '').substring(0, 3000),
          url:         j.job_apply_link,
          postedAt:    j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : new Date(),
          tags:        j.job_required_skills || [],
          jobType:     j.job_employment_type || 'full-time',
          isMNC:       MNC_COMPANIES.some(m => j.employer_name?.toLowerCase().includes(m.toLowerCase())),
          hasMockInterview: true,
          hasCodingRound:   true,
        });
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e) { console.error('JSearch error:', e.message); }
  }
  return jobs;
}

// ─────────────────────────────────────────────────────────────
// Master seeder — runs all sources in parallel
// ─────────────────────────────────────────────────────────────
const SEARCH_QUERIES = [
  'software engineer', 'frontend developer', 'backend developer',
  'full stack developer', 'react developer', 'nodejs developer',
  'python developer', 'data engineer', 'devops engineer',
  'machine learning engineer', 'mobile developer', 'cloud engineer',
];

const MNC_QUERIES = MNC_COMPANIES.slice(0, 10).map(c => `${c} software engineer`);

async function seedAllJobs() {
  console.log('🔄 Fetching jobs from all sources...');
  try {
    const [remotive, arbeitnow, muse, adzuna, jsearch] = await Promise.allSettled([
      fetchRemotive(SEARCH_QUERIES.slice(0, 6)),
      fetchArbeitnow(),
      fetchTheMuse(),
      fetchAdzuna(SEARCH_QUERIES.slice(0, 3)),
      fetchJSearch([...SEARCH_QUERIES.slice(0, 2), ...MNC_QUERIES.slice(0, 1)]),
    ]);

    const allJobs = [
      ...(remotive.status  === 'fulfilled' ? remotive.value  : []),
      ...(arbeitnow.status === 'fulfilled' ? arbeitnow.value : []),
      ...(muse.status      === 'fulfilled' ? muse.value      : []),
      ...(adzuna.status    === 'fulfilled' ? adzuna.value    : []),
      ...(jsearch.status   === 'fulfilled' ? jsearch.value   : []),
    ];

    // Deduplicate by title+company
    const seen = new Set();
    const unique = allJobs.filter(j => {
      const key = `${j.title?.toLowerCase()}|${j.company?.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return j.title && j.company;
    });

    let upserted = 0;
    for (const job of unique) {
      try {
        await PortalJob.findOneAndUpdate(
          { externalId: job.externalId },
          { ...job, isActive: true, fetchedAt: new Date() },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        upserted++;
      } catch {}
    }

    console.log(`✅ Seeded ${upserted} portal jobs (${unique.filter(j=>j.isMNC).length} MNC)`);
    return upserted;
  } catch (err) {
    console.error('Seed failed:', err.message);
    return 0;
  }
}

// Auto-seed 5s after startup
setTimeout(seedAllJobs, 5000);

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════

// GET /api/portal/jobs
router.get('/jobs', async (req, res, next) => {
  try {
    const { q, location, remote, category, mnc, source, page = 1, limit = 24 } = req.query;
    const filter = { isActive: true };

    if (q)      filter.$text = { $search: q };
    if (remote  === 'true') filter.remote = true;
    if (mnc     === 'true') filter.isMNC  = true;
    if (category) filter.category = { $regex: category, $options: 'i' };
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (source)   filter.source   = source;

    const skip = (Number(page) - 1) * Number(limit);
    const sortOpt = q ? { score: { $meta: 'textScore' }, postedAt: -1 } : { isMNC: -1, postedAt: -1 };

    const [jobs, total] = await Promise.all([
      PortalJob.find(filter, { applications: 0 }).sort(sortOpt).skip(skip).limit(Number(limit)),
      PortalJob.countDocuments(filter),
    ]);

    // Stats
    const [mncCount, startupCount, remoteCount] = await Promise.all([
      PortalJob.countDocuments({ isActive: true, isMNC: true }),
      PortalJob.countDocuments({ isActive: true, isMNC: { $ne: true } }),
      PortalJob.countDocuments({ isActive: true, remote: true }),
    ]);

    res.json({ jobs, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)), stats: { mnc: mncCount, startup: startupCount, remote: remoteCount } });
  } catch (err) { next(err); }
});

// GET /api/portal/jobs/:id
router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await PortalJob.findById(req.params.id, { 'applications.user': 1, 'applications.status': 1, title: 1, company: 1, companyLogo: 1, location: 1, remote: 1, jobType: 1, salaryMin: 1, salaryMax: 1, description: 1, requirements: 1, url: 1, tags: 1, category: 1, postedAt: 1, hasMockInterview: 1, hasCodingRound: 1, difficulty: 1, applicantCount: 1, source: 1, isMNC: 1, salary: 1 });
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (err) { next(err); }
});

// GET /api/portal/refresh
router.get('/refresh', async (req, res, next) => {
  try {
    const count = await seedAllJobs();
    res.json({ message: `Refreshed. ${count} jobs seeded.` });
  } catch (err) { next(err); }
});

// GET /api/portal/mncs — list MNC companies with job counts
router.get('/mncs', async (req, res, next) => {
  try {
    const cacheKey = 'mnc-list';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const pipeline = [
      { $match: { isActive: true, isMNC: true } },
      { $group: { _id: '$company', count: { $sum: 1 }, source: { $first: '$source' }, logo: { $first: '$companyLogo' } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ];
    const mncs = await PortalJob.aggregate(pipeline);
    const result = { mncs };
    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════
// PROTECTED ROUTES
// ═══════════════════════════════════════════════════════════
router.use(protect);

// POST /api/portal/jobs/:id/apply
router.post('/jobs/:id/apply', async (req, res, next) => {
  try {
    const job = await PortalJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const already = job.applications.find(a => a.user.toString() === req.user._id.toString());
    if (already) return res.status(409).json({ error: 'Already applied.', application: already });
    job.applications.push({ user: req.user._id });
    job.applicantCount = job.applications.length;
    await job.save();
    res.status(201).json({ message: 'Application submitted!', application: job.applications.at(-1) });
  } catch (err) { next(err); }
});

// GET /api/portal/applications
router.get('/applications', async (req, res, next) => {
  try {
    const jobs = await PortalJob.find(
      { 'applications.user': req.user._id },
      { title:1, company:1, location:1, remote:1, tags:1, postedAt:1, hasMockInterview:1, hasCodingRound:1, isMNC:1, 'applications.$':1 }
    ).sort({ updatedAt: -1 });
    const applications = jobs.map(j => ({ jobId: j._id, title: j.title, company: j.company, location: j.location, remote: j.remote, tags: j.tags, postedAt: j.postedAt, hasMockInterview: j.hasMockInterview, hasCodingRound: j.hasCodingRound, isMNC: j.isMNC, ...j.applications[0].toObject() }));
    res.json({ applications });
  } catch (err) { next(err); }
});

// POST /api/portal/jobs/:id/score-resume
router.post('/jobs/:id/score-resume', async (req, res, next) => {
  try {
    const job  = await PortalJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const user = await User.findById(req.user._id);
    if (!user?.resumeText) return res.status(400).json({ error: 'Upload your resume first from the Resume AI page.' });

    const cacheKey = `rs:${req.user._id}:${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ analysis: cached });

    const prompt = `You are an expert ATS and technical recruiter. Score this resume against the job.

JOB: ${job.title} at ${job.company} ${job.isMNC ? '(MNC/Large company)' : '(Startup)'}
DESCRIPTION: ${job.description.substring(0, 2000)}
SKILLS REQUIRED: ${job.tags?.join(', ') || 'Not specified'}

RESUME: ${user.resumeText.substring(0, 3000)}

Respond ONLY with valid JSON, no backticks or markdown:
{
  "overallMatch": 78,
  "verdict": "Strong match",
  "summary": "2 sentence summary",
  "skillMatch": [{"skill":"React","required":true,"found":true,"score":90}],
  "missingSkills": ["Docker"],
  "strengths": ["strength1","strength2"],
  "gaps": ["gap1"],
  "suggestions": ["suggestion1","suggestion2","suggestion3"],
  "atsKeywords": {"found":["React"],"missing":["microservices"]},
  "interviewReadiness": 72,
  "shouldApply": true
}`;

    const text = await askGroq(prompt, 1200);
    let analysis;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      analysis = JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || clean);
    } catch { return res.status(500).json({ error: 'Failed to analyze. Try again.' }); }

    await PortalJob.updateOne(
      { _id: req.params.id, 'applications.user': req.user._id },
      { $set: { 'applications.$.resumeScore': analysis.overallMatch, 'applications.$.resumeFeedback': analysis } }
    );
    cache.set(cacheKey, analysis, 600);
    res.json({ analysis });
  } catch (err) { next(err); }
});

// POST /api/portal/jobs/:id/start-mock-interview
router.post('/jobs/:id/start-mock-interview', async (req, res, next) => {
  try {
    const job = await PortalJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const { type = 'mixed' } = req.body;

    const systemPrompt = `You are a senior interviewer at ${job.company}${job.isMNC ? ' (a top MNC)' : ''} for the ${job.title} role.
Skills needed: ${job.tags?.join(', ') || 'General engineering'}

RULES: Ask ONE question at a time. Score each answer [Score: X/10]. Keep under 120 words. After 8 questions write INTERVIEW_COMPLETE with final summary.`;

    const r = await groq.chat.completions.create({ model: MODEL, messages: [{ role:'system', content: systemPrompt }, { role:'user', content:'Start the interview.' }], max_tokens: 300, temperature: 0.7 });
    const firstQ = r.choices[0].message.content;

    const interview = await Interview.create({ user: req.user._id, type, status:'active', totalQuestions:8, messages:[{ role:'assistant', content: firstQ }] });
    await PortalJob.updateOne({ _id: req.params.id, 'applications.user': req.user._id }, { $set: { 'applications.$.mockInterviewId': interview._id } });

    res.status(201).json({ interview, systemPrompt });
  } catch (err) { next(err); }
});

// POST /api/portal/jobs/:id/coding-round
router.post('/jobs/:id/coding-round', async (req, res, next) => {
  try {
    const job = await PortalJob.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    const { action, language, code, questionId } = req.body;

    if (action === 'get-questions') {
      const cacheKey = `cq:${req.params.id}`;
      const cached = cache.get(cacheKey);
      if (cached) return res.json({ questions: cached });

      const prompt = `Generate 3 coding questions for a ${job.title} interview at ${job.company}.
Tech: ${job.tags?.join(', ') || 'General'}. Mix: 1 easy, 1 medium, 1 hard.

Return ONLY valid JSON, no backticks:
{"questions":[{"id":"q1","title":"Two Sum","difficulty":"easy","description":"full description with examples","examples":[{"input":"nums=[2,7,11,15], target=9","output":"[0,1]","explanation":"nums[0]+nums[1]=9"}],"constraints":["2 <= nums.length <= 10^4"],"hints":["Try using a hash map"],"tags":["array","hash-map"],"timeLimit":25}]}`;

      const text = await askGroq(prompt, 2000);
      let qs;
      try { qs = JSON.parse(text.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)?.[0])?.questions; }
      catch { return res.status(500).json({ error: 'Failed to generate questions.' }); }
      cache.set(cacheKey, qs, 3600);
      return res.json({ questions: qs });
    }

    if (action === 'evaluate') {
      if (!code?.trim()) return res.status(400).json({ error: 'Code is required.' });
      const prompt = `Evaluate this ${language} code submission for a coding interview.
Code:\n\`\`\`${language}\n${code.substring(0,3000)}\n\`\`\`

Return ONLY valid JSON, no backticks:
{"score":75,"verdict":"Pass","correctness":80,"efficiency":70,"codeQuality":75,"timeComplexity":"O(n)","spaceComplexity":"O(1)","feedback":"brief feedback","issues":["issue1"],"improvements":["improvement1"],"optimalApproach":"brief optimal approach","testResults":[{"test":"Basic case","passed":true},{"test":"Edge case","passed":false,"reason":"reason"}]}`;

      const text = await askGroq(prompt, 800);
      let evaluation;
      try { evaluation = JSON.parse(text.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)?.[0]); }
      catch { return res.status(500).json({ error: 'Evaluation failed.' }); }

      await PortalJob.updateOne(
        { _id: req.params.id, 'applications.user': req.user._id },
        { $set: { 'applications.$.codingRoundScore': evaluation.score, 'applications.$.codingRoundDone': true } }
      );
      return res.json({ evaluation });
    }

    res.status(400).json({ error: 'Invalid action.' });
  } catch (err) { next(err); }
});

module.exports = router;