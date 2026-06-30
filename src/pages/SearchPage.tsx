import { useState } from 'react';
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
import { trpc } from '@/providers/trpc';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { Link } from 'react-router-dom';

export default function SearchPage() {
  const { addToast } = useToast();
  const { kimiApiKey, googlePlacesApiKey } = useSettings();
  const utils = trpc.useUtils();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const scoutList = trpc.scout.list.useQuery();
  const activeJobs = scoutList.data || [];

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

  const executeScout = trpc.scout.execute.useMutation({
    onSuccess: (data) => {
      addToast(data.message, 'success');
      utils.lead.list.invalidate();
      utils.business.list.invalidate();
      utils.scout.list.invalidate();
    },
    onError: (err) => {
      addToast(err.message, 'error');
    },
  });

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

    // Animate progress
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
      await executeScout.mutateAsync({
        query,
        location: location || undefined,
        kimiApiKey: kimiApiKey || undefined,
      });
      setSearchStage(searchStages.length - 1);
    } catch {
      // Error handled by onError
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6c6c74]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder='e.g. "Dentists in Manchester"'
              className="pl-12 h-14 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] text-lg placeholder:text-[#6c6c74] focus:border-violet-500/50 rounded-xl"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-14 px-4 border-[#2a2a2e] hover:bg-white/5 ${showFilters ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'text-[#8c8c96]'}`}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="h-14 px-8 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-2 text-base shadow-lg shadow-violet-500/25"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Launch Scout
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-[#6c6c74] mr-2">Try:</span>
          {sampleQueries.map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="text-xs px-3 py-1.5 rounded-full bg-[#1c1c20] text-[#8c8c96] hover:text-violet-400 hover:bg-violet-500/10 border border-[#2a2a2e] hover:border-violet-500/30 transition-all"
            >
              {q}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#2a2a2e]">
                <div>
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Location (city/area)</label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Manchester, London..."
                    className="h-10 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2 text-xs text-[#6c6c74]">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    {kimiApiKey ? 'Kimi AI enabled for analysis' : 'Add Kimi API key for AI analysis'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel rounded-2xl p-8 text-center"
          >
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 opacity-20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 flex items-center justify-center animate-pulse-glow">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-[#f4f4f5] mb-2">AI Scout is Working</h3>
            <p className="text-[#8c8c96] mb-6">{searchStages[searchStage]}</p>
            <div className="max-w-md mx-auto">
              <div className="h-2 bg-[#1c1c20] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${((searchStage + 1) / searchStages.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-[#6c6c74] mt-2">
                Step {searchStage + 1} of {searchStages.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Jobs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Scout History</h2>
          <Badge variant="outline" className="border-[#2a2a2e] text-[#8c8c96]">
            {activeJobs.length} jobs
          </Badge>
        </div>
        <div className="space-y-3">
          {activeJobs.length === 0 && (
            <div className="text-center py-12 glass-panel rounded-xl">
              <Sparkles className="w-8 h-8 text-[#2a2a2e] mx-auto mb-3" />
              <p className="text-[#6c6c74]">No scout jobs yet. Launch your first search above.</p>
            </div>
          )}
          {activeJobs.map((job) => (
            <motion.div key={job.id} layout className="glass-panel rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    job.status === 'running' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  }`}>
                    {job.status === 'running' ? (
                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                    ) : job.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-violet-400" />
                    ) : (
                      <Pause className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#f4f4f5]">{job.query}</h3>
                    <p className="text-xs text-[#6c6c74]">{job.status}</p>
                  </div>
                </div>
              </div>

              <div className="h-2 bg-[#1c1c20] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    job.status === 'running' ? 'bg-gradient-to-r from-violet-500 to-indigo-500 progress-striped' : 'bg-violet-500'
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
