import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  Key,
  CheckCircle,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { Link } from 'react-router';

async function apiPost<T>(path: string, input?: unknown): Promise<T> {
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

const searchStages = [
  'Parsing natural language query...',
  'Connecting to Google Places API...',
  'Scanning business directories...',
  'Finding businesses in your area...',
  'Fetching business details...',
  'Checking for websites...',
  'Running website analysis...',
  'AI scoring businesses...',
  'Calculating opportunity scores...',
  'Generating outreach content...',
  'Saving results to database...',
  'Done!',
];

export default function SearchPage() {
  const { addToast } = useToast();
  const { googlePlacesApiKey, kimiApiKey } = useSettings();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) {
      addToast('Please enter a search query', 'warning');
      return;
    }

    if (!googlePlacesApiKey && !kimiApiKey) {
      addToast('Add API keys in Settings first', 'warning');
      return;
    }

    setIsSearching(true);
    setSearchStage(0);

    const interval = setInterval(() => {
      setSearchStage((prev) => {
        if (prev >= searchStages.length - 2) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    try {
      const data = await apiPost<{ message: string; results: any[] }>("scout.execute", {
        query,
        location: location || undefined,
        kimiApiKey: kimiApiKey || undefined,
      });
      setSearchStage(searchStages.length - 1);
      addToast(data.message, 'success');
      if (data.results) setResults(data.results);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Search failed', 'error');
    } finally {
      setTimeout(() => setIsSearching(false), 1000);
      clearInterval(interval);
    }
  };

  const sampleQueries = [
    'Dentists',
    'Hairdressers',
    'Electricians',
    'Plumbers',
    'Restaurants',
    'Cafes',
  ];

  const hasApiKeys = !!(googlePlacesApiKey || kimiApiKey);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">AI Scout</h1>
        <p className="text-[#8c8c96]">
          Find real businesses in your area using Google Places + Kimi AI
        </p>
      </motion.div>

      {!hasApiKeys && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-xl p-4 border-amber-500/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-400">
              API keys required to find real businesses.
            </p>
            <p className="text-xs text-[#6c6c74]">
              Add your Google Places API key and Kimi API key in{' '}
              <Link to="/settings" className="text-violet-400 hover:underline">Settings</Link>
            </p>
          </div>
          <Key className="w-5 h-5 text-amber-400" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-2xl p-6"
      >
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6c6c74]" />
            <Input
              placeholder="What businesses do you want to find? (e.g. dentists in London)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-11 h-12 bg-[#1c1c20] border-[#2a2a2e] text-[#f4f4f5] placeholder:text-[#6c6c74]"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="h-12 px-6 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSearching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="h-12 px-3 border-[#2a2a2e] text-[#6c6c74]"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[#6c6c74] mb-1 block">Location</label>
                  <Input
                    placeholder="City or postcode"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-[#1c1c20] border-[#2a2a2e] text-[#f4f4f5]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap gap-2 mt-4">
          {sampleQueries.map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-[#2a2a2e] text-[#8c8c96] hover:text-[#f4f4f5] hover:border-violet-500/30 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </motion.div>

      {isSearching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-xl p-6 text-center"
        >
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-[#f4f4f5] font-medium">{searchStages[searchStage]}</p>
          <div className="mt-3 h-1 bg-[#2a2a2e] rounded-full overflow-hidden max-w-xs mx-auto">
            <motion.div
              className="h-full bg-violet-500"
              initial={{ width: '0%' }}
              animate={{ width: `${((searchStage + 1) / searchStages.length) * 100}%` }}
            />
          </div>
        </motion.div>
      )}

      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-xl p-4"
        >
          <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">
            Found {results.length} businesses
          </h3>
          <div className="space-y-3">
            {results.map((biz: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#1c1c20]">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Search className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#f4f4f5]">{biz.name}</p>
                  <p className="text-xs text-[#6c6c74] truncate">{biz.address || biz.city || 'No address'}</p>
                </div>
                {biz.hasWebsite ? (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Has website</Badge>
                ) : (
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">No website</Badge>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
