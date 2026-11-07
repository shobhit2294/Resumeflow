const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const { protect } = require('../middleware/auth');
const Job = require('../models/Job');
const { assessJobRisk, hasValidSecureJobUrl } = require('../utils/job-trust');

const router = express.Router();
router.use(protect);

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cache = new NodeCache({ stdTTL: 600 });

function normalize(job) {
  return {
    externalId: job.externalId || '',
    source: job.source || 'Other',
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    remote: job.remote || false,
    salaryMin: job.salaryMin || null,
    salaryMax: job.salaryMax || null,
    currency: job.currency || 'USD',
    description: job.description || '',
    url: job.url || '',
    postedAt: job.postedAt || new Date().toISOString(),
    tags: job.tags || [],
    jobType: job.jobType || 'full-time',
  };
}

async function fetchRemotive(query, limit = 20) {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${limit}`;
    const { data } = await axios.get(url, { timeout: 8000 });
    return (data.jobs || []).map((job) => normalize({
      externalId: `remotive-${job.id}`,
      source: 'Remotive',
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || 'Remote',
      remote: true,
      description: job.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
      url: job.url,
      postedAt: job.publication_date,
      tags: job.tags || [],
      jobType: job.job_type || 'full-time',
    }));
  } catch (err) {
    console.error('Remotive error:', err.message);
    return [];
  }
}

async function fetchAdzuna(query, location = 'us', limit = 20) {
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return [];

    const normalizedLocation = location.toLowerCase();
    const country = normalizedLocation.includes('india') ? 'in'
      : normalizedLocation.includes('uk') ? 'gb'
        : normalizedLocation.includes('canada') ? 'ca'
          : 'us';
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=${limit}&what=${encodeURIComponent(query)}&content-type=application/json`;
    const { data } = await axios.get(url, { timeout: 8000 });

    return (data.results || []).map((job) => normalize({
      externalId: `adzuna-${job.id}`,
      source: 'Adzuna',
      title: job.title,
      company: job.company?.display_name || '',
      location: job.location?.display_name || '',
      remote: job.title?.toLowerCase().includes('remote') || false,
      salaryMin: job.salary_min ? Math.round(job.salary_min) : null,
      salaryMax: job.salary_max ? Math.round(job.salary_max) : null,
      description: job.description?.substring(0, 500) || '',
      url: job.redirect_url,
      postedAt: job.created,
    }));
  } catch (err) {
    console.error('Adzuna error:', err.message);
    return [];
  }
}

async function fetchJSearch(query, location = '', limit = 10) {
  try {
    const key = process.env.RAPIDAPI_KEY;
    if (!key) return [];

    const { data } = await axios.get('https://jsearch.p.rapidapi.com/search', {
      params: {
        query: `${query} ${location}`.trim(),
        page: '1',
        num_pages: '1',
        date_posted: 'week',
      },
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      timeout: 8000,
    });

    return (data.data || []).slice(0, limit).map((job) => normalize({
      externalId: `jsearch-${job.job_id}`,
      source: 'JSearch',
      title: job.job_title,
      company: job.employer_name,
      location: job.job_city ? `${job.job_city}, ${job.job_country}` : job.job_country || '',
      remote: job.job_is_remote || false,
      salaryMin: job.job_min_salary ? Math.round(job.job_min_salary) : null,
      salaryMax: job.job_max_salary ? Math.round(job.job_max_salary) : null,
      currency: job.job_salary_currency || 'USD',
      description: job.job_description?.substring(0, 500) || '',
      url: job.job_apply_link,
      postedAt: job.job_posted_at_datetime_utc,
      tags: job.job_required_skills || [],
      jobType: job.job_employment_type || 'full-time',
    }));
  } catch (err) {
    console.error('JSearch error:', err.message);
    return [];
  }
}

async function fetchArbeitnow(query, limit = 20) {
  try {
    const { data } = await axios.get(
      `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`,
      { timeout: 8000 }
    );
    return (data.data || []).slice(0, limit).map((job) => normalize({
      externalId: `arbeitnow-${job.slug}`,
      source: 'Arbeitnow',
      title: job.title,
      company: job.company_name,
      location: job.location || 'Remote',
      remote: job.remote || false,
      description: job.description?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
      url: job.url,
      postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : new Date().toISOString(),
      tags: job.tags || [],
      jobType: job.job_types?.[0] || 'full-time',
    }));
  } catch (err) {
    console.error('Arbeitnow error:', err.message);
    return [];
  }
}

