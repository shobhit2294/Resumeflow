const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allows null for phone-only users
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows null for email-only users
      trim: true,
    },
    password: {
      type: String,
      required: false, // Optional — OTP-only users have no password
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    title: {
      type: String,
      default: '',
      maxlength: 100,
    },
    skills: [{ type: String }],
    resumeText: {
      type: String,
      default: '',
    },
    resumeScore: {
      type: Number,
      default: null,
    },
    avatar: {
      type: String,
      default: '',
    },
    preferences: {
      targetRoles: [String],
      targetSalaryMin: Number,
      targetSalaryMax: Number,
      preferredLocations: [String],
      remoteOnly: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // OTP-only account has no password
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
