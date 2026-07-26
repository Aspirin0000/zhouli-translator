SELECT
  date(created_at / 1000, 'unixepoch') AS day,
  surface,
  COUNT(*) AS generation_requests,
  SUM(success) AS successful_generations,
  ROUND(AVG(latency_ms), 2) AS average_latency_ms
FROM generations
WHERE created_at >= unixepoch('now', '-30 days') * 1000
GROUP BY day, surface
ORDER BY day, surface;
