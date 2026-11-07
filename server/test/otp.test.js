const test = require('node:test');
const assert = require('node:assert/strict');
const { getRedis } = require('../utils/redis');
const { storeOTP, verifyOTP } = require('../utils/otp');

test('OTP storage and verification fall back to memory when Redis is not configured', async () => {
  const previousRedisUrl = process.env.REDIS_URL;
  const email = `otp-test-${Date.now()}@example.com`;

  try {
    process.env.REDIS_URL = '';
    assert.equal(getRedis(), null);
    assert.equal(await storeOTP(email, '123456'), true);
    assert.equal(await verifyOTP(email, '000000'), false);
    assert.equal(await verifyOTP(email, '123456'), true);
    assert.equal(await verifyOTP(email, '123456'), false);
  } finally {
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  }
});
