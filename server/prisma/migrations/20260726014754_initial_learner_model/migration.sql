-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('GRAMMAR', 'VOCABULARY', 'FLUENCY', 'SENTENCE_STRUCTURE');

-- CreateEnum
CREATE TYPE "Cefr" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "TargetRole" AS ENUM ('CORE', 'SUPPORTING', 'INCIDENTAL');

-- CreateEnum
CREATE TYPE "StimulusType" AS ENUM ('IMAGE', 'IMAGE_PAIR', 'IMAGE_SEQUENCE', 'AUDIO', 'SCENARIO', 'STATEMENT', 'TOPIC', 'TEXT');

-- CreateEnum
CREATE TYPE "InteractionMode" AS ENUM ('MONOLOGUE', 'DIALOGUE', 'REPETITION');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEARNER', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "LearnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('UNDER_18', 'AGE_18_24', 'AGE_25_34', 'AGE_35_49', 'AGE_50_PLUS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "FeedbackLanguage" AS ENUM ('ENGLISH', 'AMHARIC', 'OROMO');

-- CreateTable
CREATE TABLE "competency" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "skill" "Skill" NOT NULL,
    "name" TEXT NOT NULL,
    "cefr_min" "Cefr" NOT NULL,
    "cefr_max" "Cefr" NOT NULL,
    "observable" BOOLEAN NOT NULL DEFAULT true,
    "success_criteria" TEXT NOT NULL,
    "elicitation_cues" TEXT[],
    "l1_risk" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_prereq" (
    "competency_id" TEXT NOT NULL,
    "requires_id" TEXT NOT NULL,

    CONSTRAINT "competency_prereq_pkey" PRIMARY KEY ("competency_id","requires_id")
);

-- CreateTable
CREATE TABLE "competency_error" (
    "id" UUID NOT NULL,
    "competency_id" TEXT NOT NULL,
    "wrong" TEXT NOT NULL,
    "right" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "competency_error_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain" (
    "id" TEXT NOT NULL,
    "cefr" "Cefr" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_requires" (
    "domain_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "role" "TargetRole" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "domain_requires_pkey" PRIMARY KEY ("domain_id","competency_id")
);

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "stimulus_type" "StimulusType" NOT NULL,
    "interaction_mode" "InteractionMode" NOT NULL,
    "cefr_min" "Cefr" NOT NULL,
    "cefr_max" "Cefr" NOT NULL,
    "duration_min_sec" INTEGER NOT NULL,
    "duration_max_sec" INTEGER NOT NULL,
    "scaffold_ladder" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_measures" (
    "template_id" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "reliability" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "template_measures_pkey" PRIMARY KEY ("template_id","skill")
);

-- CreateTable
CREATE TABLE "template_elicits" (
    "template_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "template_elicits_pkey" PRIMARY KEY ("template_id","competency_id")
);

-- CreateTable
CREATE TABLE "life_path" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "life_path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_path_domain" (
    "life_path_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "life_path_domain_pkey" PRIMARY KEY ("life_path_id","domain_id")
);

