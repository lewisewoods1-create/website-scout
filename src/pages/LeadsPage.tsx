import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Search, Grid3X3, List, MapPin, Star, ArrowUpRight,
  AlertCircle, SlidersHorizontal, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@/hooks/useApi';

export default function LeadsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data: leadsData, isLoading } = useQuery<{ items: any[]; total: number }>("lead.list", { limit: 100, offset: 0 });

  const filteredLeads = useMemo(() => {
    const leads = leadsData?.items || [];
    return leads.filter((lead: any) => {
      const business = (lead as Record<string, unknown>).business as Record<string, unknown> | undefined;
      const name = (business?.name as string) || '';
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || (lead as Record<string, unknown>).priority === priorityFilter;
      return matchesSearch && matchesPriority;
    });
  }, [leadsData, search, priorityFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f4f4f5]">Leads</h1>
          <p className="text-sm text-[#8c8c96]">{leadsData?.total || 0} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-violet-500/20 text-violet-400' : 'text-[#6c6c74]'}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-violet-500/20 text-violet-400' : 'text-[#6c6c74]'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#1c1c20] border border-[#2a2a2e] text-[#f4f4f5] placeholder:text-[#6c6c74] text-sm"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-10 px-3 rounded-xl bg-[#1c1c20] border border-[#2a2a2e] text-[#f4f4f5] text-sm"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-[#4a4a52] mx-auto mb-4" />
          <p className="text-[#6c6c74]">No leads found</p>
          <p className="text-sm text-[#4a4a52] mt-1">Run a search in AI Scout to find businesses</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
          {filteredLeads.map((lead: any) => {
            const business = (lead as Record<string, unknown>).business as Record<string, unknown> | undefined;
            return (
              <Link
                key={lead.id}
                to={`/leads/${lead.id}`}
                className="glass-panel rounded-xl p-4 hover:border-violet-500/30 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors truncate">
                      {(business?.name as string) || 'Unknown Business'}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-[#6c6c74] mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{(business?.city as string) || 'Unknown location'}</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#4a4a52] group-hover:text-violet-400 transition-colors" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] border-[#2a2a2e] text-[#6c6c74]">
                    {(lead as Record<string, unknown>).stage as string}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${
                    (lead as Record<string, unknown>).priority === 'urgent' ? 'border-red-500/30 text-red-400' :
                    (lead as Record<string, unknown>).priority === 'high' ? 'border-amber-500/30 text-amber-400' :
                    'border-[#2a2a2e] text-[#6c6c74]'
                  }`}>
                    {(lead as Record<string, unknown>).priority as string}
                  </Badge>
                  {(business?.googleRating as number) ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-[#8c8c96]">{business?.googleRating as number}</span>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
