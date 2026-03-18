-- Add persisted subtasks support for task completion tracking
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;

