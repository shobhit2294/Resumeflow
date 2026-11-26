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

      // Response time: days from applied to first screening/interview stage change event
      const responseEvent = job.timeline.find((t) =>
        t.type === 'stage_change' && ['Screening', 'Interview'].includes(t.stage)
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

// GET /api/analytics/interview-progress
router.get('/interview-progress', async (req, res, next) => {
  try {
    const interviews = await Interview.find({ user: req.user._id, status: 'completed' })
      .sort({ completedAt: 1 })
      .select('type averageScore completedAt behaviorReport improvements strengths');

    const sessions = interviews.map((interview, index) => ({
      session: index + 1,
      date: interview.completedAt || interview.createdAt,
      label: `Practice ${index + 1}`,
      type: interview.type,
      score: interview.averageScore,
      behaviorScore: interview.behaviorReport?.overallBehaviorScore
        ? Math.round((interview.behaviorReport.overallBehaviorScore / 10) * 10) / 10
        : null,
      improvements: interview.improvements || [],
      strengths: interview.strengths || [],
    }));

    const scored = sessions.filter((session) => session.score != null);
    const latest = scored.at(-1) || null;
    const previous = scored.length > 1 ? scored.at(-2) : null;

    res.json({
      sessions,
      latest,
      scoreChange: latest && previous ? Math.round((latest.score - previous.score) * 10) / 10 : 0,
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

// GET /api/analytics/rejection-patterns
router.get('/rejection-patterns', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const jobs = await Job.find({ user: userId });

    const rejectedJobs = jobs.filter((job) => {
      const isRejectedStage = job.stage === 'Rejected';
      const hasRejectionNotes = Boolean(job.rejectionReason && job.rejectionReason.trim().length > 0);
      const hasTimelineRejection = (job.timeline || []).some((event) => event.type === 'rejection' || /reject/i.test(event.event || ''));
      return isRejectedStage || hasRejectionNotes || hasTimelineRejection;
    });

    if (!rejectedJobs.length) {
      return res.json({
        totalRejected: 0,
        summary: 'No rejection data yet. Keep applying to unlock pattern analysis.',
        weakSkills: [],
        roleBreakdown: [],
        recommendations: [
          'Apply to a few more roles so the analyzer can detect meaningful patterns.',
          'Review your resume against the top 3 job descriptions you care about most.',
        ],
      });
    }

    const skillKeywords = [
      'javascript', 'typescript', 'react', 'node', 'python', 'java', 'c#', 'go', 'rust',
      'sql', 'mongodb', 'postgres', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'microservices',
      'system design', 'api', 'rest', 'graphql', 'testing', 'unit testing', 'communication',
      'leadership', 'problem solving', 'data structures', 'algorithms', 'machine learning',
      'product sense', 'security', 'devops', 'cloud', 'frontend', 'backend'
    ];

    const skillCount = {};
    const roleCount = {};
    const missingSignals = [];
    let totalMatchScore = 0;
    let matchCount = 0;

    rejectedJobs.forEach((job) => {
      const text = `${job.role} ${job.jobDescription || ''} ${job.tags?.join(' ') || ''}`.toLowerCase();

      skillKeywords.forEach((skill) => {
        if (text.includes(skill)) {
          skillCount[skill] = (skillCount[skill] || 0) + 1;
        }
      });

      const normalizedRole = job.role || 'Unknown role';
      roleCount[normalizedRole] = (roleCount[normalizedRole] || 0) + 1;

      if (job.resumeMatchScore != null) {
        totalMatchScore += Number(job.resumeMatchScore);
        matchCount += 1;
      }

      const rejectionText = `${job.rejectionReason || ''} ${job.notes?.map((n) => n.text).join(' ') || ''}`.toLowerCase();
      if (job.resumeMatchScore != null && job.resumeMatchScore < 60) {
        missingSignals.push('resume fit below target');
      }
      if (/resume|experience|skill|qualification|match/i.test(rejectionText)) {
        missingSignals.push('resume or experience gap');
      }
      if (/role|target|junior|senior|fit/i.test(rejectionText)) {
        missingSignals.push('role targeting mismatch');
      }
    });

    const weakSkills = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([skill, count]) => ({ skill, count }));

    const roleBreakdown = Object.entries(roleCount)
      .sort((a, b) => b[1] - a[1])
      .map(([role, count]) => ({ role, count }));

    const issueCount = {};
    missingSignals.forEach((issue) => {
      issueCount[issue] = (issueCount[issue] || 0) + 1;
    });

    const summaryParts = [];
    if (weakSkills.length) {
      summaryParts.push(`Your most repeated weakness is ${weakSkills[0].skill}.`);
    }
    if (matchCount > 0) {
      const avgMatch = Math.round(totalMatchScore / matchCount);
      summaryParts.push(`Your rejected roles average a resume-fit score of ${avgMatch}%.`);
    }
    if (roleBreakdown.length > 1) {
      summaryParts.push(`You are targeting ${roleBreakdown[0].role} repeatedly, which may be pulling your profile into the same pattern.`);
    }

    const recommendations = [
      'Improve the resume bullets that map to your weakest repeated skills and add measurable outcomes.',
      'Tighten your role targeting so your applications align more closely with your strongest background.',
      'Prioritize a few high-fit roles instead of sending large numbers of low-fit applications.',
      'Run a readiness check on the top 3 job descriptions that keep producing rejections.'
    ];

    if (weakSkills.length) {
      recommendations.unshift(`Focus on strengthening: ${weakSkills.slice(0, 3).map((s) => s.skill).join(', ')}.`);
    }

    res.json({
      totalRejected: rejectedJobs.length,
      summary: summaryParts.join(' '),
      weakSkills,
      roleBreakdown: roleBreakdown.slice(0, 5),
      issueDistribution: Object.entries(issueCount).map(([label, count]) => ({ label, count })),
      recommendations,
      averageResumeMatch: matchCount > 0 ? Math.round(totalMatchScore / matchCount) : null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/funnel-benchmarks — Compare against Tech Industry Conversion Standards
router.get('/funnel-benchmarks', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const jobs = await Job.find({ user: userId });
    const total = jobs.length;

    const appliedCount = total;
    const screeningCount = jobs.filter((j) =>
      ['Screening', 'Interview', 'Offer'].includes(j.stage) ||
      j.stageHistory?.some(h => ['Screening', 'Interview', 'Offer'].includes(h.to))
    ).length;
    const interviewCount = jobs.filter((j) =>
      ['Interview', 'Offer'].includes(j.stage) ||
      j.stageHistory?.some(h => ['Interview', 'Offer'].includes(h.to))
    ).length;
    const offerCount = jobs.filter((j) =>
      j.stage === 'Offer' ||
      j.stageHistory?.some(h => h.to === 'Offer')
    ).length;

    // Actual user rates
    const appliedToScreening = appliedCount > 0 ? Math.round((screeningCount / appliedCount) * 100) : 0;
    const screeningToInterview = screeningCount > 0 ? Math.round((interviewCount / screeningCount) * 100) : 0;
    const interviewToOffer = interviewCount > 0 ? Math.round((offerCount / interviewCount) * 100) : 0;

    // Tech Industry Standards (Aggregated 2024-2026 tech benchmarks)
    const benchmarks = {
      appliedToScreening: 12,
      screeningToInterview: 45,
      interviewToOffer: 22,
    };

    let bottleneck = 'healthy';
    let diagnosis = 'Healthy pipeline! Add more applications to establish deeper statistical significance.';
    let recommendation = 'Keep momentum by tracking 5-10 tailored applications per week.';

    if (total >= 4) {
      if (appliedToScreening < benchmarks.appliedToScreening * 0.7) {
        bottleneck = 'resume_ats';
        diagnosis = `Top-of-funnel drop-off (${appliedToScreening}% vs ${benchmarks.appliedToScreening}% benchmark). Applications are being filtered out before reaching a recruiter.`;
        recommendation = 'Run target roles through Evidence-Based Job Readiness and 3-Point Proof Pitch. Prioritize warm referrals using the Referral Pathmaker.';
      } else if (screeningToInterview < benchmarks.screeningToInterview * 0.7) {
        bottleneck = 'screening_call';
        diagnosis = `Recruiter screen drop-off (${screeningToInterview}% vs ${benchmarks.screeningToInterview}% benchmark). Passing resume screen but dropping at the initial phone screen.`;
        recommendation = 'Sharpen your 60-second elevator pitch hook and rehearse salary expectation questions using Company Intel Dossier.';
      } else if (interviewToOffer < benchmarks.interviewToOffer * 0.7) {
        bottleneck = 'technical_loop';
        diagnosis = `Final loop conversion drop-off (${interviewToOffer}% vs ${benchmarks.interviewToOffer}% benchmark). Reaching the interview stage but getting edged out on final offers.`;
        recommendation = 'Practice deep architectural questions with AI Mock Interview, use Meeting Mode Teleprompter for STAR stories, and send Post-Interview Debrief recovery emails.';
      } else {
        bottleneck = 'healthy';
        diagnosis = 'Your conversion rates exceed industry averages at every stage of the funnel!';
        recommendation = 'Focus on pipeline volume and use Offer Negotiator to compare total compensation across multiple offers.';
      }
    }

    res.json({
      total,
      counts: { applied: appliedCount, screening: screeningCount, interview: interviewCount, offer: offerCount },
      userRates: { appliedToScreening, screeningToInterview, interviewToOffer },
      benchmarks,
      bottleneck,
      diagnosis,
      recommendation,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
