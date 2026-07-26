WITH surfaces(surface) AS (
  VALUES ('web'), ('bilibili_toy')
),
generation_stats AS (
  SELECT
    surface,
    COUNT(*) AS generation_requests,
    SUM(success) AS successful_generations,
    AVG(latency_ms) AS average_latency_ms
  FROM generations
  WHERE created_at >= unixepoch('now', '-7 days') * 1000
  GROUP BY surface
),
successful AS (
  SELECT surface, COUNT(DISTINCT response_id) AS successful_response_ids
  FROM generations
  WHERE success = 1 AND created_at >= unixepoch('now', '-7 days') * 1000
  GROUP BY surface
),
feedback AS (
  SELECT
    surface,
    COUNT(DISTINCT CASE WHEN event_type IN ('feedback_positive', 'feedback_negative') THEN response_id END) AS feedback_response_ids,
    COUNT(DISTINCT CASE WHEN event_type = 'copy' THEN response_id END) AS copied_response_ids,
    COUNT(DISTINCT CASE WHEN event_type = 'regenerate' THEN response_id END) AS regenerated_response_ids
  FROM interactions
  WHERE created_at >= unixepoch('now', '-7 days') * 1000
  GROUP BY surface
),
cases AS (
  SELECT surface, COUNT(*) AS submitted_case_count
  FROM submitted_cases
  WHERE created_at >= unixepoch('now', '-7 days') * 1000
  GROUP BY surface
),
quality AS (
  SELECT
    surface,
    COUNT(DISTINCT CASE WHEN event_type = 'feedback_positive' THEN response_id END) AS positive_count,
    COUNT(DISTINCT CASE WHEN event_type = 'feedback_negative' THEN response_id END) AS negative_count
  FROM interactions
  WHERE created_at >= unixepoch('now', '-7 days') * 1000
  GROUP BY surface
)
SELECT
  surfaces.surface,
  COALESCE(generation_stats.generation_requests, 0) AS generation_requests,
  ROUND(100.0 * COALESCE(generation_stats.successful_generations, 0) / NULLIF(generation_stats.generation_requests, 0), 2) AS success_rate_percent,
  ROUND(COALESCE(generation_stats.average_latency_ms, 0), 2) AS average_latency_ms,
  ROUND(100.0 * COALESCE(feedback.feedback_response_ids, 0) / NULLIF(successful.successful_response_ids, 0), 2) AS feedback_coverage_percent,
  ROUND(100.0 * COALESCE(quality.positive_count, 0) / NULLIF(quality.positive_count + quality.negative_count, 0), 2) AS positive_feedback_percent,
  COALESCE(feedback.copied_response_ids, 0) AS copied_response_ids,
  COALESCE(feedback.regenerated_response_ids, 0) AS regenerated_response_ids,
  COALESCE(cases.submitted_case_count, 0) AS submitted_case_count
FROM surfaces
LEFT JOIN generation_stats ON generation_stats.surface = surfaces.surface
LEFT JOIN successful ON successful.surface = surfaces.surface
LEFT JOIN feedback ON feedback.surface = surfaces.surface
LEFT JOIN cases ON cases.surface = surfaces.surface
LEFT JOIN quality ON quality.surface = surfaces.surface
ORDER BY surfaces.surface;
