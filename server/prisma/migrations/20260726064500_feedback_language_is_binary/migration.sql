-- FeedbackLanguage: ENGLISH | AMHARIC | OROMO  ->  ENGLISH | BILINGUAL
--
-- Naming the second language here made "first language Amharic, explanations in
-- Oromo" a representable state. It is not a separate choice; it is the
-- learner's `l1`, which the profile already holds.
--
-- Written by hand rather than generated, because Prisma's generated version
-- drops the removed values and fails on any row still using them. Existing rows
-- are converted: anything that was not English was a request for the learner's
-- own language, which is exactly what BILINGUAL now means.

ALTER TYPE "FeedbackLanguage" RENAME TO "FeedbackLanguage_old";

CREATE TYPE "FeedbackLanguage" AS ENUM ('ENGLISH', 'BILINGUAL');

-- The default references the old type and must go before the column is retyped.
ALTER TABLE "learner_profile" ALTER COLUMN "feedback_language" DROP DEFAULT;

ALTER TABLE "learner_profile"
  ALTER COLUMN "feedback_language" TYPE "FeedbackLanguage"
  USING (
    CASE "feedback_language"::text
      WHEN 'ENGLISH' THEN 'ENGLISH'
      ELSE 'BILINGUAL'
    END
  )::"FeedbackLanguage";

ALTER TABLE "learner_profile"
  ALTER COLUMN "feedback_language" SET DEFAULT 'ENGLISH';

DROP TYPE "FeedbackLanguage_old";
