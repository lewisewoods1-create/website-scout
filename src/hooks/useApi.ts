import { useState, useEffect, useCallback } from "react";

// Direct API helpers that bypass broken tRPC client
export async function apiGet<T>(path: string, input?: unknown): Promise<T> {
  let url = `/api/trpc/${path}`;
  if (input) {
    const inputStr = encodeURIComponent(JSON.stringify({ json: input }));
    url += `?input=${inputStr}`;
  }
  console.log(`[API GET] ${url}`);
  const res = await fetch(url, { credentials: "include" });
  console.log(`[API GET] ${path} status: ${res.status}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired. Redirecting to login...");
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "{}");
    console.error(`[API GET] ${path} error: ${errText}`);
    throw new Error(`API error: ${res.status} - ${errText}`);
  }
  const data = await res.json();
  console.log(`[API GET] ${path} response:`, data);
  return data.result?.data?.json ?? data[0]?.result?.data?.json ?? data;
}

export async function apiPost<T>(path: string, input?: unknown): Promise<T> {
  console.log(`[API POST] ${path}`, input);
  const res = await fetch(`/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: input ? JSON.stringify({ json: input }) : undefined,
  });
  console.log(`[API POST] ${path} status: ${res.status}`);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired. Redirecting to login...");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[API POST] ${path} error:`, err);
    throw new Error(err.error?.json?.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  console.log(`[API POST] ${path} response:`, data);
  return data.result?.data?.json ?? data[0]?.result?.data?.json ?? data;
}

// React hook for queries
export function useQuery<T>(path: string, input?: unknown, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Serialize input for stable dependency comparison
  const inputKey = typeof input === "object" ? JSON.stringify(input) : input;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiGet<T>(path, input);
      setData(result);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.error(`[useQuery] ${path} error:`, errorObj);
      setError(errorObj);
      return null;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, inputKey]);

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
