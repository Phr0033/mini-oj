-- Optional demo data for an empty database. Safe to rerun.
INSERT INTO problems (id, title, description, test_input, expected_output, time_limit, memory_limit) VALUES
(1, 'A+B Problem', '请输入两个整数 a 和 b，计算并输出它们的和。', '3 5', '8', 1000, 256),
(2, '比较大小', '输入两个整数 a 和 b，输出其中较大的那个数。', '15 42', '42', 1000, 256),
(3, '阶乘计算', '输入一个正整数 n (n <= 12)，计算并输出 n 的阶乘 n!。', '5', '120', 1000, 256),
(4, '回文字符串', '输入一个不带空格的字符串，判断它是否为回文字符串。如果是输出 Yes，否则输出 No。', 'madam', 'Yes', 1000, 256),
(5, '闰年判断', '输入一个年份，判断是否为闰年（四年一闰，百年不闰，四百年再闰）。', '2000', 'Yes', 1000, 256),
(6, '斐波那契数列', '输入一个正整数 n (n <= 30)，输出斐波那契数列的第 n 项（n=1时为1，n=2时为1）。', '10', '55', 1000, 256)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('problems', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM problems), 1), true);

WITH proposed(problem_id, input_data, output_data) AS (
    VALUES
    (1, '1 2', '3'), (1, '10 20', '30'), (1, '0 0', '0'),
    (1, '-1 1', '0'), (1, '1000 2000', '3000'),
    (2, '15 42', '42'), (2, '8 3', '8'), (2, '-5 -2', '-2'), (2, '7 7', '7'),
    (3, '5', '120'), (3, '1', '1'), (3, '2', '2'), (3, '12', '479001600'),
    (4, 'madam', 'Yes'), (4, 'level', 'Yes'), (4, 'hello', 'No'),
    (4, 'a', 'Yes'), (4, 'ab', 'No'),
    (5, '2000', 'Yes'), (5, '1900', 'No'), (5, '2024', 'Yes'),
    (5, '2023', 'No'), (5, '2400', 'Yes'), (5, '2100', 'No'),
    (6, '10', '55'), (6, '1', '1'), (6, '2', '1'),
    (6, '3', '2'), (6, '20', '6765'), (6, '30', '832040')
)
INSERT INTO test_cases (problem_id, input_data, output_data)
SELECT p.problem_id, p.input_data, p.output_data
FROM proposed p
WHERE EXISTS (SELECT 1 FROM problems q WHERE q.id = p.problem_id)
  AND NOT EXISTS (
      SELECT 1 FROM test_cases t WHERE t.problem_id = p.problem_id
        AND t.input_data = p.input_data AND t.output_data = p.output_data
  );
