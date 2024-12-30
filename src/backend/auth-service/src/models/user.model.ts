import { Schema, model, Document } from 'mongoose'; // v7.0.0
import * as bcrypt from 'bcrypt'; // v5.1.0
import { IsEmail, MinLength, IsUUID, IsEnum, ValidateNested, IsDate } from 'class-validator'; // v0.14.0
import { randomBytes, createHash } from 'crypto';
import { UserSchema } from '../../shared/schemas/user.schema.json';

// Global constants for security configuration
const SALT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const BACKUP_CODES_COUNT = 10;
const PASSWORD_HISTORY_SIZE = 5;
const ACCOUNT_LOCK_DURATION = 3600000; // 1 hour in milliseconds

// Types for security-related data
interface SecurityQuestion {
  question: string;
  answer_hash: string;
  created_at: Date;
}

interface SecurityEvent {
  event_type: 'login_success' | 'login_failure' | 'password_change' | '2fa_enabled' | '2fa_disabled' | 'account_locked' | 'security_question_updated';
  timestamp: Date;
  ip_address: string;
  user_agent?: string;
  location?: {
    country?: string;
    city?: string;
  };
}

interface SecuritySettings {
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  backup_codes: string[];
  security_questions: SecurityQuestion[];
  last_password_change: Date;
  password_history: Array<{
    hash: string;
    changed_at: Date;
  }>;
  security_events: SecurityEvent[];
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications_enabled: boolean;
  notification_preferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
    security_alerts: boolean;
    market_updates: boolean;
    learning_reminders: boolean;
  };
  default_currency: string;
  timezone: string;
}

// User document interface extending Mongoose Document
export interface IUser extends Document {
  user_id: string;
  email: string;
  username: string;
  password_hash: string;
  role: 'guest' | 'user' | 'premium' | 'admin' | 'security';
  status: 'active' | 'inactive' | 'suspended' | 'locked' | 'pending_verification';
  auth_provider: 'email' | 'google' | 'github' | 'apple';
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  failed_login_attempts: number;
  account_locked_until?: Date;
  security_settings: SecuritySettings;
  preferences: UserPreferences;
  comparePassword(password: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  validateSecuritySettings(): Promise<boolean>;
}

// Password validation utility
export const validatePassword = (password: string): boolean => {
  const hasMinLength = password.length >= PASSWORD_MIN_LENGTH;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasNoCommonPatterns = !/^(123|abc|password|qwerty)/i.test(password);

  return hasMinLength && hasUpperCase && hasLowerCase && 
         hasNumbers && hasSpecialChar && hasNoCommonPatterns;
};

// Secure password hashing utility
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

// Backup codes generation utility
export const generateBackupCodes = async (): Promise<string[]> => {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    const randomCode = randomBytes(4).toString('hex');
    codes.push(randomCode);
  }
  return codes;
};

// User Schema definition
const userSchema = new Schema<IUser>({
  user_id: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),
      message: 'Invalid UUID format'
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: (v: string) => /^[a-zA-Z0-9_-]{3,30}$/.test(v),
      message: 'Invalid username format'
    }
  },
  password_hash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['guest', 'user', 'premium', 'admin', 'security'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'locked', 'pending_verification'],
    default: 'pending_verification'
  },
  auth_provider: {
    type: String,
    enum: ['email', 'google', 'github', 'apple'],
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  last_login: Date,
  failed_login_attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: MAX_LOGIN_ATTEMPTS
  },
  account_locked_until: Date,
  security_settings: {
    two_factor_enabled: {
      type: Boolean,
      default: false
    },
    two_factor_secret: String,
    backup_codes: [String],
    security_questions: [{
      question: String,
      answer_hash: String,
      created_at: Date
    }],
    last_password_change: {
      type: Date,
      default: Date.now
    },
    password_history: [{
      hash: String,
      changed_at: Date
    }],
    security_events: [{
      event_type: {
        type: String,
        enum: ['login_success', 'login_failure', 'password_change', '2fa_enabled', '2fa_disabled', 'account_locked', 'security_question_updated']
      },
      timestamp: Date,
      ip_address: String,
      user_agent: String,
      location: {
        country: String,
        city: String
      }
    }]
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      default: 'en-US',
      validate: {
        validator: (v: string) => /^[a-z]{2}-[A-Z]{2}$/.test(v),
        message: 'Invalid language format'
      }
    },
    notifications_enabled: {
      type: Boolean,
      default: true
    },
    notification_preferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      security_alerts: { type: Boolean, default: true },
      market_updates: { type: Boolean, default: true },
      learning_reminders: { type: Boolean, default: true }
    },
    default_currency: {
      type: String,
      default: 'USD',
      validate: {
        validator: (v: string) => /^[A-Z]{3}$/.test(v),
        message: 'Invalid currency format'
      }
    },
    timezone: {
      type: String,
      default: 'UTC',
      validate: {
        validator: (v: string) => /^[A-Za-z_]+\/[A-Za-z_]+$/.test(v),
        message: 'Invalid timezone format'
      }
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    transform: (_, ret) => {
      delete ret.password_hash;
      delete ret.__v;
      return ret;
    }
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, this.password_hash);
    await this.logSecurityEvent(isMatch ? 'login_success' : 'login_failure');
    return isMatch;
  } catch (error) {
    await this.logSecurityEvent('login_failure');
    return false;
  }
};

userSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  this.failed_login_attempts += 1;
  
  if (this.failed_login_attempts >= MAX_LOGIN_ATTEMPTS) {
    this.status = 'locked';
    this.account_locked_until = new Date(Date.now() + ACCOUNT_LOCK_DURATION);
    await this.logSecurityEvent('account_locked');
  }
  
  await this.save();
};

userSchema.methods.validateSecuritySettings = async function(): Promise<boolean> {
  const hasValidBackupCodes = this.security_settings.backup_codes.length === BACKUP_CODES_COUNT;
  const hasValidSecurityQuestions = this.security_settings.security_questions.length >= 3;
  const passwordNotExpired = (Date.now() - this.security_settings.last_password_change.getTime()) < (90 * 24 * 60 * 60 * 1000); // 90 days

  return hasValidBackupCodes && hasValidSecurityQuestions && passwordNotExpired;
};

userSchema.methods.logSecurityEvent = async function(
  event_type: SecurityEvent['event_type'],
  additional_data: Partial<SecurityEvent> = {}
): Promise<void> {
  const event: SecurityEvent = {
    event_type,
    timestamp: new Date(),
    ip_address: additional_data.ip_address || '0.0.0.0',
    ...additional_data
  };

  this.security_settings.security_events.push(event);
  await this.save();
};

// Middleware hooks
userSchema.pre('save', async function(next) {
  if (this.isModified('password_hash')) {
    // Update password history
    this.security_settings.password_history.unshift({
      hash: this.password_hash,
      changed_at: new Date()
    });
    
    // Keep only the last PASSWORD_HISTORY_SIZE entries
    this.security_settings.password_history = 
      this.security_settings.password_history.slice(0, PASSWORD_HISTORY_SIZE);
    
    this.security_settings.last_password_change = new Date();
    await this.logSecurityEvent('password_change');
  }
  next();
});

// Export the model
export const User = model<IUser>('User', userSchema);