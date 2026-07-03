import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Phone, Mail, Globe, Star,
  AlertCircle, Zap, Target, BarChart3, Palette, Shield,
  Smartphone, Gauge, MessageSquare, Send, FileText, Tag,
  Plus, Edit3, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ScoreRing from '@/components/ScoreRing';
import { useQuery, useMutation } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [newNote, setNewNote] = useState('');

  const leadId = Number(id);

  const { data: lead, isLoading } = useQuery<any>("lead.get", { id: leadId });
  const addNoteMutation = useMutation<{ leadId: number; content: string }, any>("lead.addNote");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-[#2a2a2e] mx-auto mb-4" />
        <p className="text-[#6c6c74]">Lead not found</p>
        <Button variant="outline" onClick={() => navigate('/leads')} className="mt-4 border-[#2a2a2e] text-[#8c8c96]">
          Back to Leads
        </Button>
      </div>
    );
  }

  const business = lead.business || {};
  const analysis = lead.analysis || null;
  const notes = lead.notes || [];

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addNoteMutation.mutate({ leadId, content: newNote });
      addToast('Note added', 'success');
      setNewNote('');
      window.location.reload();
    } catch {
      addToast('Failed to add note', 'error');
    }
  };

  const overallScore = lead.overallScore || 0;
  const priority = lead.priority || 'low';
  const stage = lead.stage || 'research';

  const scoreBreakdown = [
    { label: 'Website', value: lead.websiteScore || 0, icon: Globe, color: 'from-violet-500 to-violet-600' },
    { label: 'SEO', value: lead.seoScore || 0, icon: Target, color: 'from-blue-500 to-blue-600' },
    { label: 'Performance', value: lead.performanceScore || 0, icon: Gauge, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Design', value: lead.designScore || 0, icon: Palette, color: 'from-pink-500 to-pink-600' },
    { label: 'Brand', value: lead.brandScore || 0, icon: Star, color: 'from-amber-500 to-amber-600' },
    { label: 'Marketing', value: lead.marketingScore || 0, icon: Zap, color: 'from-orange-500 to-orange-600' },
    { label: 'Conversion', value: lead.conversionScore || 0, icon: BarChart3, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Local Presence', value: lead.localPresenceScore || 0, icon: MapPin, color: 'from-indigo-500 to-indigo-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="text-[#8c8c96] hover:text-[#f4f4f5] mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />Back to Leads
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <ScoreRing score={overallScore} size={80} strokeWidth={6} />
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-[#f4f4f5]">{business.name || 'Unknown'}</h1>
                {!business.hasWebsite && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertCircle className="w-3 h-3" />No Website
                  </span>
                )}
              </div>
              <p className="text-[#8c8c96] text-sm flex items-center gap-1 mb-2">
                <MapPin className="w-4 h-4" />{business.address || business.city || 'No address'}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96]">{business.industry || 'Unknown'}</Badge>
                {business.googleRating ? (
                  <span className="text-sm text-[#8c8c96] flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400" />{business.googleRating} ({business.reviewCount || 0} reviews)
                  </span>
                ) : null}
                <Badge variant="outline" className={`${priority === 'urgent' || priority === 'high' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'}`}>
                  {priority} priority
                </Badge>
                <Badge variant="outline" className="border-violet-500/30 text-violet-400 bg-violet-500/10">{stage}</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {business.phone ? (
              <Button variant="outline" className="border-[#2a2a2e] text-[#8c8c96] hover:text-[#f4f4f5]" onClick={() => addToast('Phone copied!', 'success')}>
                <Phone className="w-4 h-4 mr-2" />{business.phone}
              </Button>
            ) : null}
            <Button className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white border-0 hover:from-violet-600 hover:to-indigo-700" onClick={() => navigate('/email')}>
              <Send className="w-4 h-4 mr-2" />Send Email
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#131316] border border-[#2a2a2e] p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">Overview</TabsTrigger>
          <TabsTrigger value="scores" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">AI Scores</TabsTrigger>
          <TabsTrigger value="outreach" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">Outreach</TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Business Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">Business Information</h3>
              <div className="space-y-3">
                {[
                  { icon: Phone, label: 'Phone', value: business.phone || 'Not available' },
                  { icon: Mail, label: 'Email', value: business.email || 'Not available' },
                  { icon: Globe, label: 'Website', value: business.website || 'None' },
                  { icon: MapPin, label: 'Address', value: business.address || 'Not available' },
                ].filter(i => i.value).map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0c]">
                    <item.icon className="w-5 h-5 text-violet-400 shrink-0" />
                    <div>
                      <p className="text-xs text-[#6c6c74]">{item.label}</p>
                      <p className="text-sm text-[#f4f4f5]">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
              <div className="glass-panel rounded-xl p-6">
                <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">Opportunity Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <ScoreRing score={overallScore} size={60} strokeWidth={5} />
                    <p className="text-xs text-[#6c6c74] mt-2">Overall Score</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <div className="data-mono text-3xl font-semibold text-violet-400">{lead.salesProbability || 0}%</div>
                    <p className="text-xs text-[#6c6c74] mt-1">Sales Probability</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <div className="data-mono text-3xl font-semibold text-emerald-400">{lead.growthPotential || 0}</div>
                    <p className="text-xs text-[#6c6c74] mt-1">Growth Potential</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <div className="data-mono text-3xl font-semibold text-amber-400">{lead.localPresenceScore || 0}</div>
                    <p className="text-xs text-[#6c6c74] mt-1">Local Presence</p>
                  </div>
                </div>
              </div>

              {business.description ? (
                <div className="glass-panel rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-[#f4f4f5] mb-3">Description</h3>
                  <p className="text-sm text-[#8c8c96] leading-relaxed">{business.description}</p>
                </div>
              ) : null}

              {lead.tags ? (
                <div className="glass-panel rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-[#f4f4f5] mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(lead.tags) ? lead.tags : []).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="bg-violet-500/5 border-violet-500/20 text-violet-400">
                        <Tag className="w-3 h-3 mr-1" />{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        </TabsContent>

        {/* Scores Tab */}
        <TabsContent value="scores" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scoreBreakdown.map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                className="glass-panel rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${item.color} flex items-center justify-center`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-[#f4f4f5]">{item.label}</span>
                  </div>
                  <span className="data-mono text-lg font-semibold text-[#f4f4f5]">{item.value}</span>
                </div>
                <div className="h-3 bg-[#1c1c20] rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.value}%` }} transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${item.color}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-violet-400" />AI Cold Email Template
              </h3>
              <div className="bg-[#0a0a0c] rounded-lg p-5 space-y-3">
                <p className="text-xs text-[#6c6c74] uppercase tracking-wider">Subject</p>
                <p className="text-sm text-violet-400 font-medium">Your {business.name || 'business'} deserves a stunning website</p>
                <div className="border-t border-[#2a2a2e] pt-3">
                  <p className="text-xs text-[#6c6c74] uppercase tracking-wider mb-2">Body</p>
                  <div className="text-sm text-[#f4f4f5] leading-relaxed space-y-3">
                    <p>Hi there,</p>
                    <p>I came across {business.name || 'your business'} and was impressed by your {business.googleRating || 'great'}-star rating{business.reviewCount ? ` and ${business.reviewCount} reviews` : ''}.</p>
                    <p>{!business.website ? "I noticed you don't currently have a website. In today's digital world, 76% of people search online before visiting a business." : "I reviewed your current website and identified several opportunities to improve your online presence."}</p>
                    <p>I'd love to build you a beautiful, modern website that showcases your work. A professional site starts at just £1,500.</p>
                    <p>Would you be open to a quick 10-minute chat this week?</p>
                    <p>Best regards,<br /><span className="text-[#8c8c96]">[Your Name]</span></p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" className="border-[#2a2a2e] text-[#8c8c96]" onClick={() => addToast('Email copied!', 'success')}>
                  <FileText className="w-4 h-4 mr-2" />Copy Email
                </Button>
                <Button className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white" onClick={() => navigate('/email')}>
                  <Send className="w-4 h-4 mr-2" />Send via Email Center
                </Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">Notes & Activity</h3>
            <div className="flex gap-3 mb-6">
              <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note..." className="flex-1 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5]" />
              <Button onClick={addNote} className="bg-violet-500 hover:bg-violet-600 text-white"><Plus className="w-4 h-4 mr-1" />Add</Button>
            </div>
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-center text-[#6c6c74] py-8">No notes yet. Add your first note above.</p>
              ) : notes.map((note: any, i: number) => (
                <motion.div key={note.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                  className="p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <Edit3 className="w-3 h-3 text-violet-400" />
                      </div>
                      <span className="text-xs text-[#8c8c96]">You</span>
                    </div>
                    <span className="text-xs text-[#6c6c74]">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'Just now'}</span>
                  </div>
                  <p className="text-sm text-[#f4f4f5]">{note.content}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
