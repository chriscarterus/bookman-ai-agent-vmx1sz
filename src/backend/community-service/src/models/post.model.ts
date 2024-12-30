// External imports - v6.0.0
import { Schema, model, Document, Types } from 'mongoose';
// External imports - v0.14.0
import { IsString, IsEnum, IsBoolean, ValidateNested, IsArray, IsDate, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

// Internal imports
import { UserSchema } from '../../shared/schemas/user.schema.json';
import { config } from '../config';

// Global constants for post types and statuses
export const POST_TYPES = ['discussion', 'question', 'article', 'announcement', 'webinar', 'trading_idea'] as const;
export const POST_STATUSES = ['draft', 'published', 'archived', 'flagged', 'under_review'] as const;
export const MODERATION_REASONS = ['spam', 'inappropriate', 'misleading', 'duplicate'] as const;

// Type definitions
type PostType = typeof POST_TYPES[number];
type PostStatus = typeof POST_STATUSES[number];
type ModerationReason = typeof MODERATION_REASONS[number];

// Interfaces for nested objects
interface ExpertCredentials {
  certifications: string[];
  experience_years: number;
  specialization: string[];
  verification_date: Date;
}

interface ModerationMetadata {
  moderator_id?: string;
  moderation_date?: Date;
  reason?: ModerationReason;
  notes?: string;
  review_status: 'pending' | 'approved' | 'rejected';
}

interface EngagementMetrics {
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  save_count: number;
  expert_endorsements: string[];
}

interface Comment {
  _id: Types.ObjectId;
  author_id: string;
  author_username: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  likes: string[];
  replies: Comment[];
  is_expert_reply: boolean;
}

// Post document interface
export interface PostDocument extends Document {
  title: string;
  content: string;
  type: PostType;
  status: PostStatus;
  author_id: string;
  author_username: string;
  is_expert_content: boolean;
  expert_credentials?: ExpertCredentials;
  tags: string[];
  likes: string[];
  comments: Comment[];
  moderation_metadata: ModerationMetadata;
  engagement_metrics: EngagementMetrics;
  created_at: Date;
  updated_at: Date;
  version: number;
}

// Schema definition with validation decorators
@Schema({ timestamps: true })
export class Post implements PostDocument {
  @IsString()
  @ValidateIf((o) => o.type !== 'webinar')
  title: string;

  @IsString()
  @ValidateIf((o) => o.type !== 'announcement')
  content: string;

  @IsEnum(POST_TYPES)
  type: PostType;

  @IsEnum(POST_STATUSES)
  status: PostStatus;

  @IsString()
  author_id: string;

  @IsString()
  author_username: string;

  @IsBoolean()
  is_expert_content: boolean;

  @ValidateNested()
  @Type(() => ExpertCredentials)
  @ValidateIf((o) => o.is_expert_content)
  expert_credentials?: ExpertCredentials;

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @IsString({ each: true })
  likes: string[];

  @ValidateNested({ each: true })
  @Type(() => Comment)
  comments: Comment[];

  @ValidateNested()
  @Type(() => ModerationMetadata)
  moderation_metadata: ModerationMetadata;

  @ValidateNested()
  @Type(() => EngagementMetrics)
  engagement_metrics: EngagementMetrics;

  @IsDate()
  created_at: Date;

  @IsDate()
  updated_at: Date;

  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  version: number;
}

// Create Mongoose schema
const PostSchema = new Schema<PostDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: config.content.maxTitleLength,
      index: 'text'
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: config.content.maxContentLength
    },
    type: {
      type: String,
      enum: POST_TYPES,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: POST_STATUSES,
      default: 'draft',
      index: true
    },
    author_id: {
      type: String,
      required: true,
      index: true
    },
    author_username: {
      type: String,
      required: true
    },
    is_expert_content: {
      type: Boolean,
      default: false,
      index: true
    },
    expert_credentials: {
      certifications: [String],
      experience_years: Number,
      specialization: [String],
      verification_date: Date
    },
    tags: {
      type: [String],
      index: true
    },
    likes: [String],
    comments: [{
      author_id: String,
      author_username: String,
      content: String,
      created_at: Date,
      updated_at: Date,
      likes: [String],
      replies: [{
        type: Schema.Types.Mixed
      }],
      is_expert_reply: Boolean
    }],
    moderation_metadata: {
      moderator_id: String,
      moderation_date: Date,
      reason: {
        type: String,
        enum: MODERATION_REASONS
      },
      notes: String,
      review_status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      }
    },
    engagement_metrics: {
      view_count: { type: Number, default: 0 },
      like_count: { type: Number, default: 0 },
      comment_count: { type: Number, default: 0 },
      share_count: { type: Number, default: 0 },
      save_count: { type: Number, default: 0 },
      expert_endorsements: [String]
    },
    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
PostSchema.index({ title: 'text', tags: 1 });
PostSchema.index({ created_at: -1 });
PostSchema.index({ author_id: 1, created_at: -1 });
PostSchema.index({ is_expert_content: 1, created_at: -1 });

// Static methods
PostSchema.statics.findExpertContent = function(options = {}) {
  return this.find({
    is_expert_content: true,
    status: 'published',
    ...options
  }).sort({ created_at: -1 });
};

// Export model
export const PostModel = model<PostDocument>('Post', PostSchema);