"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { setTokenSource } from "@/lib/api/http";

/**
 * Give the API layer a way to get a token.
 *
 * Clerk's `getToken` only exists inside its provider, and `lib/api/http.ts` is
 * a plain module called from places that are not React trees — the speech
 * layer, for one. Installing the function once here, rather than threading a
 * token through every call, means no caller has to know that authentication
 * exists.
 *
 * A function and not a token, because Clerk rotates short-lived JWTs in the
 * background. Anything captured at render time is stale by the time a slow
 * request goes out, and the failure would be an intermittent 401 during exactly
 * the long requests that matter.
 *
 * Renders nothing. It is a side effect with a place in the tree.
 */
export function AuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenSource(() => getToken());
  }, [getToken]);

  return null;
}
