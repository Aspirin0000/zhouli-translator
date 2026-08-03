SELECT
  g.surface AS surface,
  CASE
    WHEN mode LIKE 'to_plain:%' THEN 'to_plain'
    WHEN mode LIKE 'to_zhouli:%' THEN 'to_zhouli'
    ELSE 'legacy'
  END AS direction,
  experiment_variant,
  prompt_version,
  COUNT(*) AS generation_requests,
  SUM(success) AS successful_generations,
  ROUND(100.0 * SUM(success) / NULLIF(COUNT(*), 0), 2) AS success_rate_percent,
  ROUND(AVG(latency_ms), 2) AS average_latency_ms,
  ROUND(AVG(input_tokens), 2) AS average_input_tokens,
  ROUND(AVG(output_tokens), 2) AS average_output_tokens,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN i.event_type IN ('feedback_positive', 'feedback_negative') THEN g.response_id END)
    / NULLIF(COUNT(DISTINCT CASE WHEN g.success = 1 THEN g.response_id END), 0), 2) AS feedback_coverage_percent,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN i.event_type = 'feedback_positive' THEN g.response_id END)
    / NULLIF(COUNT(DISTINCT CASE WHEN i.event_type IN ('feedback_positive', 'feedback_negative') THEN g.response_id END), 0), 2) AS positive_feedback_percent
FROM generations AS g
LEFT JOIN interactions AS i ON i.response_id = g.response_id
WHERE g.created_at >= unixepoch('now', '-7 days') * 1000
GROUP BY g.surface, direction, experiment_variant, prompt_version
ORDER BY g.surface, direction, experiment_variant;
