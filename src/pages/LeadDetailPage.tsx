import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Clock,
  AlertCircle,
  Zap,
  Target,
  BarChart3,
  Palette,
  Shield,
  Smartphone,
  Gauge,
  MessageSquare,
  Send,
  FileText,
  Tag,
  Plus,
  Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ScoreRing from '@/components/ScoreRing';
import { mockLeads } from '@/data/mockData';
import { useToast } from '@/hooks/useToast';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState<Array<{ id: string; content: string; createdAt: string; createdBy: string }>>([]);

  const lead = mockLeads.find((l) => l.id === id);

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

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes([...notes, { id: `note_${Date.now()}`, content: newNote, createdAt: new Date().toISOString(), createdBy: 'You' }]);
    setNewNote('');
    addToast('Note added', 'success');
  };

  const allNotes = [...lead.notes, ...notes];

  const scoreBreakdown = [
    { label: 'Website', value: lead.score.website, icon: Globe, color: 'from-violet-500 to-violet-600' },
    { label: 'SEO', value: lead.score.seo, icon: Target, color: 'from-blue-500 to-blue-600' },
    { label: 'Performance', value: lead.score.performance, icon: Gauge, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Design', value: lead.score.design, icon: Palette, color: 'from-pink-500 to-pink-600' },
    { label: 'Brand', value: lead.score.brand, icon: Star, color: 'from-amber-500 to-amber-600' },
    { label: 'Marketing', value: lead.score.marketing, icon: Zap, color: 'from-orange-500 to-orange-600' },
    { label: 'Conversion', value: lead.score.conversion, icon: BarChart3, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Local Presence', value: lead.score.localPresence, icon: MapPin, color: 'from-indigo-500 to-indigo-600' },
  ];

  const analysisItems = lead.analysis
    ? [
        { label: 'Modern Appearance', value: lead.analysis.modernAppearance, icon: Palette },
        { label: 'Mobile Responsive', value: lead.analysis.mobileResponsiveness, icon: Smartphone },
        { label: 'SEO Score', value: lead.analysis.seoScore, icon: Target },
        { label: 'Page Speed', value: lead.analysis.pageSpeed, icon: Gauge },
        { label: 'Accessibility', value: lead.analysis.accessibility, icon: Shield },
        { label: 'Content Quality', value: lead.analysis.contentQuality, icon: FileText },
        { label: 'Navigation', value: lead.analysis.navigation, icon: MapPin },
        { label: 'Trust Signals', value: lead.analysis.trustSignals, icon: Shield },
        { label: 'CTA Quality', value: lead.analysis.callToActionQuality, icon: Target },
        { label: 'Lead Gen Potential', value: lead.analysis.leadGenerationPotential, icon: Zap },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/leads')}
          className="text-[#8c8c96] hover:text-[#f4f4f5] mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Leads
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <ScoreRing score={lead.score.overall} size={80} strokeWidth={6} />
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-[#f4f4f5]">{lead.business.name}</h1>
                {!lead.business.hasWebsite && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertCircle className="w-3 h-3" />
                    No Website
                  </span>
                )}
              </div>
              <p className="text-[#8c8c96] text-sm flex items-center gap-1 mb-2">
                <MapPin className="w-4 h-4" />
                {lead.business.address}
              </p>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-[#1c1c20] border-[#2a2a2e] text-[#8c8c96]">
                  {lead.business.industry}
                </Badge>
                <span className="text-sm text-[#8c8c96] flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400" />
                  {lead.business.googleRating} ({lead.business.reviewCount} reviews)
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  lead.score.priority === 'urgent' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  lead.score.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {lead.score.priority} priority
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => { addToast('Contact details copied!', 'success'); }}
              className="border-[#2a2a2e] text-[#8c8c96] hover:text-[#f4f4f5]"
            >
              <Phone className="w-4 h-4 mr-2" />
              {lead.business.phone}
            </Button>
            <Button
              variant="outline"
              onClick={() => { addToast('Email draft created!', 'success'); navigate('/email'); }}
              className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white border-0 hover:from-violet-600 hover:to-indigo-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#131316] border border-[#2a2a2e] p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            Website Analysis
          </TabsTrigger>
          <TabsTrigger value="scores" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            AI Scores
          </TabsTrigger>
          <TabsTrigger value="outreach" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            Outreach
          </TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            Notes ({allNotes.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Business Info */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">Business Information</h3>
              <div className="space-y-3">
                {[
                  { icon: User as typeof Globe, label: 'Owner', value: lead.business.owner },
                  { icon: Phone, label: 'Phone', value: lead.business.phone },
                  { icon: Mail, label: 'Email', value: lead.business.email },
                  { icon: Globe, label: 'Website', value: lead.business.website || 'None' },
                  { icon: Clock, label: 'Opening Hours', value: lead.business.openingHours },
                ].map((item) => (
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
                    <ScoreRing score={lead.score.overall} size={60} strokeWidth={5} />
                    <p className="text-xs text-[#6c6c74] mt-2">Overall Score</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <div className="data-mono text-3xl font-semibold text-violet-400">{lead.score.salesProbability}%</div>
                    <p className="text-xs text-[#6c6c74] mt-1">Sales Probability</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <div className="data-mono text-3xl font-semibold text-emerald-400">{lead.score.growthPotential}</div>
                    <p className="text-xs text-[#6c6c74] mt-1">Growth Potential</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                    <div className="data-mono text-3xl font-semibold text-amber-400">{lead.score.localPresence}</div>
                    <p className="text-xs text-[#6c6c74] mt-1">Local Presence</p>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6">
                <h3 className="text-lg font-semibold text-[#f4f4f5] mb-3">Description</h3>
                <p className="text-sm text-[#8c8c96] leading-relaxed">{lead.business.description}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="bg-violet-500/5 border-violet-500/20 text-violet-400">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          {lead.analysis ? (
            <>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
                <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">Technical Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'CMS', value: lead.analysis.cmsDetection || 'Unknown' },
                    { label: 'Hosting', value: lead.analysis.hosting || 'Unknown' },
                    { label: 'SSL Certificate', value: lead.analysis.ssl ? 'Installed' : 'Missing' },
                    { label: 'Estimated Age', value: `${lead.analysis.estimatedWebsiteAge} years` },
                    { label: 'Last Redesign', value: `${lead.analysis.estimatedLastRedesign} years ago` },
                    { label: 'Broken Links', value: `${lead.analysis.brokenLinks} found` },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-lg bg-[#0a0a0c]">
                      <p className="text-xs text-[#6c6c74] mb-1">{item.label}</p>
                      <p className="text-sm text-[#f4f4f5]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="glass-panel rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-4 h-4 text-violet-400" />
                        <span className="text-sm text-[#f4f4f5]">{item.label}</span>
                      </div>
                      <span className="data-mono text-sm font-semibold text-[#f4f4f5]">{item.value}/100</span>
                    </div>
                    <div className="h-2 bg-[#1c1c20] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {lead.analysis.outdatedTechnologies.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6 border-amber-500/20">
                  <h3 className="text-lg font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Outdated Technologies Detected
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {lead.analysis.outdatedTechnologies.map((tech) => (
                      <Badge key={tech} variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-400">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 glass-panel rounded-xl">
              <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#f4f4f5] mb-2">No Website Detected</h3>
              <p className="text-[#8c8c96] max-w-md mx-auto mb-4">
                This business does not have a website. This represents a high-value opportunity.
              </p>
              <div className="flex justify-center gap-4">
                <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                  <div className="data-mono text-2xl font-semibold text-emerald-400">{lead.score.salesProbability}%</div>
                  <p className="text-xs text-[#6c6c74]">Conversion Likelihood</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                  <div className="data-mono text-2xl font-semibold text-violet-400">High</div>
                  <p className="text-xs text-[#6c6c74]">Urgency</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-[#0a0a0c]">
                  <div className="data-mono text-2xl font-semibold text-amber-400">2-5k</div>
                  <p className="text-xs text-[#6c6c74]">Est. Project Value</p>
                </div>
              </div>
            </motion.div>
          )}
        </TabsContent>

        {/* Scores Tab */}
        <TabsContent value="scores" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scoreBreakdown.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="glass-panel rounded-xl p-5"
              >
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
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.8, delay: 0.1 * i, ease: 'easeOut' }}
                    className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                  />
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
                <MessageSquare className="w-5 h-5 text-violet-400" />
                AI-Generated Cold Email
              </h3>
              <div className="bg-[#0a0a0c] rounded-lg p-5 space-y-3">
                <p className="text-xs text-[#6c6c74] uppercase tracking-wider">Subject</p>
                <p className="text-sm text-violet-400 font-medium">
                  Your {lead.business.name} deserves a stunning website
                </p>
                <div className="border-t border-[#2a2a2e] pt-3">
                  <p className="text-xs text-[#6c6c74] uppercase tracking-wider mb-2">Body</p>
                  <div className="text-sm text-[#f4f4f5] leading-relaxed space-y-3">
                    <p>Hi {lead.business.owner.split(' ')[0]},</p>
                    <p>
                      I came across {lead.business.name} and was impressed by your{' '}
                      {lead.business.googleRating}-star rating and {lead.business.reviewCount} reviews. 
                      You clearly deliver exceptional service!
                    </p>
                    <p>
                      {!lead.business.hasWebsite
                        ? "I noticed you don't currently have a website. In today's digital world, 76% of people search online before visiting a business. You're missing out on potential clients every day."
                        : "I reviewed your current website and identified several opportunities to improve your online presence and attract more customers."}
                    </p>
                    <p>
                      I'd love to build you a beautiful, modern website that showcases your work 
                      and brings in more {lead.business.industry.toLowerCase()} clients. 
                      A professional site starts at just £1,500.
                    </p>
                    <p>Would you be open to a quick 10-minute chat this week?</p>
                    <p>
                      Best regards,
                      <br />
                      <span className="text-[#8c8c96]">[Your Name]</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => { addToast('Email copied to clipboard!', 'success'); }}
                  variant="outline"
                  className="border-[#2a2a2e] text-[#8c8c96]"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Copy Email
                </Button>
                <Button
                  onClick={() => { addToast('Opening email client...', 'info'); navigate('/email'); }}
                  className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send via Email Center
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel rounded-xl p-5">
                <h4 className="text-sm font-semibold text-[#f4f4f5] mb-3">LinkedIn Message</h4>
                <div className="bg-[#0a0a0c] rounded-lg p-4 text-sm text-[#f4f4f5] leading-relaxed">
                  Hi {lead.business.owner.split(' ')[0]}, I came across {lead.business.name} and love what you're doing in the {lead.business.industry.toLowerCase()} space. I'd love to help you reach more customers online. Would you be interested in a quick chat?
                </div>
                <Button variant="ghost" size="sm" className="mt-3 text-violet-400" onClick={() => addToast('LinkedIn message copied!', 'success')}>
                  Copy Message
                </Button>
              </div>
              <div className="glass-panel rounded-xl p-5">
                <h4 className="text-sm font-semibold text-[#f4f4f5] mb-3">Phone Script</h4>
                <div className="bg-[#0a0a0c] rounded-lg p-4 text-sm text-[#f4f4f5] leading-relaxed">
                  "Hi, this is [Your Name] from [Company]. I found {lead.business.name} online and was really impressed by your reviews. I'm a web designer who helps {lead.business.industry.toLowerCase()} businesses get more customers through better websites. Do you have 5 minutes to chat about how I could help you?"
                </div>
                <Button variant="ghost" size="sm" className="mt-3 text-violet-400" onClick={() => addToast('Phone script copied!', 'success')}>
                  Copy Script
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
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note..."
                className="flex-1 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
              />
              <Button onClick={addNote} className="bg-violet-500 hover:bg-violet-600 text-white">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {allNotes.length === 0 && (
                <p className="text-center text-[#6c6c74] py-8">No notes yet. Add your first note above.</p>
              )}
              {allNotes.map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <Edit3 className="w-3 h-3 text-violet-400" />
                      </div>
                      <span className="text-xs text-[#8c8c96]">{note.createdBy}</span>
                    </div>
                    <span className="text-xs text-[#6c6c74]">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
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

import { User } from 'lucide-react';
