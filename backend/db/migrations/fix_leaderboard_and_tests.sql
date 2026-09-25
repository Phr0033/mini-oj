-- Run once before deploying the matching backend version.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the existing site owner's access. Promote future admins explicitly by user ID.
UPDATE users SET is_admin = TRUE WHERE id = 1 AND username = 'panhaoran';

-- Existing problem rows predate the test_cases table. Keep any already configured cases.
INSERT INTO test_cases (problem_id, input_data, output_data)
SELECT p.id, COALESCE(p.test_input, ''), COALESCE(p.expected_output, '')
FROM problems p
WHERE NOT EXISTS (SELECT 1 FROM test_cases t WHERE t.problem_id = p.id);
