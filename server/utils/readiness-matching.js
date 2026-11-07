const SKILL_ALIASES = {
  aws: ['amazon web services'],
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp', 'google cloud'],
  'javascript': ['js', 'ecmascript'],
  'typescript': ['ts'],
  'python': ['py'],
  'postgresql': ['postgres'],
  'mongodb': ['mongo'],
  'node.js': ['nodejs', 'node'],
  'react.js': ['react'],
  'vue.js': ['vue'],
  'next.js': ['nextjs'],
  'express.js': ['express'],
  'kubernetes': ['k8s'],
  'continuous integration': ['ci/cd', 'continuous delivery', 'deployment pipelines'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'rest api': ['restful api', 'rest apis'],
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.+#/ -]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[\s/]+/)
    .filter((token) => token.length > 1);
}

function sentenceEvidence(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\r?\n/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function verifiedResumeEvidence(evidence, resumeText) {
  if (typeof evidence !== 'string' || !evidence.trim()) return '';
  const escaped = evidence.trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  const match = String(resumeText || '').match(new RegExp(escaped, 'i'));
  return match ? match[0] : '';
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    dot += a * b;
    leftMagnitude += a * a;
    rightMagnitude += b * b;
  }

  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function keywordSimilarity(skill, sentence) {
  const normalizedSkill = normalizeText(skill);
  const normalizedSentence = normalizeText(sentence);
  if (!normalizedSkill || !normalizedSentence) return 0;

  const aliases = SKILL_ALIASES[normalizedSkill] || [];
  const phrases = [normalizedSkill, ...aliases];
  if (phrases.some((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(normalizedSentence);
  })) {
    return 1;
  }

  const skillTokens = [...new Set(tokenize(skill))];
  if (!skillTokens.length) return 0;
  const sentenceTokens = new Set(tokenize(sentence));
  return skillTokens.filter((token) => sentenceTokens.has(token)).length / skillTokens.length;
}

function rankSkillEvidence(skill, sentences, skillEmbedding, sentenceEmbeddings) {
  let best = {
    evidence: '',
    keywordSimilarity: 0,
    embeddingSimilarity: 0,
    score: 0,
  };

  sentences.forEach((sentence, index) => {
    const keyword = keywordSimilarity(skill, sentence);
    const similarity = Math.max(0, cosineSimilarity(skillEmbedding, sentenceEmbeddings[index]));
    const embeddingScore = Math.max(0, Math.min(100, ((similarity - 0.2) / 0.5) * 100));
    const score = Math.round((keyword * 35 + embeddingScore * 65) * 10) / 10;

    if (score > best.score) {
      best = {
        evidence: keyword > 0 || similarity >= 0.5 ? sentence : '',
        keywordSimilarity: Math.round(keyword * 100),
        embeddingSimilarity: Math.round(similarity * 100),
        score,
      };
    }
  });

  return {
    ...best,
    found: Boolean(best.evidence) && (best.keywordSimilarity >= 50 || best.embeddingSimilarity >= 50),
  };
}

function weightedSkillScore(skills) {
  if (!skills.length) return 0;
  const weights = { critical: 4, high: 3, medium: 2, 'nice-to-have': 1 };
  const totalWeight = skills.reduce((sum, skill) => sum + (weights[skill.importance] || 2), 0);
  if (!totalWeight) return 0;
  return Math.round(
    skills.reduce((sum, skill) => sum + skill.score * (weights[skill.importance] || 2), 0) / totalWeight
  );
}

function calculateEvaluationMetrics(cases) {
  const relevant = cases.reduce((sum, item) => sum + item.expectedMatches.length, 0);
  const retrieved = cases.reduce((sum, item) => sum + item.predictedMatches.length, 0);
  let classifications = 0;
  let correctClassifications = 0;
  for (const item of cases) {
    const expected = new Set(item.expectedMatches);
    const predicted = new Set(item.predictedMatches);
    for (const skill of item.knownSkills || []) {
      classifications += 1;
      if (expected.has(skill) === predicted.has(skill)) correctClassifications += 1;
    }
  }
  const truePositives = cases.reduce((sum, item) => {
    const expected = new Set(item.expectedMatches);
    return sum + item.predictedMatches.filter((match) => expected.has(match)).length;
  }, 0);
  const reciprocalRank = cases.reduce((sum, item) => {
    const expected = new Set(item.expectedMatches);
    const firstRelevant = item.rankedMatches.findIndex((match) => expected.has(match));
    return sum + (firstRelevant === -1 ? 0 : 1 / (firstRelevant + 1));
  }, 0);

  return {
    precision: retrieved ? truePositives / retrieved : 0,
    recall: relevant ? truePositives / relevant : 0,
    meanReciprocalRank: cases.length ? reciprocalRank / cases.length : 0,
    extractionAccuracy: classifications ? correctClassifications / classifications : 0,
  };
}

function feedbackConsistency(evaluations) {
  const repeatedAnswers = new Map();
  for (const evaluation of evaluations) {
    const key = evaluation.answerKey;
    if (!key) continue;
    if (!repeatedAnswers.has(key)) repeatedAnswers.set(key, []);
    repeatedAnswers.get(key).push(evaluation.scores);
  }

  const differences = [];
  for (const scores of repeatedAnswers.values()) {
    if (scores.length < 2) continue;
    const dimensions = ['relevance', 'technical', 'clarity', 'problemSolving'];
    for (let left = 0; left < scores.length; left += 1) {
      for (let right = left + 1; right < scores.length; right += 1) {
        differences.push(
          dimensions.reduce((sum, dimension) => {
            const a = Number(scores[left]?.[dimension]);
            const b = Number(scores[right]?.[dimension]);
            return sum + (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) : 10);
          }, 0) / dimensions.length
        );
      }
    }
  }

  if (!differences.length) return 1;
  return Math.max(0, 1 - differences.reduce((sum, difference) => sum + difference, 0) / differences.length / 10);
}

module.exports = {
  calculateEvaluationMetrics,
  cosineSimilarity,
  feedbackConsistency,
  keywordSimilarity,
  rankSkillEvidence,
  sentenceEvidence,
  verifiedResumeEvidence,
  weightedSkillScore,
};
