-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" VERSION '1.1';
CREATE EXTENSION IF NOT EXISTS "pgcrypto" VERSION '1.3';

-- Schema version tracking
CREATE OR REPLACE FUNCTION community_schema_version()
RETURNS text AS $$
BEGIN
    RETURN '7.0.0';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Define enum types for post and interaction types
DO $$ BEGIN
    CREATE TYPE post_type AS ENUM (
        'discussion', 'question', 'article', 'webinar', 'trading_insight'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE interaction_type AS ENUM (
        'like', 'bookmark', 'share', 'report', 'helpful', 'expert_endorse'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Forum posts table
CREATE TABLE IF NOT EXISTS forum_posts (
    post_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT GENERATED ALWAYS AS (digest(content, 'sha256')) STORED,
    post_type post_type NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    views INTEGER NOT NULL DEFAULT 0,
    unique_views INTEGER NOT NULL DEFAULT 0,
    engagement_rate DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    expert_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT content_length_check CHECK (length(content) BETWEEN 10 AND 50000)
);

-- Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES forum_posts(post_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES post_comments(comment_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_hash TEXT GENERATED ALWAYS AS (digest(content, 'sha256')) STORED,
    is_answer BOOLEAN NOT NULL DEFAULT FALSE,
    is_expert_response BOOLEAN NOT NULL DEFAULT FALSE,
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_length_check CHECK (length(content) BETWEEN 5 AND 10000)
);

-- User interactions table
CREATE TABLE IF NOT EXISTS user_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    post_id UUID REFERENCES forum_posts(post_id) ON DELETE CASCADE,
    comment_id UUID REFERENCES post_comments(comment_id) ON DELETE CASCADE,
    interaction_type interaction_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    CONSTRAINT interaction_target_check CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- User reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    reputation_score INTEGER NOT NULL DEFAULT 0,
    expert_score INTEGER NOT NULL DEFAULT 0,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    accepted_answers_count INTEGER NOT NULL DEFAULT 0,
    total_posts INTEGER NOT NULL DEFAULT 0,
    total_comments INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webinar sessions table
CREATE TABLE IF NOT EXISTS webinar_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES forum_posts(post_id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    max_participants INTEGER,
    current_participants INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    recording_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_schedule_check CHECK (scheduled_end > scheduled_start),
    CONSTRAINT valid_participants_check CHECK (current_participants >= 0 AND (max_participants IS NULL OR current_participants <= max_participants))
);

-- Create indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_type ON forum_posts(post_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_engagement ON forum_posts(engagement_rate DESC) WHERE NOT is_archived;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_tags ON forum_posts USING gin(tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_author ON post_comments(author_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_comment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_user ON user_interactions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_post ON user_interactions(post_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_comment ON user_interactions(comment_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);

-- Function to calculate user reputation
CREATE OR REPLACE FUNCTION calculate_user_reputation(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_score INTEGER;
BEGIN
    -- Calculate base reputation from post interactions
    SELECT COALESCE(SUM(
        CASE interaction_type
            WHEN 'like' THEN 1
            WHEN 'helpful' THEN 5
            WHEN 'expert_endorse' THEN 10
            WHEN 'report' THEN -5
        END
    ), 0) INTO total_score
    FROM user_interactions ui
    JOIN forum_posts fp ON ui.post_id = fp.post_id
    WHERE fp.author_id = target_user_id
    AND fp.moderation_status = 'approved';

    -- Add points for accepted answers
    total_score := total_score + (
        SELECT COUNT(*) * 15
        FROM post_comments
        WHERE author_id = target_user_id
        AND is_answer = true
    );

    -- Add expert content bonus
    total_score := total_score + (
        SELECT COUNT(*) * 20
        FROM forum_posts
        WHERE author_id = target_user_id
        AND expert_verified = true
    );

    -- Update reputation record
    UPDATE user_reputation
    SET reputation_score = total_score,
        last_calculated_at = NOW()
    WHERE user_id = target_user_id;

    RETURN total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update post metrics
CREATE OR REPLACE FUNCTION update_post_metrics(target_post_id UUID)
RETURNS VOID AS $$
DECLARE
    total_interactions INTEGER;
    unique_viewers INTEGER;
BEGIN
    -- Calculate unique views (excluding potential bots)
    SELECT COUNT(DISTINCT user_id)
    INTO unique_viewers
    FROM user_interactions
    WHERE post_id = target_post_id
    AND metadata->>'user_agent' NOT SIMILAR TO '%(bot|crawler|spider)%';

    -- Calculate total meaningful interactions
    SELECT COUNT(*)
    INTO total_interactions
    FROM user_interactions
    WHERE post_id = target_post_id
    AND interaction_type IN ('like', 'helpful', 'expert_endorse', 'share');

    -- Update post metrics
    UPDATE forum_posts
    SET unique_views = unique_viewers,
        engagement_rate = CASE 
            WHEN unique_viewers > 0 THEN 
                (total_interactions::DECIMAL / unique_viewers::DECIMAL) * 100
            ELSE 0
        END,
        updated_at = NOW()
    WHERE post_id = target_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_forum_posts_timestamp
    BEFORE UPDATE ON forum_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_post_comments_timestamp
    BEFORE UPDATE ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Trigger to update last_active_at on new comments
CREATE OR REPLACE FUNCTION update_post_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE forum_posts
    SET last_active_at = NOW()
    WHERE post_id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_activity_update
    AFTER INSERT ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_activity();