const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const { protect } = require('../middleware/auth');
const Job = require('../models/Job');

const router = express.Router();
router.use(protect);

// Cache results for 10 minutes to avoid hammering APIs
const cache = new NodeCache({ stdTTL: 600 });

// ── Normalize job from any source into a common shape ──────────
function normalize(job) {
  return {
    externalId:  job.externalId  || '',
    source:      job.source      || 'Other',
    title:       job.title       || '',
    company:     job.company     || '',
    location:    job.location    || '',
    remote:      job.remote      || false,
    salaryMin:   job.salaryMin   || null,
    salaryMax:   job.salaryMax   || null,
    currency:    job.currency    || 'USD',
    description: job.description || '',
    url:         job.url         || '',
    postedAt:    job.postedAt    || new Date().toISOString(),
    tags:        job.tags        || [],
    jobType:     job.jobType     || 'full-time',
  };
}

// ── 1. Remotive API — free, no key, good for remote tech jobs ──
async function fetchRemotive(query, limit = 20) {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${limit}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return (data.jobs || []).map(j => normalize({
      externalId:  `remotive-${j.id}`,
      source:      'Remotive',
      title:       j.title,
      company:     j.company_name,
      location:    j.candidate_required_location || 'Remote',
      remote:      true,
      description: j.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
      url:         j.url,
      postedAt:    j.publication_date,
      tags:        j.tags || [],
      jobType:     j.job_type || 'full-time',
    }));
  } catch (err) {
    console.error('Remotive error:', err.message);
    return [];
  }
}

