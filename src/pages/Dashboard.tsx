import { Link } from 'react-router';
import { motion } from 'framer-motion';
import {
  Users, Search, TrendingUp, Target, ArrowRight,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } } };

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useQuery<{ stages: Record<string, number>; totalRevenue: number }>("lead.pipeline");
  const { data: recentLeads, isLoading: leadsLoading } = useQuery<{ items: any[]; total: number }>("lead.list", { limit: 5, offset: 0 });

  const stageCount = (stage: string) => stats?.stages?.[stage] ?? 0;
  const totalLeads = stats?.stages ? Object.values(stats.stages).reduce((sum: number, c) => sum + (c || 0), 0) : 0;

  const statCards = [
    { label: 'Total Leads', value: totalLeads, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    { label: 'New', value: stageCount('research'), icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Contacted', value: stageCount('contacted'), icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'Won', value: stageCount('won'), icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-6xl mx-auto">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-[#f4f4f5]">Dashboard</h1>
        <p className="text-sm text-[#6c6c74] mt-1">
          Welcome back{user?.name ? `, ${user.name}` : ''}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <motion.div key={s.label} variants={item} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="data-mono text-2xl font-bold text-[#f4f4f5]">{statsLoading ? '...' : s.value}</div>
            <div className="text-[10px] text-[#6c6c74] uppercase tracking-wider mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item} className="glass-panel rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Recent Leads</h2>
          <Link to="/leads" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {leadsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : !recentLeads?.items?.length ? (
          <div className="text-center py-8 text-[#6c6c74]">
            <p>No leads yet.</p>
            <Link to="/search" className="text-violet-400 hover:underline text-sm">Run your first search</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLeads.items.slice(0, 5).map((lead: any) => {
              const business = (lead as Record<string, unknown>).business as Record<string, unknown> | undefined;
              return (
                <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1c1c20] transition-colors group">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-400">{(business?.name as string)?.[0] || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#f4f4f5] group-hover:text-violet-400 transition-colors truncate">{(business?.name as string) || 'Unknown'}</p>
                    <p className="text-xs text-[#6c6c74] truncate">{(lead as Record<string, unknown>).stage as string} · {(lead as Record<string, unknown>).priority as string}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#4a4a52] group-hover:text-violet-400 transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/search" className="glass-panel rounded-xl p-6 hover:border-violet-500/30 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Search className="w-6 h-6 text-violet-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors">AI Scout</h3>
              <p className="text-xs text-[#6c6c74]">Find real businesses in your area</p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#4a4a52] group-hover:text-violet-400 transition-colors" />
          </div>
        </Link>

        <Link to="/pipeline" className="glass-panel rounded-xl p-6 hover:border-violet-500/30 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors">Pipeline</h3>
              <p className="text-xs text-[#6c6c74]">Manage your sales pipeline</p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#4a4a52] group-hover:text-violet-400 transition-colors" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