-- CreateTable
CREATE TABLE "stimulus_pool" (
    "id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "target_set_key" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "stimulus_type" "StimulusType" NOT NULL,
    "asset_url" TEXT,
    "spec" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stimulus_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner" (
    "id" UUID NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "image_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'LEARNER',
    "status" "LearnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_profile" (
    "learner_id" UUID NOT NULL,
    "cefr" "Cefr" NOT NULL DEFAULT 'A2',
    "l1" TEXT NOT NULL DEFAULT 'am',
    "age_band" "AgeBand",
    "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
    "life_path_id" TEXT,
    "study_field" TEXT,
    "daily_minutes" INTEGER NOT NULL DEFAULT 15,
    "feedback_language" "FeedbackLanguage" NOT NULL DEFAULT 'ENGLISH',
    "goal_date" DATE,
    "placed_at" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profile_pkey" PRIMARY KEY ("learner_id")
);

-- CreateTable
CREATE TABLE "learner_competency" (
    "learner_id" UUID NOT NULL,
    "competency_id" TEXT NOT NULL,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stability_days" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "last_template_id" TEXT,
    "last_theme" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_competency_pkey" PRIMARY KEY ("learner_id","competency_id")
);

-- CreateTable
CREATE TABLE "learner_error" (
    "learner_id" UUID NOT NULL,
    "competency_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_error_pkey" PRIMARY KEY ("learner_id","competency_id","tag")
);

-- CreateTable
CREATE TABLE "day_plan" (
    "id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "domain_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "day_plan_id" UUID NOT NULL,
    "template_id" TEXT NOT NULL,
    "stimulus_id" UUID,
    "order_index" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_target" (
    "session_id" UUID NOT NULL,
    "competency_id" TEXT NOT NULL,
    "role" "TargetRole" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "session_target_pkey" PRIMARY KEY ("session_id","competency_id")
);

-- CreateTable
CREATE TABLE "turn" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "audio_url" TEXT,
    "transcript_verbatim" TEXT NOT NULL,
    "transcript_clean" TEXT,
    "metrics" JSONB,
    "coach_reply" TEXT,
    "evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt" (
    "id" UUID NOT NULL,
    "turn_id" UUID NOT NULL,
    "competency_id" TEXT NOT NULL,
    "opportunities" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "scaffold_level" INTEGER NOT NULL DEFAULT 0,
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "error_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflection" (
    "session_id" UUID NOT NULL,
    "learner_text" TEXT NOT NULL,
    "matched_error_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflection_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "idempotency_key" (
    "key" TEXT NOT NULL,
    "learner_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "rate_limit_counter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "learner_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "actor_id" TEXT,
    "changes" JSONB,
    "request_id" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competency_skill_observable_idx" ON "competency"("skill", "observable");

-- CreateIndex
CREATE INDEX "competency_parent_id_idx" ON "competency"("parent_id");

-- CreateIndex
CREATE INDEX "competency_prereq_requires_id_idx" ON "competency_prereq"("requires_id");

-- CreateIndex
CREATE INDEX "competency_error_tag_idx" ON "competency_error"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "competency_error_competency_id_tag_key" ON "competency_error"("competency_id", "tag");

-- CreateIndex
CREATE INDEX "domain_cefr_idx" ON "domain"("cefr");

-- CreateIndex
CREATE INDEX "domain_requires_competency_id_idx" ON "domain_requires"("competency_id");

-- CreateIndex
CREATE INDEX "template_stimulus_type_idx" ON "template"("stimulus_type");

-- CreateIndex
CREATE INDEX "template_elicits_competency_id_idx" ON "template_elicits"("competency_id");

-- CreateIndex
CREATE INDEX "life_path_domain_domain_id_idx" ON "life_path_domain"("domain_id");

-- CreateIndex
CREATE INDEX "stimulus_pool_template_id_target_set_key_theme_idx" ON "stimulus_pool"("template_id", "target_set_key", "theme");

-- CreateIndex
CREATE INDEX "stimulus_pool_template_id_theme_idx" ON "stimulus_pool"("template_id", "theme");

-- CreateIndex
CREATE UNIQUE INDEX "learner_clerk_user_id_key" ON "learner"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_email_key" ON "learner"("email");

-- CreateIndex
CREATE INDEX "learner_status_deleted_at_idx" ON "learner"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "learner_email_idx" ON "learner"("email");

-- CreateIndex
CREATE INDEX "learner_profile_life_path_id_idx" ON "learner_profile"("life_path_id");

-- CreateIndex
CREATE INDEX "learner_competency_learner_id_due_at_idx" ON "learner_competency"("learner_id", "due_at");

-- CreateIndex
CREATE INDEX "learner_error_learner_id_last_seen_at_idx" ON "learner_error"("learner_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "day_plan_learner_id_date_idx" ON "day_plan"("learner_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "day_plan_learner_id_date_key" ON "day_plan"("learner_id", "date");

-- CreateIndex
CREATE INDEX "session_day_plan_id_idx" ON "session"("day_plan_id");

-- CreateIndex
CREATE INDEX "session_status_idx" ON "session"("status");

-- CreateIndex
CREATE UNIQUE INDEX "session_day_plan_id_order_index_key" ON "session"("day_plan_id", "order_index");

-- CreateIndex
CREATE INDEX "session_target_competency_id_idx" ON "session_target"("competency_id");

-- CreateIndex
CREATE INDEX "turn_session_id_idx" ON "turn"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "turn_session_id_index_key" ON "turn"("session_id", "index");

-- CreateIndex
CREATE INDEX "attempt_competency_id_is_final_idx" ON "attempt"("competency_id", "is_final");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_turn_id_competency_id_key" ON "attempt"("turn_id", "competency_id");

-- CreateIndex
CREATE INDEX "idempotency_key_learner_id_idx" ON "idempotency_key"("learner_id");

-- CreateIndex
CREATE INDEX "idempotency_key_expires_at_idx" ON "idempotency_key"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_counter_expires_at_idx" ON "rate_limit_counter"("expires_at");

-- CreateIndex
CREATE INDEX "audit_event_learner_id_created_at_idx" ON "audit_event"("learner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_action_created_at_idx" ON "audit_event"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "competency" ADD CONSTRAINT "competency_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_prereq" ADD CONSTRAINT "competency_prereq_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_prereq" ADD CONSTRAINT "competency_prereq_requires_id_fkey" FOREIGN KEY ("requires_id") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_error" ADD CONSTRAINT "competency_error_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_requires" ADD CONSTRAINT "domain_requires_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_requires" ADD CONSTRAINT "domain_requires_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_measures" ADD CONSTRAINT "template_measures_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_elicits" ADD CONSTRAINT "template_elicits_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_elicits" ADD CONSTRAINT "template_elicits_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_path_domain" ADD CONSTRAINT "life_path_domain_life_path_id_fkey" FOREIGN KEY ("life_path_id") REFERENCES "life_path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_path_domain" ADD CONSTRAINT "life_path_domain_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stimulus_pool" ADD CONSTRAINT "stimulus_pool_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_life_path_id_fkey" FOREIGN KEY ("life_path_id") REFERENCES "life_path"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_competency" ADD CONSTRAINT "learner_competency_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_competency" ADD CONSTRAINT "learner_competency_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_error" ADD CONSTRAINT "learner_error_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_error" ADD CONSTRAINT "learner_error_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_plan" ADD CONSTRAINT "day_plan_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_plan" ADD CONSTRAINT "day_plan_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_day_plan_id_fkey" FOREIGN KEY ("day_plan_id") REFERENCES "day_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_stimulus_id_fkey" FOREIGN KEY ("stimulus_id") REFERENCES "stimulus_pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_target" ADD CONSTRAINT "session_target_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_target" ADD CONSTRAINT "session_target_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn" ADD CONSTRAINT "turn_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "turn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflection" ADD CONSTRAINT "reflection_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
