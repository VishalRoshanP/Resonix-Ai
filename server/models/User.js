const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider === 'local';
      },
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    badgeId: {
      type: String,
      default: function () {
        return `BDG-${Math.floor(1000 + Math.random() * 9000)}`;
      },
      trim: true,
    },
    organization: {
      type: String,
      default: 'NDRF Command Triage',
      trim: true,
    },
    department: {
      type: String,
      default: 'Emergency Response Squad',
      trim: true,
    },
    role: {
      type: String,
      enum: ['Responder', 'Coordinator', 'Administrator', 'citizen', 'responder', 'commander', 'admin'],
      default: 'Responder',
    },
    approvalStatus: {
      type: String,
      enum: ['APPROVED', 'PENDING_APPROVAL', 'REJECTED'],
      default: 'APPROVED',
    },
    language: {
      type: String,
      default: 'en',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    stationId: {
      type: String,
      default: 'STATION-ALPHA',
    },
    sector: {
      type: String,
      default: 'Sector 4',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    resetPasswordOtp: {
      type: String,
      default: null,
    },
    resetPasswordOtpExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
