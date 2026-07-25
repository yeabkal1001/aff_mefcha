-- Run once against a local PostgreSQL as a superuser:
--
--   psql -U postgres -h localhost -f server/scripts/create_db.sql
--
-- It prompts for the superuser password, so nothing secret is stored here. The role
-- and database names match the DATABASE_URL in .env.example; change both together
-- if you change either. Safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coach') THEN
    CREATE ROLE coach WITH LOGIN PASSWORD 'coach';
  END IF;
END
$$;

-- CREATE DATABASE cannot run inside a transaction or a DO block, so it is guarded
-- by generating the statement and executing it only when the database is absent.
SELECT 'CREATE DATABASE english_coach OWNER coach'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'english_coach')\gexec
