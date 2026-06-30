import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  MoreHorizontal,
  DollarSign,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ScoreRing from '@/components/ScoreRing';
import { mockLeads } from '@/data/mockData';
import type { PipelineStage } from '@/types';

const stages: { id: PipelineStage; label: string; color: string }[] = [
  { id: 'research', label: 'Research', color: 'border-violet-500' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-500' },
  { id: 'negotiation', label: 'Negotiation', color: 'border-amber-500' },
  { id: 'won', label: 'Won', color: 'border-emerald-500' },
  { id: 'lost', label: 'Lost', color: 'border-red-500' },
];

export default function PipelinePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const leadsByStage = stages.map((stage) => ({
    ...stage,
    leads: mockLeads
      .filter((l) => l.stage === stage.id)
      .filter((l) => !searchTerm || l.business.name.toLowerCase().includes(searchTerm.toLowerCase())),
  }));

  const totalRevenue = mockLeads
    .filter((l) => l.revenue)
    .reduce((sum, l) => sum + (l.revenue || 0), 0);

  const pipelineStats = [
    { label: 'Total Leads', value: mockLeads.length, icon: Users, color: 'text-violet-400' },
    { label: 'In Pipeline', value: mockLeads.filter((l) => l.stage !== 'won' && l.stage !== 'lost').length, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Won Revenue', value: `£${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#f4f4f5] mb-1">Sales Pipeline</h1>
            <p className="text-[#8c8c96]">Manage your leads through the sales process</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search leads..."
                className="pl-10 w-64 bg-[#131316] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
              />
            </div>
            <Button className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2">
              <Plus className="w-4 h-4" />
              Add Lead
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {pipelineStats.map((stat) => (
          <div key={stat.label} className="glass-panel rounded-xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="data-mono text-2xl font-semibold text-[#f4f4f5]">{stat.value}</p>
              <p className="text-xs text-[#6c6c74]">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Kanban Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin"
      >
        {leadsByStage.map((stage) => (
          <div key={stage.id} className="min-w-[300px] max-w-[340px] flex-1">
            <div className={`flex items-center justify-between mb-3 pb-3 border-b-2 ${stage.color}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#f4f4f5]">{stage.label}</h3>
                <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96] text-xs">
                  {stage.leads.length}
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#6c6c74]">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {stage.leads.map((lead, i) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="glass-panel rounded-xl p-4 cursor-pointer hover:border-violet-500/30 transition-all group"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-[#f4f4f5] group-hover:text-violet-400 transition-colors line-clamp-1">
                      {lead.business.name}
                    </h4>
                    <ScoreRing score={lead.score.overall} size={28} strokeWidth={3} showLabel={false} />
                  </div>

                  <p className="text-xs text-[#6c6c74] mb-3">
                    {lead.business.industry} • {lead.business.location.city}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {lead.revenue && (
                        <span className="data-mono text-xs text-emerald-400">
                          £{lead.revenue.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div
                      className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-[10px] text-white font-medium"
                    >
                      {lead.business.owner.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                  </div>

                  {lead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#2a2a2e]">
                      {lead.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1c1c20] text-[#6c6c74]">
                          {tag}
                        </span>
                      ))}
                      {lead.tags.length > 2 && (
                        <span className="text-[10px] text-[#6c6c74]">+{lead.tags.length - 2}</span>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}

              {stage.leads.length === 0 && (
                <div className="text-center py-8 glass-panel rounded-xl">
                  <p className="text-xs text-[#6c6c74]">No leads in this stage</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
