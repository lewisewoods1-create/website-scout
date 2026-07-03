import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  Search,
  DollarSign,
  Users,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from '@/hooks/useApi';
import ScoreRing from '@/components/ScoreRing';
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
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<{ stages: Record<string, number>; totalRevenue: number }>("lead.pipeline");
  const { data: leadsData, isLoading: leadsLoading } = useQuery<{ items: any[]; total: number }>("lead.list", { limit: 100, offset: 0 });
  const updateLead = useMutation<{ id: number; stage: string }, any>("lead.update");

  const leads = (leadsData?.items || []).filter((l: any) => {
    const business = l?.business as Record<string, unknown> | undefined;
    return !searchTerm || (business?.name as string || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalRevenue = pipelineData?.totalRevenue || 0;
  const pipelineStages = pipelineData?.stages ?? {};
  const stageCount = (stage: string) => pipelineStages?.[stage] ?? 0;

  const pipelineStatsDisplay = [
    { label: 'Total Leads', value: leads.length, icon: Users, color: 'text-violet-400' },
    { label: 'In Pipeline', value: stageCount('research') + stageCount('contacted') + stageCount('negotiation'), icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Won Revenue', value: `£${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-400' },
  ];

  const moveStage = async (leadId: number, newStage: string) => {
    await updateLead.mutate({ id: leadId, stage: newStage });
    window.location.reload();
  };

  const isLoading = pipelineLoading || leadsLoading;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#f4f4f5] mb-1">Sales Pipeline</h1>
            <p className="text-[#8c8c96]">Manage your leads through the sales process</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6c6c74]" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search leads..."
                className="pl-10 w-64 bg-[#131316] border-[#2a2a2e] text-[#f4f4f5]" />
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipelineStatsDisplay.map((stat) => (
          <div key={stat.label} className="glass-panel rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="data-mono text-2xl font-semibold text-[#f4f4f5]">{isLoading ? '...' : stat.value}</p>
              <p className="text-xs text-[#6c6c74]">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-violet-400 animate-spin" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {stages.map((stage) => {
            const stageLeads = leads.filter((l: any) => l?.stage === stage.id);
            return (
              <div key={stage.id} className="min-w-[300px] max-w-[340px] flex-1">
                <div className={`flex items-center justify-between mb-3 pb-3 border-b-2 ${stage.color}`}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#f4f4f5]">{stage.label}</h3>
                    <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96] text-xs">{stageLeads.length}</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {stageLeads.map((item: any, i: number) => {
                    const lead = item as Record<string, unknown>;
                    const business = lead?.business as Record<string, unknown> | undefined;
                    return (
                      <motion.div key={String(lead.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                        className="glass-panel rounded-xl p-4 cursor-pointer hover:border-violet-500/30 transition-all group"
                        onClick={() => navigate(`/leads/${String(lead.id)}`)}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-[#f4f4f5] group-hover:text-violet-400 transition-colors line-clamp-1">{business?.name as string || 'Unknown'}</h4>
                          <ScoreRing score={(lead.overallScore as number) || 0} size={28} strokeWidth={3} showLabel={false} />
                        </div>
                        <p className="text-xs text-[#6c6c74] mb-2">{business?.industry as string || ''} &bull; {business?.city as string || ''}</p>
                        {(lead.revenue as number) ? <span className="data-mono text-xs text-emerald-400">&pound;{(lead.revenue as number).toLocaleString()}</span> : null}
                        {/* Stage mover */}
                        <div className="flex gap-1 mt-2 pt-2 border-t border-[#2a2a2e]">
                          {stages.filter((s) => s.id !== stage.id).map((s) => (
                            <button key={s.id} onClick={(e) => { e.stopPropagation(); moveStage(lead.id as number, s.id); }}
                              className="text-[10px] px-2 py-0.5 rounded bg-[#1c1c20] text-[#6c6c74] hover:text-violet-400 hover:bg-violet-500/10 transition-all">
                              &rarr; {s.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                  {stageLeads.length === 0 && <div className="text-center py-8 glass-panel rounded-xl"><p className="text-xs text-[#6c6c74]">No leads</p></div>}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
