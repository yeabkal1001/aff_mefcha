import type { UseQueryResult } from "@tanstack/react-query";

import { ApiError } from "./errors";

/**
 * A load, as three cases a component can switch on.
 *
 * The alternative is passing `UseQueryResult` down, which drags React Query
 * into every leaf and makes them awkward to test. This is the same information
 * with none of the coupling, and it forces the error and loading branches to
 * be written rather than left to `data?.thing`.
 */
export type Async<T> =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; data: T };

/**
 * The error type is a parameter rather than pinned to `Error`, because React
 * Query infers it from the query function and ours reject with `ApiError`.
 * Fixing it here would force every caller to widen theirs to match.
 */
export function fromQuery<T, E>(query: UseQueryResult<T, E>): Async<T> {
  if (query.data !== undefined) return { status: "ready", data: query.data };
  if (query.isError) {
    return {
      status: "error",
      message:
        query.error instanceof ApiError
          ? query.error.userMessage
          : "Something went wrong. Try again.",
      retry: () => void query.refetch(),
    };
  }
  return { status: "loading" };
}

/** The value if it is here, and undefined otherwise. For optional chrome. */
export function valueOf<T>(source: Async<T>): T | undefined {
  return source.status === "ready" ? source.data : undefined;
}

/** Narrow a load to one field of it, keeping the loading and error cases. */
export function mapAsync<T, U>(
  source: Async<T>,
  project: (value: T) => U,
): Async<U> {
  return source.status === "ready"
    ? { status: "ready", data: project(source.data) }
    : source;
}

/** A value that is already here. For local state fed into an async slot. */
export function ready<T>(data: T): Async<T> {
  return { status: "ready", data };
}
