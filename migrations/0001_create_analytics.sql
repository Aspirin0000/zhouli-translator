PRAGMA foreign_keys = ON;

CREATE TABLE generations (
    response_id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,

    surface TEXT NOT NULL CHECK (surface IN ('web', 'bilibili_toy')),
    client_version TEXT NOT NULL,
    release_channel TEXT NOT NULL CHECK (release_channel IN ('production', 'preview', 'development')),

    mode TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    experiment_variant TEXT NOT NULL CHECK (experiment_variant IN ('A', 'B')),
    model TEXT NOT NULL,

    success INTEGER NOT NULL CHECK (success IN (0, 1)),
    latency_ms INTEGER NOT NULL,

    input_chars INTEGER NOT NULL,
    output_chars INTEGER,

    input_tokens INTEGER,
    output_tokens INTEGER,

    error_class TEXT
);

CREATE INDEX idx_generations_created_at
ON generations(created_at);

CREATE INDEX idx_generations_surface
ON generations(surface, created_at);

CREATE INDEX idx_generations_experiment
ON generations(
    surface,
    experiment_variant,
    prompt_version,
    created_at
);

CREATE TABLE interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    surface TEXT NOT NULL CHECK (surface IN ('web', 'bilibili_toy')),
    event_type TEXT NOT NULL CHECK (event_type IN ('copy', 'regenerate', 'feedback_positive', 'feedback_negative', 'case_submit')),
    reason TEXT,
    FOREIGN KEY (response_id) REFERENCES generations(response_id)
);

CREATE INDEX idx_interactions_response
ON interactions(response_id);

CREATE INDEX idx_interactions_surface_type
ON interactions(surface, event_type, created_at);

CREATE UNIQUE INDEX idx_interactions_quality_feedback
ON interactions(response_id)
WHERE event_type IN ('feedback_positive', 'feedback_negative');

CREATE TABLE submitted_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    surface TEXT NOT NULL CHECK (surface IN ('web', 'bilibili_toy')),
    input_text TEXT NOT NULL,
    output_text TEXT NOT NULL,
    feedback_reasons TEXT,
    consent_version TEXT NOT NULL,
    consented_at INTEGER NOT NULL,
    public_display_allowed INTEGER NOT NULL DEFAULT 0 CHECK (public_display_allowed IN (0, 1)),
    delete_after INTEGER NOT NULL,
    FOREIGN KEY (response_id) REFERENCES generations(response_id)
);

CREATE INDEX idx_submitted_cases_delete_after
ON submitted_cases(delete_after);
