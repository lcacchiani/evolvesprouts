-- Seed data placeholder (no initial data for asset tables)

-- System tag for assets linked to expenses (see migration 0014_add_asset_tags).
INSERT INTO tags (id, name, created_by)
SELECT gen_random_uuid(), 'expense_attachment', 'system'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE lower(name) = lower('expense_attachment'));

-- Admin-assignable tag for client-facing asset documents (see admin asset client_tag field).
INSERT INTO tags (id, name, created_by)
SELECT gen_random_uuid(), 'client_document', 'system'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE lower(name) = lower('client_document'));