// ── 2. Adzuna API — free tier, 250 req/day, has salary data ───
async function fetchAdzuna(query, location = 'us', limit = 20) {
  try {
    const appId  = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return [];

    const country = location.toLowerCase().includes('india') ? 'in'
      : location.toLowerCase().includes('uk') ? 'gb'
      : location.toLowerCase().includes('canada') ? 'ca'
      : 'us';

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=${limit}&what=${encodeURIComponent(query)}&content-type=application/json`;
    const { data } = await axios.get(url, { timeout: 8000 });

    return (data.results || []).map(j => normalize({
      externalId:  `adzuna-${j.id}`,
      source:      'Adzuna',
      title:       j.title,
      company:     j.company?.display_name || '',
      location:    j.location?.display_name || '',
      remote:      j.title?.toLowerCase().includes('remote') || false,
      salaryMin:   j.salary_min ? Math.round(j.salary_min) : null,
      salaryMax:   j.salary_max ? Math.round(j.salary_max) : null,
      description: j.description?.substring(0, 500) || '',
      url:         j.redirect_url,
      postedAt:    j.created,
    }));
  } catch (err) {
    console.error('Adzuna error:', err.message);
    return [];
  }
}

// ── 3. JSearch via RapidAPI — most comprehensive, free 200/mo ─
async function fetchJSearch(query, location = '', limit = 10) {
  try {
    const key = process.env.RAPIDAPI_KEY;
    if (!key) return [];

    const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query:        `${query} ${location}`.trim(),
        page:         '1',
        num_pages:    '1',
        date_posted:  'week',
      },
      headers: {
        'X-RapidAPI-Key':  key,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      timeout: 8000,
    });

    return (data.data || []).slice(0, limit).map(j => normalize({
      externalId:  `jsearch-${j.job_id}`,
      source:      'JSearch',
      title:       j.job_title,
      company:     j.employer_name,
      location:    j.job_city ? `${j.job_city}, ${j.job_country}` : j.job_country || '',
      remote:      j.job_is_remote || false,
      salaryMin:   j.job_min_salary ? Math.round(j.job_min_salary) : null,
      salaryMax:   j.job_max_salary ? Math.round(j.job_max_salary) : null,
      currency:    j.job_salary_currency || 'USD',
      description: j.job_description?.substring(0, 500) || '',
      url:         j.job_apply_link,
      postedAt:    j.job_posted_at_datetime_utc,
      tags:        j.job_required_skills || [],
      jobType:     j.job_employment_type || 'full-time',
    }));
  } catch (err) {
    console.error('JSearch error:', err.message);
    return [];
  }
}

// ── 4. Github Jobs style fallback — uses public job boards ────
async function fetchArbeitnow(query, limit = 20) {
  try {
    const { data } = await axios.get(
      `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`,
      { timeout: 8000 }
    );
    return (data.data || []).slice(0, limit).map(j => normalize({
      externalId:  `arbeitnow-${j.slug}`,
      source:      'Arbeitnow',
      title:       j.title,
      company:     j.company_name,
      location:    j.location || 'Remote',
      remote:      j.remote || false,
      description: j.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
      url:         j.url,
      postedAt:    j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(),
      tags:        j.tags || [],
      jobType:     j.job_types?.[0] || 'full-time',
    }));
  } catch (err) {
    console.error('Arbeitnow error:', err.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// GET /api/jobs-search/search?q=react&location=remote&remote=true
// ══════════════════════════════════════════════════════════════
router.get('/search', async (req, res, next) => {
  try {
    const {
      q        = 'software engineer',
      location = '',
      remote,
      jobType,
      source,
      page     = 1,
    } = req.query;

    const cacheKey = `search:${q}:${location}:${remote}:${jobType}:${source}:${page}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Fetch from all available sources in parallel
    const [remotive, adzuna, jsearch, arbeitnow] = await Promise.all([
      (!source || source === 'Remotive') ? fetchRemotive(q, 15) : [],
      (!source || source === 'Adzuna')   ? fetchAdzuna(q, location, 15) : [],
      (!source || source === 'JSearch')  ? fetchJSearch(q, location, 10) : [],
      (!source || source === 'Arbeitnow')? fetchArbeitnow(q, 15) : [],
    ]);

    let jobs = [...remotive, ...adzuna, ...jsearch, ...arbeitnow];

    // Deduplicate by title+company
    const seen = new Set();
    jobs = jobs.filter(j => {
      const key = `${j.title.toLowerCase().trim()}|${j.company.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply filters
    if (remote === 'true') jobs = jobs.filter(j => j.remote);
    if (jobType) jobs = jobs.filter(j => j.jobType?.toLowerCase().includes(jobType.toLowerCase()));

    // Sort: jobs with salary first, then by date
    jobs.sort((a, b) => {
      if (a.salaryMin && !b.salaryMin) return -1;
      if (!a.salaryMin && b.salaryMin) return 1;
      return new Date(b.postedAt) - new Date(a.postedAt);
    });

    // Pagination
    const perPage = 20;
    const total   = jobs.length;
    const start   = (Number(page) - 1) * perPage;
    const paged   = jobs.slice(start, start + perPage);

    const result = {
      jobs:       paged,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / perPage),
      sources:    {
        remotive:  remotive.length,
        adzuna:    adzuna.length,
        jsearch:   jsearch.length,
        arbeitnow: arbeitnow.length,
      },
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/jobs-search/save — save external job to pipeline
// ══════════════════════════════════════════════════════════════
router.post('/save', async (req, res, next) => {
  try {
    const {
      title, company, location, remote, salaryMin, salaryMax,
      currency, description, url, source, tags, jobType,
    } = req.body;

    if (!title || !company) {
      return res.status(400).json({ error: 'Title and company are required.' });
    }

    // Check duplicate
    const existing = await Job.findOne({
      user:    req.user._id,
      company: { $regex: new RegExp(`^${company}$`, 'i') },
      role:    { $regex: new RegExp(`^${title}$`, 'i') },
    });
    if (existing) {
      return res.status(409).json({ error: 'This job is already in your pipeline.', job: existing });
    }

    const job = await Job.create({
      user:           req.user._id,
      role:           title,
      company,
      location:       location || '',
      remote:         remote || false,
      salaryMin:      salaryMin || null,
      salaryMax:      salaryMax || null,
      currency:       currency || 'USD',
      jobDescription: description || '',
      jobUrl:         url || '',
      source:         source || 'Other',
      tags:           tags || [],
      stage:          'Applied',
    });

    res.status(201).json({ job, message: 'Job saved to pipeline!' });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobs-search/sources — which APIs are configured
router.get('/sources', (req, res) => {
  res.json({
    remotive:  true, // always available, no key
    arbeitnow: true, // always available, no key
    adzuna:    !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jsearch:   !!process.env.RAPIDAPI_KEY,
  });
});

module.exports = router;