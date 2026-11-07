const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

/**
 * GET /api/recommendations
 * Returns job recommendations ranked by skill overlap with the user's profile.
 */
router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    const userSkills = (user.skills || []).map((s) => s.toLowerCase().trim());
    const userTitle = (user.title || '').toLowerCase();
    const userPrefs = user.preferences || {};

    // Import models lazily to avoid circular deps
    const Job = require('../models/Job');

    // Build a query to find relevant saved jobs (from pipeline)
    const savedJobs = await Job.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Also try to pull from PortalJob if the model exists
    let portalJobs = [];
    try {
      const PortalJob = require('../models/PortalJob');
      const titleKeywords = userTitle.split(' ').filter((w) => w.length > 2);
      const query =
        titleKeywords.length > 0
          ? { $or: titleKeywords.map((kw) => ({ title: { $regex: kw, $options: 'i' } })) }
          : {};

      if (userPrefs.remoteOnly) query.isRemote = true;
      if (userPrefs.preferredLocations?.length) {
        query.$or = [
          ...(query.$or || []),
          ...userPrefs.preferredLocations.map((loc) => ({ location: { $regex: loc, $options: 'i' } })),
        ];
      }

      portalJobs = await PortalJob.find(query).limit(50).lean();
    } catch (_) {
      // PortalJob model may not exist — skip
    }

    // Merge and score
    const allJobs = [...savedJobs, ...portalJobs];

    const scored = allJobs.map((job) => {
      const jobText = [
        job.title || '',
        job.company || '',
        job.description || '',
        ...(job.requirements || []),
        ...(job.skills || []),
      ]
        .join(' ')
        .toLowerCase();

      let matchedSkills = [];
      let score = 0;

      if (userSkills.length > 0) {
        matchedSkills = userSkills.filter((skill) => jobText.includes(skill));
        score = Math.round((matchedSkills.length / userSkills.length) * 100);
      } else if (userTitle) {
        // Fall back to title keyword match
        const titleWords = userTitle.split(' ').filter((w) => w.length > 3);
        const hits = titleWords.filter((w) => jobText.includes(w));
        score = titleWords.length > 0 ? Math.round((hits.length / titleWords.length) * 100) : 0;
      }

      return {
        _id: job._id,
        title: job.title || 'Unknown Role',
        company: job.company || '',
        location: job.location || '',
        salary: job.salary || job.salaryRange || '',
        url: job.url || job.applyUrl || '',
        matchScore: score,
        matchedSkills,
        source: job.user ? 'pipeline' : 'portal',
        stage: job.stage || null,
        createdAt: job.createdAt,
      };
    });

    // Sort by match score desc, deduplicate by title+company
    const seen = new Set();
    const recommendations = scored
      .sort((a, b) => b.matchScore - a.matchScore)
      .filter((j) => {
        const key = `${j.title}|${j.company}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);

    res.json({ recommendations, userSkills, userTitle });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