async function fetchGitHubIssues(query, limit = 12) {
  try {
    const searchTerms = String(query || '')
      .split(/\s+/)
      .filter((term) => /^[\p{L}\p{N}+#.-]{2,}$/u.test(term))
      .slice(0, 4)
      .join(' ');
    const issueQuery = ['is:issue', 'is:open', '"hiring"', searchTerms].filter(Boolean).join(' ');
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ResumeFlow-job-search',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const { data } = await axios.get('https://api.github.com/search/issues', {
      params: { q: issueQuery, sort: 'created', order: 'desc', per_page: limit },
      headers,
      timeout: 8000,
    });

    return (data.items || []).map((issue) => {
      const repoPath = String(issue.repository_url || '').split('/repos/')[1] || '';
      const [owner, repository] = repoPath.split('/');
      const description = String(issue.body || '')
        .replace(/!\[[^\]]*]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
        .replace(/[`*_>#]/g, '')
        .substring(0, 3000);

      return normalize({
        externalId: `github-issue-${issue.id}`,
        source: 'GitHub',
        title: issue.title,
        company: owner || repository || 'GitHub community',
        location: 'See listing',
        remote: /\bremote\b/i.test(`${issue.title} ${description}`),
        description,
        url: issue.html_url,
        postedAt: issue.created_at,
        tags: ['Community listing', 'Unverified'],
        jobType: 'full-time',
      });
    });
  } catch (err) {
    console.error('GitHub jobs error:', err.message);
    return [];
  }
}

function configuredBoards(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[a-z0-9_-]{2,80}$/.test(item))
    .slice(0, 30);
}

function matchesQuery(job, query) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  if (!terms.length) return true;
  const content = `${job.title} ${job.company} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
  return terms.some((term) => content.includes(term));
}

async function fetchGreenhouse(query, limit = 20) {
  const boards = configuredBoards(process.env.GREENHOUSE_BOARDS);
  const results = await Promise.all(boards.map(async (board) => {
    try {
      const { data } = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`, {
        params: { content: 'true' },
        timeout: 8000,
      });
      return (data.jobs || []).map((job) => normalize({
        externalId: `greenhouse-${board}-${job.id}`,
        source: 'Greenhouse',
        title: job.title,
        company: board,
        description: String(job.content || '').replace(/<[^>]*>/g, ' ').substring(0, 3000),
        url: job.absolute_url,
        postedAt: job.updated_at,
        location: job.location?.name || '',
        tags: [],
      }));
    } catch (err) {
      console.error(`Greenhouse board "${board}" error:`, err.message);
      return [];
    }
  }));
  return results.flat().filter((job) => matchesQuery(job, query)).slice(0, limit);
}

async function fetchLever(query, limit = 20) {
  const sites = configuredBoards(process.env.LEVER_SITES);
  const results = await Promise.all(sites.map(async (site) => {
    try {
      const { data } = await axios.get(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}`, {
        params: { mode: 'json' },
        timeout: 8000,
      });
      return (Array.isArray(data) ? data : []).map((job) => normalize({
        externalId: `lever-${site}-${job.id}`,
        source: 'Lever',
        title: job.text,
        company: site,
        location: job.categories?.location || '',
        remote: /\bremote\b/i.test(job.categories?.location || ''),
        description: String(job.descriptionPlain || job.description || '').replace(/<[^>]*>/g, ' ').substring(0, 3000),
        url: job.hostedUrl,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        tags: [job.categories?.team, job.categories?.commitment].filter(Boolean),
        jobType: job.categories?.commitment || 'full-time',
      }));
    } catch (err) {
      console.error(`Lever site "${site}" error:`, err.message);
      return [];
    }
  }));
  return results.flat().filter((job) => matchesQuery(job, query)).slice(0, limit);
}

router.get('/search', async (req, res, next) => {
  try {
    const {
      q = 'software engineer',
      location = '',
      remote,
      jobType,
      source,
      page = 1,
      includeSuspicious,
    } = req.query;
    if (String(q).length > 160 || String(location).length > 120) {
      return res.status(400).json({ error: 'Search query or location is too long.' });
    }
    if (includeSuspicious && includeSuspicious !== 'true' && includeSuspicious !== 'false') {
      return res.status(400).json({ error: 'includeSuspicious must be true or false.' });
    }

    const parsedPage = Number.parseInt(page, 10);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ error: 'Page must be a positive integer.' });
    }

    const cacheKey = `search:${q}:${location}:${remote}:${jobType}:${source}:${parsedPage}:${includeSuspicious}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [remotive, adzuna, jsearch, arbeitnow, github, greenhouse, lever] = await Promise.all([
      (!source || source === 'Remotive') ? fetchRemotive(q, 15) : [],
      (!source || source === 'Adzuna') ? fetchAdzuna(q, location, 15) : [],
      (!source || source === 'JSearch') ? fetchJSearch(q, location, 10) : [],
      (!source || source === 'Arbeitnow') ? fetchArbeitnow(q, 15) : [],
      (!source || source === 'GitHub') ? fetchGitHubIssues(q, 12) : [],
      (!source || source === 'Greenhouse') ? fetchGreenhouse(q, 20) : [],
      (!source || source === 'Lever') ? fetchLever(q, 20) : [],
    ]);

    let jobs = [...remotive, ...adzuna, ...jsearch, ...arbeitnow, ...github, ...greenhouse, ...lever]
      .map((job) => ({
        ...job,
        url: hasValidSecureJobUrl(job.url) ? job.url : '',
        trust: assessJobRisk(job),
      }));
    const seen = new Set();
    jobs = jobs.filter((job) => {
      const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (remote === 'true') jobs = jobs.filter((job) => job.remote);
    if (jobType) jobs = jobs.filter((job) => job.jobType?.toLowerCase().includes(String(jobType).toLowerCase()));
    const hiddenSuspiciousCount = jobs.filter((job) => job.trust.riskLevel === 'high').length;
    if (includeSuspicious !== 'true') {
      jobs = jobs.filter((job) => job.trust.riskLevel !== 'high');
    }

    jobs.sort((left, right) => {
      if (left.salaryMin && !right.salaryMin) return -1;
      if (!left.salaryMin && right.salaryMin) return 1;
      return new Date(right.postedAt) - new Date(left.postedAt);
    });

    const perPage = 20;
    const total = jobs.length;
    const start = (parsedPage - 1) * perPage;
    const result = {
      jobs: jobs.slice(start, start + perPage),
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / perPage),
      sources: {
        remotive: remotive.length,
        adzuna: adzuna.length,
        jsearch: jsearch.length,
        arbeitnow: arbeitnow.length,
        github: github.length,
        greenhouse: greenhouse.length,
        lever: lever.length,
        hiddenSuspicious: includeSuspicious === 'true' ? 0 : hiddenSuspiciousCount,
      },
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/save', async (req, res, next) => {
  try {
    const {
      title, company, location, remote, salaryMin, salaryMax,
      currency, description, url, source, tags, jobType,
    } = req.body;

    if (typeof title !== 'string' || !title.trim() || typeof company !== 'string' || !company.trim()) {
      return res.status(400).json({ error: 'Title and company are required.' });
    }
    if (title.length > 200 || company.length > 200 || String(description || '').length > 12000) {
      return res.status(400).json({ error: 'Job title, company, or description exceeds the supported length.' });
    }

    const safeUrl = hasValidSecureJobUrl(url) ? url : '';
    const verifiedTrust = assessJobRisk({
      title,
      company,
      description,
      url: safeUrl,
      source,
    });

    const existing = await Job.findOne({
      user: req.user._id,
      company: { $regex: new RegExp(`^${escapeRegex(company)}$`, 'i') },
      role: { $regex: new RegExp(`^${escapeRegex(title)}$`, 'i') },
    });
    if (existing) {
      return res.status(409).json({ error: 'This job is already in your pipeline.', job: existing });
    }

    const job = await Job.create({
      user: req.user._id,
      role: title,
      company,
      location: location || '',
      remote: remote || false,
      salaryMin: salaryMin || null,
      salaryMax: salaryMax || null,
      currency: currency || 'USD',
      jobDescription: description || '',
      jobUrl: safeUrl,
      source: source || 'Other',
      sourceRisk: verifiedTrust,
      tags: tags || [],
      stage: 'Applied',
    });

    res.status(201).json({ job, message: 'Job saved to pipeline!' });
  } catch (err) {
    next(err);
  }
});

router.get('/sources', (req, res) => {
  res.json({
    remotive: true,
    arbeitnow: true,
    adzuna: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    jsearch: !!process.env.RAPIDAPI_KEY,
    github: true,
    githubAuthenticated: !!process.env.GITHUB_TOKEN,
    greenhouse: configuredBoards(process.env.GREENHOUSE_BOARDS).length > 0,
    lever: configuredBoards(process.env.LEVER_SITES).length > 0,
  });
});

module.exports = router;
