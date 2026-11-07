const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { generateOTP, storeOTP, verifyOTP } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/email');
const { sendOtpSms } = require('../utils/sms');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Helper to determine whether input is an Email or Phone number
 */
function parseContact(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (str.includes('@')) {
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (emailRegex.test(str)) {
      return { type: 'email', value: str.toLowerCase() };
    }
    return null;
  }
  // Remove non-digit chars except leading +
  const digits = str.replace(/[^\d+]/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    return { type: 'phone', value: digits };
  }
  return null;
}

// ─── Unified OTP Flow (Email OR Mobile Phone) ────────────────────────────────

/**
 * POST /api/auth/request-otp
 * Body: { identifier } or { email } or { phone }
 */
router.post('/request-otp', async (req, res, next) => {
  try {
    const rawInput = req.body.identifier || req.body.email || req.body.phone;
    const contact = parseContact(rawInput);
    if (!contact) {
      return res.status(400).json({ error: 'Please enter a valid email address or 10-digit mobile number.' });
    }

    const otp = generateOTP();
    const stored = await storeOTP(contact.value, otp);
    if (!stored) {
      return res.status(429).json({ error: 'Too many OTP requests. Please wait 15 minutes.' });
    }

    // Deliver via Email or SMS depending on the contact type
    if (contact.type === 'email') {
      try {
        await sendOtpEmail(contact.value, otp);
      } catch (mailErr) {
        console.error('Email send failed:', mailErr.message);
      }
    } else {
      try {
        await sendOtpSms(contact.value, otp);
      } catch (smsErr) {
        console.error('SMS send failed:', smsErr.message);
      }
    }

    const query = contact.type === 'email' ? { email: contact.value } : { phone: contact.value };
    const existing = await User.findOne(query);

    const isDevDelivery = (contact.type === 'email' && !process.env.SMTP_USER) ||
                          (contact.type === 'phone' && !process.env.FAST2SMS_API_KEY && !process.env.TWILIO_ACCOUNT_SID);

    res.json({
      exists: !!existing,
      type: contact.type,
      identifier: contact.value,
      message: `OTP sent to your ${contact.type === 'email' ? 'email' : 'mobile number'}`,
      devOtp: isDevDelivery ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { identifier, otp }
 */
router.post('/verify-otp', async (req, res, next) => {
  try {
    const rawInput = req.body.identifier || req.body.email || req.body.phone;
    const contact = parseContact(rawInput);
    if (!contact) {
      return res.status(400).json({ error: 'Valid email address or phone number required.' });
    }

    const { otp } = req.body;
    if (!otp || String(otp).length !== 6) {
      return res.status(400).json({ error: 'OTP must be 6 digits.' });
    }

    const valid = await verifyOTP(contact.value, otp);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP.' });

    const query = contact.type === 'email' ? { email: contact.value } : { phone: contact.value };
    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ userExists: false, message: 'No account found. Please register.' });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/register-with-otp
 * Body: { name, identifier, otp, title? }
 */
router.post('/register-with-otp', async (req, res, next) => {
  try {
    const { name, otp, title } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const rawInput = req.body.identifier || req.body.email || req.body.phone;
    const contact = parseContact(rawInput);
    if (!contact) {
      return res.status(400).json({ error: 'Valid email address or phone number required.' });
    }

    if (!otp || String(otp).length !== 6) {
      return res.status(400).json({ error: 'OTP must be 6 digits.' });
    }

    const valid = await verifyOTP(contact.value, otp);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP.' });

    const query = contact.type === 'email' ? { email: contact.value } : { phone: contact.value };
    let user = await User.findOne(query);
    if (user) {
      const token = signToken(user._id);
      return res.json({ token, user });
    }

    const userData = {
      name: name.trim(),
      title: title || '',
    };
    if (contact.type === 'email') {
      userData.email = contact.value;
    } else {
      userData.phone = contact.value;
    }

    user = await User.create(userData);
    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

// ─── Password Flow (legacy compatibility) ───────────────────────────────────

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { name, email, password, title } = req.body;
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email already in use.' });
      }

      const user = await User.create({ name, email, password, title });
      const token = signToken(user._id);
      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = signToken(user._id);
      res.json({ token, user });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { name, title, skills, preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, title, skills, preferences },
      { new: true, runValidators: true }
    );
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/change-password
router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
