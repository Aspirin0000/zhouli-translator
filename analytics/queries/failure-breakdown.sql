SELECT
  CASE
    WHEN mode LIKE 'to_plain:%' THEN 'to_plain'
    WHEN mode LIKE 'to_zhouli:%' THEN 'to_zhouli'
    ELSE 'legacy'
  END AS direction,
  surface,
  error_class,
  COUNT(*) AS failures,
  ROUND(AVG(input_chars), 2) AS average_input_chars,
  ROUND(AVG(latency_ms), 2) AS average_latency_ms
FROM generations
WHERE success = 0
  AND created_at >= unixepoch('now', '-7 days') * 1000
GROUP BY direction, surface, error_class
ORDER BY failures DESC;
