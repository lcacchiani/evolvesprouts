-- Seed data placeholder (no initial data for asset tables)

-- System tag for assets linked to expenses (see migration 0014_add_asset_tags).
INSERT INTO tags (id, name, created_by)
SELECT gen_random_uuid(), 'expense_attachment', 'system'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE lower(name) = lower('expense_attachment'));

-- Admin-assignable tag for client-facing asset documents (see admin asset client_tag field).
INSERT INTO tags (id, name, created_by)
SELECT gen_random_uuid(), 'client_document', 'system'
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE lower(name) = lower('client_document'));

-- Referral slugs on services (nullable column). Only set when exactly one row matches,
-- so seed never assigns the same slug to multiple services.
UPDATE services s
SET slug = 'my-best-auntie'
FROM (
  SELECT id
  FROM services
  WHERE slug IS NULL
    AND service_type = 'training_course'
    AND (
      lower(title) LIKE '%best auntie%'
      OR lower(title) LIKE '%my best auntie%'
    )
) pick
WHERE s.id = pick.id
  AND (
    SELECT count(*)::int
    FROM services
    WHERE slug IS NULL
      AND service_type = 'training_course'
      AND (
        lower(title) LIKE '%best auntie%'
        OR lower(title) LIKE '%my best auntie%'
      )
  ) = 1;

UPDATE services s
SET slug = 'consultations'
FROM (
  SELECT id
  FROM services
  WHERE slug IS NULL
    AND service_type = 'consultation'
) pick
WHERE s.id = pick.id
  AND (
    SELECT count(*)::int
    FROM services
    WHERE slug IS NULL
      AND service_type = 'consultation'
  ) = 1;
