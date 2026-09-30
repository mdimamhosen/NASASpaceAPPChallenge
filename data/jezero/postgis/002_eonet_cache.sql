-- Durable EONET snapshot store (no PostGIS required).
-- Applied automatically by the API when DATABASE_URL is reachable.

CREATE TABLE IF NOT EXISTS eonet_cache (
  cache_key TEXT PRIMARY KEY,
  body JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT
);

CREATE INDEX IF NOT EXISTS eonet_cache_fetched_at_idx ON eonet_cache (fetched_at DESC);
