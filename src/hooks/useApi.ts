import { useState, useEffect, useCallback } from "react";

// Direct API helpers that bypass broken tRPC client
export async function apiGet<T>(path: string, input?: unknown): Promise<T> {
  let url = `/api/trpc/${path}`;
  if (input) {
    const inputStr = encodeURIComponent(JSON.stringify({ json: input }));
    url += `?input=${inputStr}`;
  }
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.result?.data?.json ?? data[0]?.result?.data?.json ?? data;
}

export async function apiPost<T>(path: string, input?: unknown): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: input ? JSON.stringify({ json: input }) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.json?.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.result?.data?.json ?? data[0]?.result?.data?.json ?? data;
}

// React hook for queries
export function useQuery<T>(path: string, input?: unknown, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<T>(path, input);
      setData(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [path, input]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
  }, [enabled, refetch]);

  return { data, isLoading, error, refetch };
}

// React hook for mutations
export function useMutation<TInput, TOutput>(path: string) {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(async (input: TInput): Promise<TOutput> => {
    setIsPending(true);
    try {
      return await apiPost<TOutput>(path, input);
    } finally {
      setIsPending(false);
    }
  }, [path]);

  return { mutate, isPending };
}
