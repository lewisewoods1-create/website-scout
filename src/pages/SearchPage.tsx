import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { mockScoutJobs, industries, locations } from '@/data/mockData';
import { useToast } from '@/hooks/useToast';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [activeJobs, setActiveJobs] = useState(mockScoutJobs);
  const { addToast } = useToast();

  const [filters, setFilters] = useState({
    industry: 'All',
    location: 'All',
    hasWebsite: '',
    minRating: '',
    minScore: '',
  });

  const searchStages = [
    'Parsing natural language query...',
    'Identifying business directories...',
    'Scanning Google Maps...',
    'Searching Bing Places...',
    'Checking Yell.com...',
    'Scanning Facebook Business...',
    'Analyzing Trustpilot reviews...',
    'Cross-referencing LinkedIn...',
    'Deduplicating results...',
    'Running website analysis...',
    'Calculating AI scores...',
    'Generating proposals...',
  ];

  const handleSearch = () => {
    if (!query.trim()) {
      addToast('Please enter a search query', 'warning');
      return;
    }

    setIsSearching(true);
    setSearchStage(0);

    const interval = setInterval(() => {
      setSearchStage((prev) => {
        if (prev >= searchStages.length - 1) {
          clearInterval(interval);
          setIsSearching(false);
          addToast(`Found 24 new leads for "${query}"`, 'success');
          return prev;
        }
        return prev + 1;
      });
    }, 800);
  };

  const toggleJobStatus = (jobId: string) => {
    setActiveJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, status: j.status === 'running' ? 'paused' : 'running' as const } : j
      )
    );
  };

  const sampleQueries = [
    'Dentists in Manchester',
    'Hairdressers in Blackburn',
    'Electricians in Leeds',
    'Plumbers with no website',
    'Restaurants in York with poor SEO',
    'Cafes with outdated websites',
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">AI Scout</h1>
        <p className="text-[#8c8c96]">
          Tell the AI what businesses to find. Use natural language like{' '}
          <span className="text-violet-400">"Find dentists in Manchester with no website"</span>
        </p>
      </motion.div>

      {/* Search Input */}
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
              placeholder='Try "Find plumbers in Sheffield with poor websites"'
              className="pl-12 h-14 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] text-lg placeholder:text-[#6c6c74] focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl"
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
            disabled={isSearching}
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

        {/* Sample Queries */}
        {!isSearching && (
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
        )}

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#2a2a2e]">
                <div>
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Industry</label>
                  <select
                    value={filters.industry}
                    onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
                  >
                    {industries.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Location</label>
                  <select
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Min Rating</label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={filters.minRating}
                    onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
                    placeholder="0 - 5"
                    className="h-10 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Min Score</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.minScore}
                    onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
                    placeholder="0 - 100"
                    className="h-10 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* AI Processing Animation */}
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Active Scout Jobs</h2>
          <Badge variant="outline" className="border-[#2a2a2e] text-[#8c8c96]">
            {activeJobs.length} jobs
          </Badge>
        </div>
        <div className="space-y-3">
          {activeJobs.map((job) => (
            <motion.div
              key={job.id}
              layout
              className="glass-panel rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      job.status === 'running' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    }`}
                  >
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
                    <p className="text-xs text-[#6c6c74]">
                      {job.status === 'running' ? `Scanning: ${job.currentSource}` : job.status === 'completed' ? 'Completed' : 'Paused'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {job.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleJobStatus(job.id)}
                      className="text-[#8c8c96] hover:text-[#f4f4f5]"
                    >
                      {job.status === 'running' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#8c8c96] hover:text-[#f4f4f5]"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-[#0a0a0c]">
                  <div className="data-mono text-xl font-semibold text-[#f4f4f5]">{job.leadsFound}</div>
                  <div className="text-xs text-[#6c6c74]">Leads Found</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#0a0a0c]">
                  <div className="data-mono text-xl font-semibold text-[#f4f4f5]">
                    {job.sourcesScanned}/{job.totalSources}
                  </div>
                  <div className="text-xs text-[#6c6c74]">Sources</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#0a0a0c]">
                  <div className="data-mono text-xl font-semibold text-violet-400">{job.progress}%</div>
                  <div className="text-xs text-[#6c6c74]">Progress</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-[#0a0a0c]">
                  <div className="data-mono text-xl font-semibold text-[#f4f4f5] flex items-center justify-center gap-1">
                    <Clock className="w-4 h-4 text-[#6c6c74]" />
                    {job.completedAt
                      ? 'Done'
                      : `${Math.floor((Date.now() - new Date(job.startedAt).getTime()) / 60000)}m`}
                  </div>
                  <div className="text-xs text-[#6c6c74]">Duration</div>
                </div>
              </div>

              <div className="h-2 bg-[#1c1c20] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    job.status === 'running'
                      ? 'bg-gradient-to-r from-violet-500 to-indigo-500 progress-striped'
                      : 'bg-violet-500'
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
