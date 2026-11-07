const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const secret = 'test-only-jwt-secret';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invokeProtect(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = createResponse();
  let nextError;
  let nextCalled = false;
  await protect(req, res, (error) => {
    nextCalled = true;
    nextError = error;
  });
  return { req, res, nextCalled, nextError };
}

test('auth middleware rejects missing, invalid, and expired bearer tokens', async () => {
  process.env.JWT_SECRET = secret;
  const missing = await invokeProtect();
  const invalid = await invokeProtect('not-a-token');
  const expired = await invokeProtect(jwt.sign({ id: 'user-id' }, secret, { expiresIn: -1 }));

  assert.equal(missing.res.statusCode, 401);
  assert.match(missing.res.body.error, /No token/);
  assert.equal(invalid.res.statusCode, 401);
  assert.match(invalid.res.body.error, /Invalid token/);
  assert.equal(expired.res.statusCode, 401);
  assert.match(expired.res.body.error, /expired/i);
});

test('auth middleware loads the token owner and rejects deleted users', async () => {
  process.env.JWT_SECRET = secret;
  const previousFindById = User.findById;
  const user = { _id: 'user-id', name: 'Test User' };
  try {
    User.findById = async () => user;
    const authorized = await invokeProtect(jwt.sign({ id: user._id }, secret));
    assert.equal(authorized.nextCalled, true);
    assert.equal(authorized.nextError, undefined);
    assert.equal(authorized.req.user, user);

    User.findById = async () => null;
    const deleted = await invokeProtect(jwt.sign({ id: user._id }, secret));
    assert.equal(deleted.res.statusCode, 401);
    assert.match(deleted.res.body.error, /no longer exists/i);
  } finally {
    User.findById = previousFindById;
  }
});
