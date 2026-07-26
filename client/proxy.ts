import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Who may see which screen.
 *
 * Named `proxy.ts`, which is Next 16's name for what used to be `middleware.ts`
 * — same file convention, same default export, new filename.
 *
 * The list below is what is *public*; everything else requires a session. That
 * direction matters. A list of protected routes fails open — add a screen,
 * forget the list, and it is world-readable — while a list of public ones fails
 * closed, which is the failure you want.
 *
 * This is a convenience, not the security boundary. The API is what holds the
 * learner's data and it authenticates every request itself; this only decides
 * whether a browser is sent to sign in before it renders a shell it cannot
 * fill.
 */
const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Onboarding runs before an account exists. That is the product: the learner
  // answers eleven questions and only then is asked to sign up, because the
  // sign-up is worth something to them by that point.
  "/onboarding(.*)",
  // Where onboarding lands. Public by definition — it is the screen that asks
  // for the account, so requiring one to see it would be a redirect loop.
  "/save-progress",
]);

export default clerkMiddleware(async (auth, request) => {
  // With no key configured Clerk cannot make a decision, and blocking every
  // route would leave a developer staring at a redirect loop instead of a
  // legible "set your keys" failure.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return NextResponse.next();

  if (!isPublic(request)) await auth.protect();

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except Next's internals and static files, which need no
    // session and would only pay the cost of checking for one.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
