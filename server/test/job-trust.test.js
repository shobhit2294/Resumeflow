const test = require('node:test');
const assert = require('node:assert/strict');
const { assessJobRisk, hasValidSecureJobUrl } = require('../utils/job-trust');

test('job trust checks flag upfront fees and sensitive information requests', () => {
  const result = assessJobRisk({
    title: 'Remote Engineer',
    company: 'Example Company',
    description: 'Pay an application fee and provide your bank account before the interview.',
    url: 'https://example.com/jobs/1',
    source: 'Company site',
  });

  assert.equal(result.riskLevel, 'high');
  assert.ok(result.flags.some((flag) => flag.includes('upfront fees')));
  assert.ok(result.flags.some((flag) => flag.includes('financial')));
});

test('community GitHub listings get a verification warning but are not automatically declared fraudulent', () => {
  const result = assessJobRisk({
    title: 'Software Engineer — hiring now',
    company: 'sample-org',
    description: 'We are hiring engineers. Apply at our official careers site.',
    url: 'https://github.com/sample-org/jobs/issues/12',
    source: 'GitHub',
  });

  assert.equal(result.riskLevel, 'medium');
  assert.ok(result.flags.some((flag) => flag.includes('Community-posted')));
});

test('secure job links must be HTTPS and cannot contain embedded credentials', () => {
  assert.equal(hasValidSecureJobUrl('https://example.com/careers'), true);
  assert.equal(hasValidSecureJobUrl('http://example.com/careers'), false);
  assert.equal(hasValidSecureJobUrl('https://user:password@example.com/job'), false);
  assert.equal(hasValidSecureJobUrl('not a URL'), false);
});
