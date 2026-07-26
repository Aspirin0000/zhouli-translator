SELECT
  json_each.value AS reason,
  COUNT(DISTINCT interactions.response_id) AS response_count
FROM interactions, json_each(interactions.reason)
WHERE interactions.event_type = 'feedback_negative'
  AND interactions.created_at >= unixepoch('now', '-30 days') * 1000
GROUP BY json_each.value
ORDER BY response_count DESC, reason;
