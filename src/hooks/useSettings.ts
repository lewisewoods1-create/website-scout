import { useState } from 'react';
import { trpc } from '@/providers/trpc';

const DEFAULT_EMAIL = 'user@example.com';

export function useSettings() {
  const [email] = useState(DEFAULT_EMAIL);
  
  const query = trpc.settings.get.useQuery(
    { email },
    { retry: false, refetchOnWindowFocus: false }
  );

  const upsert = trpc.settings.upsert.useMutation({
    onSuccess: () => query.refetch(),
  });

  const settings = query.data;

  const kimiApiKey = settings?.kimiApiKey || '';
  const kimiEnabled = settings?.kimiEnabled === 1;
  const googlePlacesApiKey = settings?.googlePlacesApiKey || '';

  return {
    settings,
    isLoading: query.isLoading,
    kimiApiKey,
    kimiEnabled,
    googlePlacesApiKey,
    upsert,
  };
}
