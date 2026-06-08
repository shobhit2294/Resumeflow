const express = require('express');
const Job = require('../models/Job');
const Interview = require('../models/Interview');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/analytics/overview
router.get('/overview', async (req, res, next) => {
  try {
    const userId = req.user._id;

    const jobs = await Job.find({ user: userId });
    const total = jobs.length;
    const byStage = {};
    const bySource = {};
    const byPriority = {};
    let totalResponseTime = 0;
    let responseCount = 0;
    let totalSalaryMin = 0;
    let salaryCount = 0;

    jobs.forEach((job) => {
      byStage[job.stage] = (byStage[job.stage] || 0) + 1;
      bySource[job.source] = (bySource[job.source] || 0) + 1;
      byPriority[job.priority] = (byPriority[job.priority] || 0) + 1;

      // Response time: days from applied to first screening/interview event
      const responseEvent = job.timeline.find((t) =>
        ['Screening', 'Interview'].includes(t.event?.split(' ').pop())
      );
      if (responseEvent && job.appliedDate) {
        const days = Math.round(
          (new Date(responseEvent.date) - new Date(job.appliedDate)) / (1000 * 60 * 60 * 24)
        );
        if (days > 0 && days < 90) {
          totalResponseTime += days;
          responseCount++;
        }
      }

      if (job.salaryMin) {
        totalSalaryMin += job.salaryMin;
        salaryCount++;
      }
    });

    const interviewed = (byStage['Interview'] || 0) + (byStage['Offer'] || 0);
    const offers = byStage['Offer'] || 0;

    const interviews = await Interview.find({ user: userId });
    const completedInterviews = interviews.filter((i) => i.status === 'completed');
    const avgInterviewScore =
      completedInterviews.length > 0
        ? Math.round(
            (completedInterviews.reduce((s, i) => s + (i.averageScore || 0), 0) /
              completedInterviews.length) * 10
          ) / 10
        : null;

    // Applications per week (last 8 weeks)
    const weeklyData = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = jobs.filter((j) => {
        const d = new Date(j.appliedDate);
        return d >= weekStart && d < weekEnd;
      }).length;

      weeklyData.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      });
    }

    res.json({
      total,
      byStage,
      bySource,
      byPriority,
      responseRate: total > 0 ? Math.round((interviewed / total) * 100) : 0,
      offerRate: total > 0 ? Math.round((offers / total) * 100) : 0,
      avgResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : null,
      avgSalary: salaryCount > 0 ? Math.round(totalSalaryMin / salaryCount) : null,
      totalInterviews: interviews.length,
      avgInterviewScore,
      weeklyApplications: weeklyData,
      active: (byStage['Screening'] || 0) + (byStage['Interview'] || 0),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/insights — AI-style insights
router.get('/insights', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const jobs = await Job.find({ user: userId });

    const insights = [];

    // Best source
    const sourceCount = {};
    jobs.forEach((j) => {
      if (j.source) sourceCount[j.source] = (sourceCount[j.source] || 0) + 1;
    });
    const topSource = Object.entries(sourceCount).sort((a, b) => b[1] - a[1])[0];
    if (topSource) {
      insights.push({
        type: 'source',
        title: `Top source: ${topSource[0]}`,
        text: `${Math.round((topSource[1] / jobs.length) * 100)}% of your applications came from ${topSource[0]}.`,
      });
    }

    // Follow-up reminder
    const noFollowUp = jobs.filter(
      (j) => j.stage === 'Applied' && !j.followUpDate && !j.timeline.find((t) => t.event.includes('follow'))
    ).length;
    if (noFollowUp > 0) {
      insights.push({
        type: 'followup',
        title: 'Missing follow-ups',
        text: `${noFollowUp} applications have no follow-up scheduled. Following up within 5 days increases responses by ~60%.`,
      });
    }

    // Rejection analysis
    const rejected = jobs.filter((j) => j.stage === 'Rejected').length;
    if (rejected > 3) {
      insights.push({
        type: 'rejection',
        title: 'High rejection rate',
        text: `You have ${rejected} rejections. Consider updating your resume or targeting different roles.`,
      });
    }

    res.json({ insights });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
