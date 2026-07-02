import { createTRPCReact } from "@trpc/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// Direct API caller - bypasses tRPC client issues
async function apiCall<T>(path: string, input?: unknown): Promise<T> {
  const url = `/api/trpc/${path}`;

  const res = await fetch(url, {
    method: input ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: input ? JSON.stringify({ json: input }) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.json?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  // Handle both batch and single response formats
  const result = data.result?.data?.json ?? data[0]?.result?.data?.json ?? data;
  return result as T;
}

// Custom mutation hook that uses direct fetch
export function useApiMutation<TInput, TOutput>(path: string) {
  return {
    mutate: async (input: TInput): Promise<TOutput> => {
      return apiCall<TOutput>(path, input);
    },
    mutateAsync: async (input: TInput): Promise<TOutput> => {
      return apiCall<TOutput>(path, input);
    },
  };
}

// Custom query hook that uses direct fetch
export function useApiQuery<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setIsLoading(true);
    apiCall<T>(path)
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [path, enabled]);

  return { data, isLoading, error };
}

// Stub client for tRPC provider (queries won't use it)
const stubClient = trpc.createClient({
  links: [],
});

import { useState, useEffect } from "react";

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={stubClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
