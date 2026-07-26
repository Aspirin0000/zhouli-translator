SELECT
  COUNT(*) AS generation_requests,
  SUM(success) AS successful_generations,
  ROUND(100.0 * SUM(success) / NULLIF(COUNT(*), 0), 2) AS success_rate_percent,
  ROUND(AVG(latency_ms), 2) AS average_latency_ms,
  COUNT(DISTINCT CASE WHEN success = 1 THEN response_id END) AS successful_response_ids,
  COUNT(DISTINCT CASE WHEN success = 1 AND response_id IN (
    SELECT response_id FROM interactions
    WHERE event_type IN ('feedback_positive', 'feedback_negative')
      AND created_at >= unixepoch('now', '-7 days') * 1000
  ) THEN response_id END) AS feedback_response_ids,
  (SELECT COUNT(*) FROM submitted_cases WHERE created_at >= unixepoch('now', '-7 days') * 1000) AS submitted_case_count
FROM generations
WHERE created_at >= unixepoch('now', '-7 days') * 1000;
