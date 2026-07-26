"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { Check, Loader2, LogOut, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ScreenLoading } from "@/components/shell/screen-loading";
import { StatusScreen } from "@/components/shell/status-screen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteAccount, useMe, useUpdateProfile } from "@/hooks/queries";
import { fromQuery } from "@/lib/api/async";
import { ApiError } from "@/lib/api/errors";
import type { Learner, UpdateProfileInput } from "@/lib/api/schemas";
import { dailyBudgets, lifePaths, nativeLanguages } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/**
 * Everything the learner told us, changeable.
 *
 * This screen is not cosmetic. Daily minutes decides how many exercises a Day
 * Plan contains, the Life Path decides which domain the day is drawn from, and
 * the feedback language decides what the coach's explanations are written in.
 * Every field here changes what tomorrow looks like, which is why each one says
 * so underneath rather than sitting as a bare label.
 *
 * Identity — email, password, sign-out — is Clerk's and stays Clerk's. Mixing
 * our profile fields with a hand-rolled password form would be reimplementing
 * the one part of this we deliberately do not own.
 */
export default function SettingsPage() {
  const me = fromQuery(useMe());

  if (me.status === "loading") return <ScreenLoading label="Loading your settings" />;

  if (me.status === "error") {
    return (
      <StatusScreen
        eyebrow="Settings"
        title="We couldn't load your settings."
        body={me.message}
        onRetry={{ label: "Try again", run: me.retry }}
        action={{ label: "Back to practice", href: "/practice" }}
        className="min-h-0"
      />
    );
  }

  return <SettingsForm learner={me.data} />;
}

function SettingsForm({ learner }: { learner: Learner }) {
  const { user } = useUser();
  const update = useUpdateProfile();

  // Local copy so typing does not fire a request per keystroke, seeded from the
  // server and re-seeded when the server's answer changes — which happens after
  // a save, and after the onboarding replay lands.
  //
  // Compared by value, not by object identity: react-query hands back a new
  // object on every background refetch, and re-seeding on that would erase
  // whatever the learner had half-typed at the moment the window regained
  // focus.
  const server = toForm(learner);
  const signature = JSON.stringify(server);

  const [seeded, setSeeded] = useState(signature);
  const [form, setForm] = useState(server);

  if (seeded !== signature) {
    setSeeded(signature);
    setForm(server);
  }

  const dirty = JSON.stringify(form) !== signature;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    update.mutate(changed(server, form), {
      onSuccess: () => toast.success("Saved. Tomorrow's plan will use this."),
      onError: (error) =>
        toast.error(
          error instanceof ApiError ? error.userMessage : "We couldn't save that.",
        ),
    });
  };

  return (
    <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-14 sm:px-6 md:pt-10">
      <header>
        <p className="label-eyebrow">Settings</p>
        <h1 className="mt-2 text-display-sm font-semibold tracking-tight">
          Your coaching
        </h1>
        <p className="mt-2 text-body leading-relaxed text-muted-foreground">
          These decide what your coach brings you tomorrow.
        </p>
      </header>

      <form onSubmit={save} className="mt-9 space-y-9">
        <Section
          title="How you're addressed"
          detail="The coach uses your name out loud, at the start of a session."
        >
          <Field label="Name">
            <Input
              value={form.displayName}
              onChange={(event) =>
                setForm((f) => ({ ...f, displayName: event.target.value }))
              }
              maxLength={80}
              placeholder="Hana"
              className="max-w-xs"
            />
          </Field>

          <Field
            label="Email"
            detail="Held by your sign-in, not by us. Change it there."
          >
            <p className="text-ui text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress ??
                learner.email ??
                "Not set yet"}
            </p>
          </Field>
        </Section>

        <Section
          title="Time each day"
          detail="Decides how many exercises a Day Plan holds. Shorter is better than skipped."
        >
          <Choices
            value={form.dailyMinutes}
            options={dailyBudgets.map((budget) => ({
              value: budget.minutes,
              label: budget.label,
              detail: budget.detail,
            }))}
            onChange={(dailyMinutes) => setForm((f) => ({ ...f, dailyMinutes }))}
          />
        </Section>

        <Section
          title="What you're practising for"
          detail="Every exercise is set in this world — the same grammar, in scenes you recognise."
        >
          <Choices
            value={form.lifePathId}
            options={lifePaths
              .filter((path) => path.live)
              .map((path) => ({
                value: path.id,
                label: path.name,
                detail: path.tagline,
              }))}
            onChange={(lifePathId) => setForm((f) => ({ ...f, lifePathId }))}
          />

          <Field
            label="And specifically"
            detail="One phrase. The coach builds conversations around it."
          >
            <Input
              value={form.studyField}
              onChange={(event) =>
                setForm((f) => ({ ...f, studyField: event.target.value }))
              }
              maxLength={120}
              placeholder="Computer science"
              className="max-w-sm"
            />
          </Field>
        </Section>

        <Section
          title="Your first language"
          detail="Shapes which mistakes the coach watches for, and what it can explain in."
        >
          <Choices
            value={form.l1}
            options={nativeLanguages.map((language) => ({
              value: language.id,
              label: language.name,
              detail: language.endonym,
            }))}
            onChange={(l1) => setForm((f) => ({ ...f, l1 }))}
          />
        </Section>

        <Section
          title="How corrections are explained"
          detail="The English sentence is always given either way — repeating it is how the correction sticks."
        >
          <Choices
            value={form.feedbackLanguage}
            options={[
              {
                value: "ENGLISH" as const,
                label: "English only",
                detail: "Immersion",
              },
              {
                value: "BILINGUAL" as const,
                label: "Both",
                detail: "The why in your language",
              },
            ]}
            onChange={(feedbackLanguage) =>
              setForm((f) => ({ ...f, feedbackLanguage }))
            }
          />
        </Section>

        {/* Sticks to the bottom on a phone, where the save button would
            otherwise be four scrolls below the field being edited. */}
        <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border border-panel-border bg-panel/90 px-4 py-3 backdrop-blur-xl">
          <Button type="submit" disabled={!dirty || update.isPending}>
            {update.isPending && (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden />
            )}
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>

          {!dirty && !update.isPending && (
            <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              Up to date
            </span>
          )}
        </div>
      </form>

      <Account />
    </main>
  );
}

