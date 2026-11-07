const { getRedis } = require('./redis');

// In-memory fallback when Redis is unavailable
const memStore = new Map(); // key → { otp, expiresAt }
const rateLimitStore = new Map(); // key → [timestamps]

const OTP_TTL_SEC = 600; // 10 minutes
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_MAX = 5; // max 5 OTPs per email per window

/** Generate a 6-digit OTP string */
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Check if this email has exceeded the rate limit */
function checkRateLimit(email) {
  const key = `otp:rate:${email}`;
  const now = Date.now();
  const timestamps = (rateLimitStore.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_MAX) return false;
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  return true;
}

/**
 * Store OTP in Redis (with TTL) or in-memory fallback.
 * Returns false if rate limit exceeded.
 */
async function storeOTP(email, otp) {
  if (!checkRateLimit(email)) return false;

  const redis = getRedis();
  const redisKey = `otp:${email}`;

  if (redis?.status === 'ready') {
    try {
      await redis.setex(redisKey, OTP_TTL_SEC, otp);
      return true;
    } catch (_) {
      // fall through to memory
    }
  }

  // In-memory fallback
  memStore.set(email, { otp, expiresAt: Date.now() + OTP_TTL_SEC * 1000 });
  return true;
}

/**
 * Verify the OTP. Deletes it on success (single-use).
 * Returns true if valid, false otherwise.
 */
async function verifyOTP(email, otp) {
  const redis = getRedis();
  const redisKey = `otp:${email}`;

  if (redis?.status === 'ready') {
    try {
      const stored = await redis.get(redisKey);
      if (stored) {
        if (stored !== String(otp)) return false;
        await redis.del(redisKey);
        return true;
      }
    } catch (_) {
      // fall through to memory
    }
  }

  // In-memory fallback
  const entry = memStore.get(email);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(email);
    return false;
  }
  if (entry.otp !== String(otp)) return false;
  memStore.delete(email);
  return true;
}

module.exports = { generateOTP, storeOTP, verifyOTP };
