-- Add edge cases for defined exercises and remove unused placeholder problems.
-- Run inside a transaction. This script can be rerun without duplicating cases.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM submissions WHERE problem_id IN (9, 10, 11))
       OR EXISTS (SELECT 1 FROM contest_problems WHERE problem_id IN (9, 10, 11))
       OR EXISTS (SELECT 1 FROM posts WHERE problem_id IN (9, 10, 11)) THEN
        RAISE EXCEPTION 'Placeholder problems have related content; review before deletion';
    END IF;
END $$;

DELETE FROM test_cases WHERE problem_id IN (9, 10, 11);
DELETE FROM problems WHERE id IN (9, 10, 11);

WITH proposed(problem_id, input_data, output_data) AS (
    VALUES
      (2, '8 3', '8'), (2, '-5 -2', '-2'), (2, '7 7', '7'),
      (3, '1', '1'), (3, '2', '2'), (3, '12', '479001600'),
      (4, 'level', 'Yes'), (4, 'hello', 'No'), (4, 'a', 'Yes'), (4, 'ab', 'No'),
      (5, '1900', 'No'), (5, '2024', 'Yes'), (5, '2023', 'No'),
      (5, '2400', 'Yes'), (5, '2100', 'No'),
      (6, '1', '1'), (6, '2', '1'), (6, '3', '2'),
      (6, '20', '6765'), (6, '30', '832040')
)
INSERT INTO test_cases (problem_id, input_data, output_data)
SELECT p.problem_id, p.input_data, p.output_data
FROM proposed p
WHERE EXISTS (SELECT 1 FROM problems q WHERE q.id = p.problem_id)
  AND NOT EXISTS (
    SELECT 1 FROM test_cases t
    WHERE t.problem_id = p.problem_id
      AND t.input_data = p.input_data
      AND t.output_data = p.output_data
  );
