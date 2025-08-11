import mongoose from 'mongoose';

const LoginAttemptSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    index: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastAttempt: {
    type: Date,
    default: Date.now
  },
  blockedUntil: {
    type: Date,
    default: null
  },
  
  attemptType: {
    type: String,
    enum: ['login', '2fa'],
    default: 'login'
  }
}, {
  timestamps: true
});


LoginAttemptSchema.index({ blockedUntil: 1 }, { 
  expireAfterSeconds: 86400, 
  partialFilterExpression: { blockedUntil: { $exists: true, $ne: null } }
});


LoginAttemptSchema.methods.isBlocked = function() {
  return this.blockedUntil && this.blockedUntil > new Date();
};


LoginAttemptSchema.methods.getBlockedTimeLeft = function() {
  if (!this.isBlocked()) return 0;
  return Math.ceil((this.blockedUntil - new Date()) / 1000); 
};


LoginAttemptSchema.statics.incFailedAttempt = async function(ip, attemptType = 'login') {
  const maxAttempts = 5;
  const blockDuration = 15 * 60 * 1000; 
  
  const attempt = await this.findOneAndUpdate(
    { ip, attemptType },
    { 
      $inc: { attempts: 1 },
      $set: { lastAttempt: new Date() }
    },
    { upsert: true, new: true }
  );

  
  if (attempt.attempts >= maxAttempts) {
    attempt.blockedUntil = new Date(Date.now() + blockDuration);
    await attempt.save();
  }

  return attempt;
};


LoginAttemptSchema.statics.resetAttempts = async function(ip, attemptType = 'login') {
  await this.deleteOne({ ip, attemptType });
};


LoginAttemptSchema.statics.isBlocked = async function(ip, attemptType = 'login') {
  const attempt = await this.findOne({ ip, attemptType });
  if (!attempt) return false;
  
  return attempt.isBlocked();
};


LoginAttemptSchema.statics.getAttemptInfo = async function(ip, attemptType = 'login') {
  const attempt = await this.findOne({ ip, attemptType });
  if (!attempt) {
    return {
      attempts: 0,
      isBlocked: false,
      timeLeft: 0,
      maxAttempts: 5
    };
  }

  return {
    attempts: attempt.attempts,
    isBlocked: attempt.isBlocked(),
    timeLeft: attempt.getBlockedTimeLeft(),
    maxAttempts: 5,
    lastAttempt: attempt.lastAttempt
  };
};

const LoginAttempt = mongoose.model('LoginAttempt', LoginAttemptSchema);
export default LoginAttempt;
