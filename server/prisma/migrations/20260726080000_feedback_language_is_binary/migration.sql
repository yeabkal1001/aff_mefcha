-- FeedbackLanguage becomes ENGLISH | BILINGUAL.
--
-- Naming languages made "first language Amharic, explanations in Oromo" a
-- representable state. Which second language is not an independent choice; it
-- is `learner_profile.l1`, which the learner already told us.
--
-- Existing rows: ENGLISH stays, and AMHARIC or OROMO both meant "explain in my
-- own language", which is now BILINGUAL. Nothing is lost, because l1 already
-- records which language that was.

CREATE TYPE "FeedbackLanguage_new" AS ENUM ('ENGLISH', 'BILINGUAL');

-- The default has to go before the column can change type, and come back after.
ALTER TABLE "learner_profile" ALTER COLUMN "feedback_language" DROP DEFAULT;

ALTER TABLE "learner_profile"
  ALTER COLUMN "feedback_language" TYPE "FeedbackLanguage_new"
  USING (
    CASE "feedback_language"::text
      WHEN 'ENGLISH' THEN 'ENGLISH'
      ELSE 'BILINGUAL'
    END
  )::"FeedbackLanguage_new";

ALTER TYPE "FeedbackLanguage" RENAME TO "FeedbackLanguage_old";
ALTER TYPE "FeedbackLanguage_new" RENAME TO "FeedbackLanguage";
DROP TYPE "FeedbackLanguage_old";

ALTER TABLE "learner_profile" ALTER COLUMN "feedback_language" SET DEFAULT 'ENGLISH';
