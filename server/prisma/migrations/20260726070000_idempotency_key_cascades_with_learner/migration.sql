-- `idempotency_key.learner_id` carried no foreign key, so purging a learner left
-- their stored responses behind until the retention sweep got to them. The
-- stored response is a copy of a reply we sent that learner, which makes it
-- their data, which makes a purge that skips this table an incomplete erasure.
--
-- Orphans from before the constraint existed are removed first; nothing can
-- replay a key whose learner is gone.

DELETE FROM "idempotency_key"
WHERE "learner_id" NOT IN (SELECT "id" FROM "learner");

ALTER TABLE "idempotency_key"
  ADD CONSTRAINT "idempotency_key_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "learner"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
