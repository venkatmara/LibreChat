-- Forward-only baseline. Entity tables are added per slice (E2).
CREATE TABLE IF NOT EXISTS migration_checkpoint (
  entity text PRIMARY KEY,
  last_legacy_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration_rejects (
  id bigserial PRIMARY KEY,
  entity text NOT NULL,
  legacy_id text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
