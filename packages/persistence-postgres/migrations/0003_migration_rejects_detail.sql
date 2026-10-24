-- LCMIG-2: richer reject records and one reject per (entity, legacy_id) so reruns do not duplicate them.
-- detail holds field names only; never values, hashes or emails.
ALTER TABLE migration_rejects
  ADD COLUMN run_id text,
  ADD COLUMN detail jsonb NOT NULL DEFAULT '{}';

-- De-duplicate before adding the constraint, keeping the lowest id.
DELETE FROM migration_rejects a
USING migration_rejects b
WHERE a.entity = b.entity AND a.legacy_id = b.legacy_id AND a.id > b.id;

ALTER TABLE migration_rejects
  ADD CONSTRAINT migration_rejects_entity_legacy_uq UNIQUE (entity, legacy_id);
