import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Copy,
  Sparkles,
  Loader2,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/providers/trpc';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';

export default function OutreachPage() {
  const { addToast } = useToast();
  const { kimiApiKey } = useSettings();
  const utils = trpc.useUtils();

  const leadsQuery = trpc.lead.list.useQuery({});
  const allLeads = (leadsQuery.data?.items || []) as Array<Record<string, unknown>>;

  const [selectedLead, setSelectedLead] = useState<Record<string, unknown> | null>(null);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, { content: string; subject?: string; body?: string }>>({});

  const generateOutreach = trpc.outreach.generate.useMutation({
    onSuccess: (data, vars) => {
      setGenerated((prev) => ({
        ...prev,
        [vars.type]: { content: data.content, subject: data.subject || undefined, body: data.body || undefined },
      }));
      setGeneratingType(null);
      addToast(`${vars.type} generated!`, 'success');
      utils.outreach.list.invalidate();
    },
    onError: (err) => {
      setGeneratingType(null);
      addToast(err.message, 'error');
    },
  });

  const handleGenerate = (type: string) => {
    if (!selectedLead) {
      addToast('Select a lead first', 'warning');
      return;
    }
    if (!kimiApiKey) {
      addToast('Add Kimi API key in Settings first', 'warning');
      return;
    }
    setGeneratingType(type);
    generateOutreach.mutate({
      leadId: selectedLead.id as number,
      type: type as Parameters<typeof generateOutreach.mutate>[0]['type'],
      kimiApiKey,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied!`, 'success');
  };

  const outreachTypes = [
    { id: 'cold_email', label: 'Cold Email', icon: Mail, description: 'Personalised outreach email' },
    { id: 'linkedin', label: 'LinkedIn Message', icon: MessageSquare, description: 'Professional LinkedIn DM' },
    { id: 'facebook', label: 'Facebook Message', icon: MessageSquare, description: 'Casual Facebook outreach' },
    { id: 'phone_script', label: 'Phone Script', icon: Phone, description: 'Complete call script' },
    { id: 'followup1', label: 'Follow-up #1', icon: MessageSquare, description: 'First follow-up email' },
    { id: 'followup2', label: 'Follow-up #2', icon: MessageSquare, description: 'Second follow-up email' },
    { id: 'proposal', label: 'Proposal', icon: FileText, description: 'Website proposal draft' },
  ];

  if (!kimiApiKey) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">AI Outreach Assistant</h1>
        </motion.div>
        <div className="glass-panel rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#f4f4f5] mb-2">Kimi API Key Required</h3>
          <p className="text-[#8c8c96]">Add your Kimi API key in Settings to generate AI outreach content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">AI Outreach Assistant</h1>
        <p className="text-[#8c8c96]">Generate personalised outreach powered by Kimi AI</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-4">Select Lead</h3>
            {leadsQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-violet-400 animate-spin" /></div>
            ) : allLeads.length === 0 ? (
              <p className="text-[#6c6c74] text-center py-8">No leads yet. Run a scout first.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
                {allLeads.map((item) => {
                  const lead = item;
                  const business = lead.business as Record<string, unknown> | undefined;
                  return (
                    <button key={String(lead.id)} onClick={() => setSelectedLead(lead)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${selectedLead?.id === lead.id ? 'bg-violet-500/10 border border-violet-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs text-white font-medium shrink-0">
                          {String(business?.name || 'B')[0]}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${selectedLead?.id === lead.id ? 'text-violet-400' : 'text-[#f4f4f5]'}`}>{business?.name as string || 'Unknown'}</p>
                          <p className="text-xs text-[#6c6c74] truncate">{business?.industry as string || ''} • {lead.overallScore as number || 0} score</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedLead && (
            <div className="glass-panel rounded-xl p-5 mt-4">
              <h3 className="text-sm font-semibold text-[#f4f4f5] mb-3">Selected Lead</h3>
              {(() => {
                const business = selectedLead.business as Record<string, unknown> | undefined;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-[#8c8c96]"><Building2 className="w-4 h-4 text-violet-400" />{business?.name as string || 'Unknown'}</div>
                    <div className="flex items-center gap-2 text-[#8c8c96]"><Mail className="w-4 h-4 text-violet-400" />{business?.email as string || 'No email'}</div>
                  </div>
                );
              })()}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <div className="space-y-4">
            {outreachTypes.map((type, i) => (
              <motion.div key={type.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="glass-panel rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <type.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#f4f4f5]">{type.label}</h4>
                      <p className="text-xs text-[#6c6c74]">{type.description}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleGenerate(type.id)} disabled={generatingType === type.id || !selectedLead}
                    className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2">
                    {generatingType === type.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate
                  </Button>
                </div>
                {generated[type.id] && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-[#0a0a0c] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#6c6c74]">Generated</span>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generated[type.id].content, type.label)} className="h-7 text-violet-400">
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                    <div className="text-sm text-[#f4f4f5] whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                      {generated[type.id].content}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
