const RISK_SIGNALS = [
  {
    pattern: /\b(application|interview|training|onboarding|equipment|background check)\s+(?:fee|payment|deposit)\b|\bpay\s+(?:to|for)\s+(?:apply|interview|training|equipment)\b/i,
    score: 70,
    flag: 'Requests upfront fees or payment.',
  },
  {
    pattern: /\b(cash|deposit)\s+(?:this|the)\s+check\b|\b(overpayment|refund the difference|buy equipment with (?:our|the) check)\b/i,
    score: 65,
    flag: 'Mentions a check, overpayment, or refund arrangement commonly used in job scams.',
  },
  {
    pattern: /\b(send|share|provide)\s+(?:us\s+)?(?:your\s+)?(?:bank account|credit card|social security|social insurance|passport|password)\b/i,
    score: 60,
    flag: 'Requests sensitive financial, identity, or account information.',
  },
  {
    pattern: /\b(only|exclusively)\s+(?:communicate|contact|interview)\s+(?:through|via)\s+(?:telegram|whatsapp|signal|discord)\b/i,
    score: 35,
    flag: 'Requires contact exclusively through a messaging service.',
  },
  {
    pattern: /\bguaranteed\s+(?:job|employment|income)\b|\bno experience required\b.{0,100}\b\$[\d,]+(?:\s*\/?\s*(?:day|week))?\b/i,
    score: 25,
    flag: 'Promises guaranteed employment or unusually easy high pay.',
  },
];

function assessJobRisk(job) {
  const text = `${job.title || ''}\n${job.company || ''}\n${job.description || ''}\n${job.url || ''}`;
  const flags = [];
  let riskScore = 0;

  for (const signal of RISK_SIGNALS) {
    if (signal.pattern.test(text)) {
      riskScore = Math.min(100, riskScore + signal.score);
      flags.push(signal.flag);
    }
  }

  if (!job.company || !job.title || !/^https:\/\//i.test(job.url || '')) {
    riskScore = Math.min(100, riskScore + 25);
    flags.push('Missing a company, role title, or secure job listing link.');
  }

  if (job.source === 'GitHub') {
    riskScore = Math.min(100, riskScore + 20);
    flags.push('Community-posted GitHub listing; verify the employer and application link independently.');
  }

  const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low';
  return { riskScore, riskLevel, flags };
}

function hasValidSecureJobUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

module.exports = { assessJobRisk, hasValidSecureJobUrl };
