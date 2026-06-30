import { useState, useEffect } from 'react';
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
  Clock,
  ChevronRight,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DataOrb from '@/components/DataOrb';
import MagneticGradient from '@/components/MagneticGradient';
import FlipNumber from '@/components/FlipNumber';
import ScoreRing from '@/components/ScoreRing';
import { mockLeads, mockScoutJobs } from '@/data/mockData';

const kpiData = [
  { label: 'Active Leads', value: 12450, change: '+8.2%', icon: Users, positive: true },
  { label: 'Conversion Rate', value: 4.2, suffix: '%', change: '+1.1%', icon: Target, positive: true },
  { label: 'Avg. Opportunity Score', value: 78.4, change: '+2.3', icon: Activity, positive: true },
  { label: 'Revenue in Pipeline', value: 142000, prefix: '$', change: '+12.5%', icon: DollarSign, positive: true },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [animatedLeads, setAnimatedLeads] = useState(0);
  const [animatedConversion, setAnimatedConversion] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedRevenue, setAnimatedRevenue] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedLeads(Math.floor(12450 * eased));
      setAnimatedConversion(parseFloat((4.2 * eased).toFixed(1)));
      setAnimatedScore(parseFloat((78.4 * eased).toFixed(1)));
      setAnimatedRevenue(Math.floor(142000 * eased));
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const recentLeads = mockLeads.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero Section with Data Orb */}
      <section className="relative rounded-2xl overflow-hidden" style={{ height: 500 }}>
        <DataOrb />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c]/80 via-[#0a0a0c]/40 to-transparent z-[1]" />
        <div className="absolute inset-0 flex items-center z-[10] p-10">
          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                  AI Agent Active
                </span>
              </div>
              <h1 className="text-5xl font-extrabold tracking-tight text-[#f4f4f5] mb-4" style={{ letterSpacing: '-0.03em' }}>
                Autonomous Lead
                <br />
                <span className="text-gradient">Generation.</span>
              </h1>
              <p className="text-[#8c8c96] text-lg mb-8 leading-relaxed">
                Your AI scout is continuously analyzing the web.{' '}
                <span className="text-violet-400 font-medium">14 new opportunities</span> found in the last hour.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => navigate('/leads')}
                  className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-2 shadow-lg shadow-violet-500/25"
                >
                  <Sparkles className="w-4 h-4" />
                  View New Leads
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/search')}
                  className="border-[#2a2a2e] bg-white/5 text-[#f4f4f5] hover:bg-white/10 hover:border-violet-500/30"
                >
                  Launch New Scout
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
          >
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
                {kpi.prefix}
                {kpi.label.includes('Revenue')
                  ? animatedRevenue.toLocaleString()
                  : kpi.label.includes('Score')
                    ? animatedScore.toFixed(1)
                    : kpi.label.includes('Conversion')
                      ? animatedConversion.toFixed(1)
                      : animatedLeads.toLocaleString()}
                {kpi.suffix}
              </div>
              <div className="text-xs text-[#6c6c74]">{kpi.label}</div>
            </MagneticGradient>
          </motion.div>
        ))}
      </section>

      {/* Active Scout Jobs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#f4f4f5]">Active Scout Jobs</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/search')}
            className="text-violet-400 hover:text-violet-300 gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mockScoutJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + 0.1 * i }}
              className="glass-panel rounded-xl p-5 hover:border-violet-500/20 transition-all cursor-pointer"
              onClick={() => navigate('/search')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {job.status === 'running' ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                  )}
                  <span className="text-sm font-medium text-[#f4f4f5]">{job.query}</span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    job.status === 'running'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-violet-500/10 text-violet-400'
                  }`}
                >
                  {job.status === 'running' ? 'Scanning' : 'Complete'}
                </span>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-[#6c6c74] mb-1">
                  <span>{job.currentSource}</span>
                  <span>{job.progress}%</span>
                </div>
                <div className="h-2 bg-[#1c1c20] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      job.status === 'running' ? 'bg-gradient-to-r from-violet-500 to-indigo-500 progress-striped' : 'bg-violet-500'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-[#8c8c96]">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {job.leadsFound} leads
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {job.sourcesScanned}/{job.totalSources} sources
                  </span>
                </div>
                <div className="data-mono text-lg font-semibold text-violet-400">
                  <FlipNumber value={job.leadsFound} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Opportunities Feed + Recent Leads */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent High-Priority Leads */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#f4f4f5]">High-Priority Opportunities</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/leads')}
              className="text-violet-400 hover:text-violet-300 gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {recentLeads.map((lead, i) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="glass-panel rounded-xl p-4 hover:border-violet-500/20 transition-all cursor-pointer group"
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <div className="flex items-center gap-4">
                  <ScoreRing score={lead.score.overall} size={56} strokeWidth={5} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[#f4f4f5] group-hover:text-violet-400 transition-colors truncate">
                        {lead.business.name}
                      </h3>
                      {!lead.business.hasWebsite && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          No Website
                        </span>
                      )}
                      {lead.score.priority === 'urgent' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Star className="w-3 h-3" />
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6c6c74] mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {lead.business.address}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#8c8c96]">{lead.business.industry}</span>
                      <span className="text-[#2a2a2e]">|</span>
                      <span className="text-xs text-[#8c8c96] flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        {lead.business.googleRating} ({lead.business.reviewCount})
                      </span>
                      <span className="text-[#2a2a2e]">|</span>
                      <span className="text-xs text-[#8c8c96] flex items-center gap-1">
                        <Target className="w-3 h-3 text-violet-400" />
                        {lead.score.salesProbability}% conversion
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#6c6c74] group-hover:text-violet-400 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Stats Panel */}
        <div>
          <h2 className="text-lg font-semibold text-[#f4f4f5] mb-4">Pipeline Overview</h2>
          <div className="glass-panel rounded-xl p-5 space-y-4">
            {[
              { stage: 'Research', count: 12, color: 'bg-violet-500' },
              { stage: 'Contacted', count: 8, color: 'bg-blue-500' },
              { stage: 'Negotiation', count: 4, color: 'bg-amber-500' },
              { stage: 'Won', count: 3, color: 'bg-emerald-500' },
            ].map((item) => (
              <div
                key={item.stage}
                className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
                onClick={() => navigate('/pipeline')}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-[#f4f4f5]">{item.stage}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="data-mono text-sm font-semibold text-[#f4f4f5]">{item.count}</span>
                  <ChevronRight className="w-4 h-4 text-[#6c6c74]" />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-[#2a2a2e]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#8c8c96]">Total Pipeline Value</span>
                <span className="data-mono text-lg font-semibold text-emerald-400">$142,000</span>
              </div>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-[#f4f4f5] mt-6 mb-4">Recent Activity</h2>
          <div className="glass-panel rounded-xl p-4 space-y-3">
            {[
              { action: 'New lead found', target: 'Smith Dental Care', time: '2 min ago', icon: Users },
              { action: 'Email sent', target: 'Prestige Hair Studio', time: '15 min ago', icon: Activity },
              { action: 'Analysis complete', target: 'Greenfield Plumbing', time: '1 hr ago', icon: Target },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <activity.icon className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f4f4f5] truncate">{activity.action}</p>
                  <p className="text-xs text-[#6c6c74] truncate">{activity.target}</p>
                </div>
                <span className="text-xs text-[#6c6c74] flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" />
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
