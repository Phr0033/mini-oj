-- Run once on an existing Mini OJ PostgreSQL database before starting the async judge.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS output TEXT;
CREATE INDEX IF NOT EXISTS idx_submissions_unfinished
    ON submissions (id) WHERE result IN ('Pending', 'Running');
