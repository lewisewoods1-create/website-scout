import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Grid3X3,
  List,
  MapPin,
  Star,
  ArrowUpRight,
  AlertCircle,
  SlidersHorizontal,
  Loader2,
  X,
  Phone,
  Mail,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/providers/trpc';
import ScoreRing from '@/components/ScoreRing';

type ViewMode = 'cards' | 'table';

export default function LeadsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    stage: '',
    priority: '',
  });

  const leadsQuery = trpc.lead.list.useQuery({
    search: searchTerm,
    stage: filters.stage,
    priority: filters.priority,
  });

  const filteredLeads = leadsQuery.data?.items || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-[#1c1c20] text-[#8c8c96] border-[#2a2a2e]';
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#f4f4f5] mb-1">Leads</h1>
            <p className="text-[#8c8c96]">
              {leadsQuery.isLoading ? 'Loading...' : `${filteredLeads.length} leads`}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('cards')}
              className={`${viewMode === 'cards' ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'border-[#2a2a2e] text-[#8c8c96]'}`}
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Cards
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('table')}
              className={`${viewMode === 'table' ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'border-[#2a2a2e] text-[#8c8c96]'}`}
            >
              <List className="w-4 h-4 mr-1" />
              Table
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel rounded-xl p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by business name..."
              className="pl-10 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-[#2a2a2e] ${showFilters ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'text-[#8c8c96]'}`}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#2a2a2e]">
            <select
              value={filters.stage}
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
              className="h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
            >
              <option value="">All Stages</option>
              <option value="research">Research</option>
              <option value="contacted">Contacted</option>
              <option value="negotiation">Negotiation</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button variant="ghost" size="sm" onClick={() => setFilters({ stage: '', priority: '' })} className="text-[#6c6c74] hover:text-[#f4f4f5]">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </motion.div>
        )}
      </motion.div>

      {leadsQuery.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      )}

      {viewMode === 'cards' && !leadsQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((item, i) => {
            const lead = item as typeof item;
            const business = (item as Record<string, unknown>).business as Record<string, unknown> | undefined;
            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="glass-panel rounded-xl p-5 hover:border-violet-500/20 transition-all cursor-pointer group"
                onClick={() => navigate(`/leads/${String(lead.id)}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <ScoreRing score={(lead as Record<string, unknown>).overallScore as number || 0} size={52} strokeWidth={4} />
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="outline" className={getPriorityColor((lead as Record<string, unknown>).priority as string || 'low')}>
                      {(lead as Record<string, unknown>).priority as string || 'low'}
                    </Badge>
                    {!(business?.website as string) && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <AlertCircle className="w-3 h-3" />
                        No Website
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors mb-1 truncate">
                  {(business?.name as string) || 'Unknown Business'}
                </h3>
                <p className="text-xs text-[#6c6c74] mb-3 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {business?.address as string || 'No address'}
                </p>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96] text-[10px]">
                    {business?.industry as string || 'Business'}
                  </Badge>
                  <span className="text-xs text-[#8c8c96] flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    {business?.googleRating as number || 0}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-center p-2 rounded-lg bg-[#0a0a0c]">
                    <div className="data-mono text-sm font-semibold text-violet-400">{((lead as Record<string, unknown>).salesProbability as number) || 0}%</div>
                    <div className="text-[10px] text-[#6c6c74]">Conversion</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-[#0a0a0c]">
                    <div className="data-mono text-sm font-semibold text-emerald-400">{((lead as Record<string, unknown>).growthPotential as number) || 0}</div>
                    <div className="text-[10px] text-[#6c6c74]">Growth</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2e]">
                  <div className="flex items-center gap-2">
                    {(business?.phone as string) && <Phone className="w-3 h-3 text-[#6c6c74]" />}
                    {(business?.email as string) && <Mail className="w-3 h-3 text-[#6c6c74]" />}
                    {(business?.website as string) && <Globe className="w-3 h-3 text-[#6c6c74]" />}
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#6c6c74] group-hover:text-violet-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {filteredLeads.length === 0 && !leadsQuery.isLoading && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-[#2a2a2e] mx-auto mb-4" />
          <p className="text-[#6c6c74] text-lg">No leads found</p>
          <p className="text-sm text-[#6c6c74] mt-1">Run a scout job to find businesses in your area</p>
        </div>
      )}
    </div>
  );
}
