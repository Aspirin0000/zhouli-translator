DELETE FROM submitted_cases
WHERE delete_after <= unixepoch('now') * 1000;
