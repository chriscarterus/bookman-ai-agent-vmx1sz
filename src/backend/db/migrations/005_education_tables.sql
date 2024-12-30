-- Schema version: 5.0.0
-- Education system tables migration with enhanced learning features

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" VERSION '1.1';
CREATE EXTENSION IF NOT EXISTS "pg_trgm" VERSION '1.6'; -- For text search optimization

-- Create ENUMs for constrained fields
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE content_type AS ENUM ('video', 'text', 'quiz', 'interactive', 'assessment', 'project', 'discussion');
CREATE TYPE completion_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Create courses table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    difficulty_level difficulty_level NOT NULL,
    modules JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    prerequisites JSONB DEFAULT '[]',
    estimated_duration INTEGER NOT NULL, -- in minutes
    learning_objectives TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(user_id),
    updated_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    CONSTRAINT valid_title_length CHECK (char_length(title) BETWEEN 3 AND 255),
    CONSTRAINT valid_module_count CHECK (jsonb_array_length(modules) <= 50),
    CONSTRAINT valid_objectives CHECK (array_length(learning_objectives, 1) <= 10),
    CONSTRAINT valid_tags CHECK (array_length(tags, 1) <= 20)
);

-- Create learning paths table
CREATE TABLE learning_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    difficulty_level difficulty_level NOT NULL,
    courses UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    prerequisites JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    estimated_duration INTEGER NOT NULL, -- in minutes
    category VARCHAR(100) NOT NULL,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(user_id),
    updated_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    CONSTRAINT valid_name_length CHECK (char_length(name) BETWEEN 3 AND 255),
    CONSTRAINT valid_course_count CHECK (array_length(courses, 1) <= 20),
    CONSTRAINT valid_category_length CHECK (char_length(category) BETWEEN 3 AND 100)
);

-- Create user progress table with partitioning
CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_progress JSONB NOT NULL DEFAULT '{}',
    quiz_scores JSONB NOT NULL DEFAULT '{}',
    assessment_results JSONB NOT NULL DEFAULT '[]',
    overall_progress DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    completion_status completion_status NOT NULL DEFAULT 'not_started',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    time_spent INTEGER NOT NULL DEFAULT 0, -- in seconds
    notes TEXT,
    CONSTRAINT valid_progress CHECK (overall_progress BETWEEN 0 AND 100),
    CONSTRAINT valid_completion CHECK (
        (completion_status = 'completed' AND completed_at IS NOT NULL) OR
        (completion_status != 'completed' AND completed_at IS NULL)
    )
) PARTITION BY LIST (completion_status);

-- Create partitions for user_progress
CREATE TABLE user_progress_not_started PARTITION OF user_progress 
    FOR VALUES IN ('not_started');

CREATE TABLE user_progress_in_progress PARTITION OF user_progress 
    FOR VALUES IN ('in_progress');

CREATE TABLE user_progress_completed PARTITION OF user_progress 
    FOR VALUES IN ('completed');

-- Create achievements table
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_achievement_name CHECK (char_length(name) BETWEEN 3 AND 100),
    CONSTRAINT valid_achievement_type CHECK (type IN (
        'course_completion', 'path_completion', 'streak', 'assessment_score', 
        'participation', 'milestone'
    ))
);

-- Create indexes for performance optimization
CREATE INDEX idx_courses_difficulty ON courses(difficulty_level);
CREATE INDEX idx_courses_published ON courses(is_published, published_at) WHERE is_published = true;
CREATE INDEX idx_courses_title_trgm ON courses USING gin (title gin_trgm_ops);
CREATE INDEX idx_courses_description_trgm ON courses USING gin (description gin_trgm_ops);
CREATE INDEX idx_courses_tags ON courses USING gin (tags);
CREATE INDEX idx_courses_modules ON courses USING gin (modules);

CREATE INDEX idx_learning_paths_difficulty ON learning_paths(difficulty_level);
CREATE INDEX idx_learning_paths_category ON learning_paths(category);
CREATE INDEX idx_learning_paths_published ON learning_paths(is_published, published_at) WHERE is_published = true;
CREATE INDEX idx_learning_paths_featured ON learning_paths(is_featured) WHERE is_featured = true;

CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_user_progress_course ON user_progress(course_id);
CREATE INDEX idx_user_progress_completion ON user_progress(completion_status, completed_at);
CREATE INDEX idx_user_progress_activity ON user_progress(last_activity_at);

CREATE INDEX idx_achievements_user ON achievements(user_id);
CREATE INDEX idx_achievements_type ON achievements(type);

-- Add audit triggers
CREATE TRIGGER courses_audit
    AFTER INSERT OR UPDATE OR DELETE ON courses
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER learning_paths_audit
    AFTER INSERT OR UPDATE OR DELETE ON learning_paths
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER user_progress_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

CREATE TRIGGER achievements_audit
    AFTER INSERT OR UPDATE OR DELETE ON achievements
    FOR EACH ROW EXECUTE FUNCTION create_audit_trail();

-- Add updated_at triggers
CREATE TRIGGER update_courses_timestamp
    BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_learning_paths_timestamp
    BEFORE UPDATE ON learning_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable row-level security
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY courses_access ON courses
    FOR ALL
    TO authenticated
    USING (
        is_published = true 
        OR created_by = current_user_id() 
        OR current_user_role() IN ('admin', 'security')
    );

CREATE POLICY learning_paths_access ON learning_paths
    FOR ALL
    TO authenticated
    USING (
        is_published = true 
        OR created_by = current_user_id() 
        OR current_user_role() IN ('admin', 'security')
    );

CREATE POLICY user_progress_access ON user_progress
    FOR ALL
    TO authenticated
    USING (
        user_id = current_user_id() 
        OR current_user_role() IN ('admin', 'security')
    );

CREATE POLICY achievements_access ON achievements
    FOR ALL
    TO authenticated
    USING (
        user_id = current_user_id() 
        OR current_user_role() IN ('admin', 'security')
    );

-- Add helpful comments
COMMENT ON TABLE courses IS 'Stores educational course content with flexible module structure';
COMMENT ON TABLE learning_paths IS 'Defines structured learning sequences with prerequisites';
COMMENT ON TABLE user_progress IS 'Tracks detailed user progress through courses';
COMMENT ON TABLE achievements IS 'Records user educational achievements and milestones';

-- Version tracking
INSERT INTO schema_version (version) VALUES ('5.0.0');