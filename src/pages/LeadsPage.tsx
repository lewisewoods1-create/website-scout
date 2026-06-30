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
  X,
  SlidersHorizontal,
  Globe,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ScoreRing from '@/components/ScoreRing';
import { mockLeads, industries, locations } from '@/data/mockData';

type ViewMode = 'cards' | 'table';

export default function LeadsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    industry: 'All',
    location: 'All',
    status: 'All',
    priority: 'All',
    hasWebsite: '',
  });

  const filteredLeads = mockLeads.filter((lead) => {
    if (searchTerm && !lead.business.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filters.industry !== 'All' && lead.business.industry !== filters.industry) return false;
    if (filters.location !== 'All' && !lead.business.address.includes(filters.location)) return false;
    if (filters.status !== 'All' && lead.status !== filters.status) return false;
    if (filters.priority !== 'All' && lead.score.priority !== filters.priority) return false;
    if (filters.hasWebsite === 'yes' && !lead.business.hasWebsite) return false;
    if (filters.hasWebsite === 'no' && lead.business.hasWebsite) return false;
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-[#1c1c20] text-[#8c8c96] border-[#2a2a2e]';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-violet-500/10 text-violet-400';
      case 'contacted': return 'bg-blue-500/10 text-blue-400';
      case 'qualified': return 'bg-cyan-500/10 text-cyan-400';
      case 'proposal_sent': return 'bg-amber-500/10 text-amber-400';
      case 'negotiation': return 'bg-orange-500/10 text-orange-400';
      case 'won': return 'bg-emerald-500/10 text-emerald-400';
      case 'lost': return 'bg-red-500/10 text-red-400';
      default: return 'bg-[#1c1c20] text-[#8c8c96]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#f4f4f5] mb-1">Leads</h1>
            <p className="text-[#8c8c96]">
              {filteredLeads.length} leads found
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

      {/* Search & Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-xl p-4"
      >
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by business name, industry, location..."
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
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#2a2a2e]"
          >
            <select
              value={filters.industry}
              onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
              className="h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
            >
              {industries.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            <select
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
            >
              {locations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filters.hasWebsite}
              onChange={(e) => setFilters({ ...filters, hasWebsite: e.target.value })}
              className="h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
            >
              <option value="">Any Website</option>
              <option value="yes">Has Website</option>
              <option value="no">No Website</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ industry: 'All', location: 'All', status: 'All', priority: 'All', hasWebsite: '' })}
              className="text-[#6c6c74] hover:text-[#f4f4f5]"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead, i) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="glass-panel rounded-xl p-5 hover:border-violet-500/20 transition-all cursor-pointer group"
              onClick={() => navigate(`/leads/${lead.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <ScoreRing score={lead.score.overall} size={52} strokeWidth={4} />
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant="outline" className={getPriorityColor(lead.score.priority)}>
                    {lead.score.priority}
                  </Badge>
                  {!lead.business.hasWebsite && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertCircle className="w-3 h-3" />
                      No Website
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-base font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors mb-1 truncate">
                {lead.business.name}
              </h3>
              <p className="text-xs text-[#6c6c74] mb-3 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {lead.business.address}
              </p>

              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96] text-[10px]">
                  {lead.business.industry}
                </Badge>
                <span className="text-xs text-[#8c8c96] flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  {lead.business.googleRating}
                </span>
                <span className="text-xs text-[#6c6c74]">({lead.business.reviewCount})</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-[#0a0a0c]">
                  <div className="data-mono text-sm font-semibold text-violet-400">{lead.score.salesProbability}%</div>
                  <div className="text-[10px] text-[#6c6c74]">Conversion</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-[#0a0a0c]">
                  <div className="data-mono text-sm font-semibold text-emerald-400">{lead.score.growthPotential}</div>
                  <div className="text-[10px] text-[#6c6c74]">Growth</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2e]">
                <div className="flex items-center gap-2">
                  {lead.business.phone && <Phone className="w-3 h-3 text-[#6c6c74]" />}
                  {lead.business.email && <Mail className="w-3 h-3 text-[#6c6c74]" />}
                  {lead.business.website && <Globe className="w-3 h-3 text-[#6c6c74]" />}
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#6c6c74] group-hover:text-violet-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2e]">
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Business</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Score</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Industry</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Location</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Rating</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Priority</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Status</th>
                  <th className="text-left p-4 text-xs font-medium text-[#6c6c74] uppercase tracking-wider">Website</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[#2a2a2e]/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td className="p-4">
                      <div className="font-medium text-[#f4f4f5] text-sm">{lead.business.name}</div>
                      <div className="text-xs text-[#6c6c74]">{lead.business.owner}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <ScoreRing score={lead.score.overall} size={36} strokeWidth={3} showLabel={false} />
                        <span className="data-mono text-sm font-semibold text-[#f4f4f5]">{lead.score.overall}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96] text-[10px]">
                        {lead.business.industry}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-[#8c8c96]">{lead.business.location.city}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-sm text-[#8c8c96]">
                        <Star className="w-3 h-3 text-amber-400" />
                        {lead.business.googleRating}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={`text-[10px] ${getPriorityColor(lead.score.priority)}`}>
                        {lead.score.priority}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={`text-[10px] ${getStatusColor(lead.status)}`}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {lead.business.hasWebsite ? (
                        <Globe className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    <td className="p-4">
                      <ArrowUpRight className="w-4 h-4 text-[#6c6c74]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {filteredLeads.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-[#2a2a2e] mx-auto mb-4" />
          <p className="text-[#6c6c74] text-lg">No leads match your filters</p>
          <Button
            variant="outline"
            onClick={() => { setSearchTerm(''); setFilters({ industry: 'All', location: 'All', status: 'All', priority: 'All', hasWebsite: '' }); }}
            className="mt-4 border-[#2a2a2e] text-[#8c8c96]"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
