"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/lib/api/errors";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A learner's plan and profile do not change while they are looking at
        // them, and a session is the wrong moment to refetch anything.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            return error.retryable && failureCount < 2;
          }
          return failureCount < 2;
        },
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client per browser session, created lazily so a Fast Refresh or a
  // second render never throws away a warm cache.
  const [client] = useState(makeClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
