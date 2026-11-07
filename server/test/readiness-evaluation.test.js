const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateEvaluationMetrics,
  feedbackConsistency,
  keywordSimilarity,
  rankSkillEvidence,
  sentenceEvidence,
  verifiedResumeEvidence,
  weightedSkillScore,
} = require('../utils/readiness-matching');

const evaluationPairs = [
  {
    id: 'frontend-engineer',
    jobDescription: 'Build React and TypeScript interfaces. AWS experience preferred.',
    knownSkills: ['React', 'TypeScript', 'AWS', 'Kubernetes'],
    expectedMatches: ['React', 'TypeScript', 'AWS'],
    resume: 'Built customer dashboards using React and TypeScript. Deployed services on Amazon Web Services.',
    embeddings: {
      React: [1, 0, 0],
      TypeScript: [0, 1, 0],
      AWS: [0, 0, 1],
      'Built customer dashboards using React and TypeScript.': [0.8, 0.8, 0],
      'Deployed services on Amazon Web Services.': [0, 0, 1],
    },
  },
  {
    id: 'backend-engineer',
    jobDescription: 'Develop services with Python and PostgreSQL. Docker is a plus.',
    knownSkills: ['Python', 'PostgreSQL', 'Docker'],
    expectedMatches: ['Python', 'PostgreSQL'],
    resume: 'Maintained Python services. Designed relational database schemas.',
    embeddings: {
      Python: [1, 0, 0],
      PostgreSQL: [0, 1, 0],
      Docker: [0, 0, 1],
      'Maintained Python services.': [1, 0, 0],
      'Designed relational database schemas.': [0, 1, 0],
    },
  },
];

function evaluatePair(pair) {
  const skills = pair.knownSkills.map((skill) => {
    const sentences = sentenceEvidence(pair.resume);
    const evidence = rankSkillEvidence(
      skill,
      sentences,
      pair.embeddings[skill],
      sentences.map((sentence) => pair.embeddings[sentence])
    );
    return { skill, ...evidence };
  });
  const rankedMatches = [...skills]
    .sort((left, right) => right.score - left.score)
    .filter((item) => item.found)
    .map((item) => item.skill);

  return {
    ...pair,
    predictedMatches: skills.filter((item) => item.found).map((item) => item.skill),
    rankedMatches,
    skills,
  };
}

test('manually reviewed resume/job set measures extraction and ranking quality', () => {
  const results = evaluationPairs.map(evaluatePair);
  const metrics = calculateEvaluationMetrics(results);

  assert.equal(metrics.precision, 1);
  assert.equal(metrics.recall, 1);
  assert.equal(metrics.extractionAccuracy, 1);
  assert.equal(metrics.meanReciprocalRank, 1);
  assert.ok(results.every((pair) => pair.skills.every(
    (match) => !match.evidence || pair.resume.includes(match.evidence)
  )));
});

test('semantic evidence accepts a relevant sentence without an exact skill keyword', () => {
  const match = rankSkillEvidence(
    'PostgreSQL',
    ['Designed relational database schemas.'],
    [0, 1],
    [[0, 1]]
  );

  assert.equal(match.found, true);
  assert.equal(match.evidence, 'Designed relational database schemas.');
  assert.equal(match.keywordSimilarity, 0);
  assert.equal(match.embeddingSimilarity, 100);
});

test('skill scores respect required-skill importance', () => {
  assert.equal(weightedSkillScore([
    { importance: 'critical', score: 100 },
    { importance: 'nice-to-have', score: 0 },
  ]), 80);
});

test('skill matching recognizes common equivalent names without substring false positives', () => {
  assert.equal(keywordSimilarity('AWS', 'Deployed workloads on Amazon Web Services.'), 1);
  assert.equal(keywordSimilarity('Go', 'Built a Google Cloud deployment.'), 0);
});

test('resume evidence is returned verbatim from the uploaded source and fabricated quotes are rejected', () => {
  const resume = 'Built dashboards with React.\nLed a team of four engineers.';
  assert.equal(verifiedResumeEvidence('led a team of four engineers.', resume), 'Led a team of four engineers.');
  assert.equal(verifiedResumeEvidence('Managed a team of ten engineers.', resume), '');
});

test('identical interview answers receive a measurable consistency score', () => {
  const scores = { relevance: 8, technical: 7, clarity: 9, problemSolving: 8 };
  assert.equal(feedbackConsistency([
    { answerKey: 'answer-1', scores },
    { answerKey: 'answer-1', scores },
  ]), 1);
  assert.ok(feedbackConsistency([
    { answerKey: 'answer-1', scores },
    { answerKey: 'answer-1', scores: { relevance: 2, technical: 1, clarity: 3, problemSolving: 2 } },
  ]) < 1);
});
