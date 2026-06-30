import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Target,
  DollarSign,
  Activity,
  ArrowUpRight,
  MapPin,
  Star,
  ChevronRight,
  Globe,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/providers/trpc';
import DataOrb from '@/components/DataOrb';
import MagneticGradient from '@/components/MagneticGradient';
// import FlipNumber from '@/components/FlipNumber';
import ScoreRing from '@/components/ScoreRing';

export default function Dashboard() {
  const navigate = useNavigate();
  const [animatedLeads, setAnimatedLeads] = useState(0);

  const leadsQuery = trpc.lead.list.useQuery({ limit: 5 });
  const pipelineQuery = trpc.lead.pipeline.useQuery();
  const scoutList = trpc.scout.list.useQuery();

  const leads = leadsQuery.data?.items || [];
  const pipeline = pipelineQuery.data;
  const activeJobs = (scoutList.data || []).filter((j) => j.status === 'running').slice(0, 3);

  // Count totals
  const totalLeads = leadsQuery.data?.total || 0;
  const wonRevenue = pipeline?.totalRevenue || 0;

  useEffect(() => {
    if (!totalLeads) return;
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedLeads(Math.floor(totalLeads * eased));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [totalLeads]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden" style={{ height: 500 }}>
        <DataOrb />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/80 via-[#0a0a0c]/40 to-transparent z-[1]" />
        <div className="absolute inset-0 flex items-center z-[10] p-10">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">AI Agent Active</span>
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight text-[#f4f4f5] mb-4" style={{ letterSpacing: '-0.03em' }}>
                Autonomous Lead<br /><span className="text-gradient">Generation.</span>
              </h1>
              <p className="text-[#8c8c96] text-lg mb-8 leading-relaxed">
                Find real businesses in your area, analyse their websites, and generate AI-powered outreach.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => navigate('/leads')} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2 shadow-lg shadow-violet-500/25">
                  <Sparkles className="w-4 h-4" />
                  View Leads
                </Button>
                <Button variant="outline" onClick={() => navigate('/search')} className="border-[#2a2a2e] bg-white/5 text-[#f4f4f5] hover:bg-white/10">
                  Launch New Scout
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Leads', value: totalLeads, change: '+New', icon: Users },
          { label: 'In Pipeline', value: (pipeline?.stages?.research || 0) + (pipeline?.stages?.contacted || 0) + (pipeline?.stages?.negotiation || 0), change: 'Active', icon: Target },
          { label: 'Won Deals', value: pipeline?.stages?.won || 0, change: 'Closed', icon: Activity },
          { label: 'Won Revenue', value: `£${wonRevenue.toLocaleString()}`, change: 'Total', icon: DollarSign },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
            <MagneticGradient className="p-5 cursor-pointer" onClick={() => navigate('/leads')}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <kpi.icon className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  {kpi.change}
                </div>
              </div>
              <div className="data-mono text-2xl font-semibold text-[#f4f4f5] mb-1">
                {typeof kpi.value === 'number' && kpi.label === 'Active Leads' ? animatedLeads.toLocaleString() : kpi.value}
              </div>
              <div className="text-xs text-[#6c6c74]">{kpi.label}</div>
            </MagneticGradient>
          </motion.div>
        ))}
      </section>

      {/* Active Scout Jobs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Recent Scout Activity</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/search')} className="text-violet-400 hover:text-violet-300 gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {activeJobs.length === 0 ? (
          <div className="glass-panel rounded-xl p-6 text-center">
            <Sparkles className="w-8 h-8 text-[#2a2a2e] mx-auto mb-3" />
            <p className="text-[#6c6c74]">No active scouts. Launch one from the AI Scout page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeJobs.map((job, i) => (
              <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + 0.1 * i }}
                className="glass-panel rounded-xl p-5 hover:border-violet-500/20 transition-all cursor-pointer" onClick={() => navigate('/search')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-medium text-[#f4f4f5]">{job.query}</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400">{job.status}</span>
                </div>
                <div className="h-2 bg-[#1c1c20] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 progress-striped rounded-full" style={{ width: `${job.progress}%` }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Leads + Pipeline */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#f4f4f5]">Recent Leads</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="text-violet-400 hover:text-violet-300 gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {leadsQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-violet-400 animate-spin" /></div>
          ) : leads.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center">
              <Globe className="w-10 h-10 text-[#2a2a2e] mx-auto mb-3" />
              <p className="text-[#6c6c74]">No leads yet. Run a scout job to find businesses.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.slice(0, 5).map((item, i) => {
                const lead = item as Record<string, unknown>;
                const business = lead.business as Record<string, unknown> | undefined;
                return (
                  <motion.div key={String(lead.id)} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                    className="glass-panel rounded-xl p-4 hover:border-violet-500/20 transition-all cursor-pointer group" onClick={() => navigate(`/leads/${String(lead.id)}`)}>
                    <div className="flex items-center gap-4">
                      <ScoreRing score={(lead.overallScore as number) || 0} size={56} strokeWidth={5} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors truncate">
                          {business?.name as string || 'Unknown'}
                        </h3>
                        <p className="text-xs text-[#6c6c74] mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{business?.address as string || 'No address'}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#8c8c96]">{business?.industry as string || 'Business'}</span>
                          <span className="text-[#2a2a2e]">|</span>
                          <span className="text-xs text-[#8c8c96] flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400" />{business?.googleRating as number || 0}
                          </span>
                          <span className="text-[#2a2a2e]">|</span>
                          <span className="text-xs text-[#8c8c96]">{(lead.salesProbability as number) || 0}% conversion</span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-[#6c6c74] group-hover:text-violet-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pipeline Overview */}
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4">Pipeline</h2>
          <div className="glass-panel rounded-xl p-5 space-y-4">
            {[
              { stage: 'Research', key: 'research', color: 'bg-violet-500' },
              { stage: 'Contacted', key: 'contacted', color: 'bg-blue-500' },
              { stage: 'Negotiation', key: 'negotiation', color: 'bg-amber-500' },
              { stage: 'Won', key: 'won', color: 'bg-emerald-500' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors" onClick={() => navigate('/pipeline')}>
                <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${item.color}`} /><span className="text-sm text-[#f4f4f5]">{item.stage}</span></div>
                <span className="data-mono text-sm font-semibold text-[#f4f4f5]">{pipeline?.stages?.[item.key as keyof typeof pipeline.stages] || 0}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-[#2a2a2e]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8c8c96]">Total Won</span>
                <span className="data-mono text-lg font-semibold text-emerald-400">£{wonRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
