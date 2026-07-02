import { useState, useEffect, useCallback } from "react";

const DEFAULT_EMAIL = "user@example.com";

export type Settings = {
  id: number;
  email: string;
  name?: string;
  company?: string;
  notifications?: boolean;
  dailyDigest?: boolean;
  kimiApiKey?: string;
  kimiModel?: string;
  kimiEnabled?: boolean;
  googlePlacesApiKey?: string;
};

async function apiGet<T>(path: string, input?: unknown): Promise<T> {
  // For tRPC queries, use GET with ?input= query param
  let url = `/api/trpc/${path}`;
  if (input) {
    const inputStr = encodeURIComponent(JSON.stringify({ json: input }));
    url += `?input=${inputStr}`;
  }
  const res = await fetch(url, {
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.json?.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.result?.data?.json ?? data[0]?.result?.data?.json ?? data;
}

async function apiPost<T>(path: string, input?: unknown): Promise<T> {
  const url = `/api/trpc/${path}`;
  const res = await fetch(url, {
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

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiGet<Settings>("settings.get", { email: DEFAULT_EMAIL });
      setSettings(data);
    } catch {
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const upsert = useCallback(async (values: Partial<Settings>) => {
    const data = await apiPost<Settings>("settings.upsert", {
      email: DEFAULT_EMAIL,
      ...values,
    });
    setSettings(data);
    return data;
  }, []);

  const testKimi = useCallback(async (apiKey: string) => {
    return apiPost<{ ok: boolean; model?: string; error?: string }>("settings.testKimi", { apiKey });
  }, []);

  return {
    settings,
    isLoading,
    kimiApiKey: settings?.kimiApiKey || "",
    kimiEnabled: settings?.kimiEnabled || false,
    googlePlacesApiKey: settings?.googlePlacesApiKey || "",
    upsert,
    testKimi,
    refetch: fetchSettings,
  };
}
