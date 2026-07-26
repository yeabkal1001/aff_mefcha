"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { api } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import type { UpdateProfileInput } from "@/lib/api/schemas";

/**
 * Every read the browser makes, as a hook.
 *
 * Keys are namespaced so a mutation can invalidate a family without knowing
 * every member of it — finishing a Day Plan invalidates `["today"]` and
 * `["profile"]`, and neither hook has to be told.
 */
export const queryKeys = {
  me: ["me"] as const,
  profile: ["me", "profile"] as const,
  today: ["today"] as const,
  history: ["history"] as const,
  corrections: ["history", "corrections"] as const,
  session: (id: string) => ["sessions", id] as const,
  speechCapabilities: ["speech", "capabilities"] as const,
};

/**
 * Do not retry what will fail again.
 *
 * React Query's default retries everything three times, which for a 403 means
 * three round trips to be told the same thing, and for a 429 means making the
 * rate limit worse. Only the transient kinds are worth a second attempt.
 */
const retry = (count: number, error: unknown) =>
  count < 2 && error instanceof ApiError && error.retryable;

type Options<T> = Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">;

export function useMe(options?: Options<Awaited<ReturnType<typeof api.me>>>) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.me(signal),
    retry,
    ...options,
  });
}

export function useCommunicationProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: ({ signal }) => api.communicationProfile(signal),
    retry,
  });
}

export function useToday() {
  return useQuery({
    queryKey: queryKeys.today,
    queryFn: ({ signal }) => api.today(signal),
    retry,
    // Building a plan is the most expensive read in the product, and the plan
    // does not change within a sitting. Re-fetching it on a window focus
    // mid-turn would be the worst possible moment.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useHistory(limit = 20) {
  return useQuery({
    queryKey: [...queryKeys.history, limit],
    queryFn: ({ signal }) => api.history({ limit }, signal),
    retry,
  });
}

export function useCorrections(limit = 30) {
  return useQuery({
    queryKey: [...queryKeys.corrections, limit],
    queryFn: ({ signal }) => api.corrections({ limit }, signal),
    retry,
  });
}

export function useSessionDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.session(id ?? ""),
    queryFn: ({ signal }) => api.session(id!, signal),
    enabled: id !== null,
    retry,
  });
}

export function useSpeechCapabilities() {
  return useQuery({
    queryKey: queryKeys.speechCapabilities,
    queryFn: ({ signal }) => api.speechCapabilities(signal),
    retry,
    // Configuration, not data. It changes when the server is redeployed.
    staleTime: Infinity,
  });
}

/**
 * Save the settings screen.
 *
 * The learner cache is set from the response rather than invalidated, because
 * the response *is* the new learner — refetching it would be a second round
 * trip to be told what we were just told. Today's plan is invalidated rather
 * than set, because changing the Life Path or the daily budget changes what
 * tomorrow should contain and only the server can work that out.
 */
export function useUpdateProfile() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.updateProfile(input),
    onSuccess: (learner) => {
      client.setQueryData(queryKeys.me, learner);
      void client.invalidateQueries({ queryKey: queryKeys.today });
      void client.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useDeleteAccount() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => client.clear(),
  });
}