/* ---------------------------------------------------------------------------
   Account — Clerk's half, and the one destructive action
   --------------------------------------------------------------------------- */

function Account() {
  const remove = useDeleteAccount();

  return (
    <section className="mt-14 border-t border-border/60 pt-9">
      <h2 className="text-heading font-semibold tracking-tight">Account</h2>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <SignOutButton redirectUrl="/">
          <Button variant="outline">
            <LogOut className="size-4" strokeWidth={2} aria-hidden />
            Sign out
          </Button>
        </SignOutButton>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="text-destructive hover:text-destructive">
              Delete my account
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-destructive" aria-hidden />
                Delete your account?
              </DialogTitle>
              {/* The grace period is real — the purge job runs on a thirty-day
                  cutoff — so saying so is both true and the kindest thing to
                  put in front of someone in the middle of this. */}
              <DialogDescription>
                Your transcripts, corrections and progress stop being visible
                immediately, and are permanently erased after thirty days. Write
                to us within that window and we can bring them back.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep my account</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(undefined, {
                    onSuccess: () => {
                      toast.success("Your account has been scheduled for deletion.");
                      window.location.href = "/";
                    },
                    onError: () => toast.error("We couldn't do that. Try again."),
                  })
                }
              >
                {remove.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Delete it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Pieces
   --------------------------------------------------------------------------- */

function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-heading font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-ui leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  detail,
  children,
}: {
  label: string;
  detail?: string;
  children: React.ReactNode;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {detail && <p className="text-caption text-muted-foreground">{detail}</p>}
      <div id={id}>{children}</div>
    </div>
  );
}

/**
 * A radio group that looks like the onboarding cards.
 *
 * A real `radiogroup` rather than a row of buttons, because arrow-key
 * navigation between options is what a keyboard user expects from a choice and
 * tab-through-every-option is not.
 */
function Choices<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-[8.5rem] flex-1 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected
                ? "border-primary/60 bg-primary/[0.08]"
                : "border-panel-border bg-panel hover:bg-foreground/[0.03]",
            )}
          >
            <span
              className={cn(
                "block text-ui",
                selected ? "font-medium text-foreground" : "text-foreground/80",
              )}
            >
              {option.label}
            </span>
            {option.detail && (
              <span className="mt-0.5 block text-caption text-muted-foreground">
                {option.detail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Form state
   --------------------------------------------------------------------------- */

interface FormState {
  displayName: string;
  l1: string;
  lifePathId: string;
  studyField: string;
  dailyMinutes: number;
  feedbackLanguage: Learner["profile"]["feedbackLanguage"];
}

function toForm(learner: Learner): FormState {
  return {
    displayName: learner.displayName ?? "",
    l1: learner.profile.l1,
    lifePathId: learner.profile.lifePathId ?? "general_english",
    studyField: learner.profile.studyField ?? "",
    dailyMinutes: learner.profile.dailyMinutes,
    feedbackLanguage: learner.profile.feedbackLanguage,
  };
}

/**
 * Send only what moved.
 *
 * The endpoint PATCHes, and a full-object PUT from a stale form is how one
 * learner's settings screen, left open in a second tab, overwrites the change
 * they just made in the first.
 */
function changed(before: FormState, after: FormState): UpdateProfileInput {
  const update: UpdateProfileInput = {};

  if (after.displayName !== before.displayName && after.displayName.trim()) {
    update.displayName = after.displayName.trim();
  }
  if (after.l1 !== before.l1) update.l1 = after.l1;
  if (after.lifePathId !== before.lifePathId) update.lifePathId = after.lifePathId;
  if (after.studyField !== before.studyField) update.studyField = after.studyField.trim();
  if (after.dailyMinutes !== before.dailyMinutes) update.dailyMinutes = after.dailyMinutes;
  if (after.feedbackLanguage !== before.feedbackLanguage) {
    update.feedbackLanguage = after.feedbackLanguage;
  }

  return update;
}
