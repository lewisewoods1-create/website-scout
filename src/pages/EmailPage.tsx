import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Mail,
  Copy,
  Sparkles,
  Eye,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/providers/trpc';
import { useToast } from '@/hooks/useToast';

export default function EmailPage() {
  const { addToast } = useToast();

  const leadsQuery = trpc.lead.list.useQuery({});
  const allLeads = (leadsQuery.data?.items || []) as Array<Record<string, unknown>>;

  const [selectedLead, setSelectedLead] = useState<Record<string, unknown> | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const generateOutreach = trpc.outreach.generate.useMutation({
    onSuccess: (data) => {
      setSubject(data.subject || '');
      setBody(data.body || data.content);
      addToast('AI email generated!', 'success');
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const handleGenerate = () => {
    if (!selectedLead) { addToast('Select a lead first', 'warning'); return; }
    generateOutreach.mutate({
      leadId: selectedLead.id as number,
      type: 'cold_email',
      kimiApiKey: 'placeholder', // Will be read from settings on backend
    });
  };

  const handleSend = async () => {
    if (!selectedLead || !subject.trim() || !body.trim()) { addToast('Fill in subject and body', 'warning'); return; }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    addToast(`Email ready for ${(selectedLead.business as Record<string, unknown>)?.name || 'recipient'}! Copy and send via your email client.`, 'success');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied!', 'success');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">Email Center</h1>
        <p className="text-[#8c8c96]">Compose and send personalised emails to your leads</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-4">Select Recipient</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
              {allLeads.map((lead) => {
                const business = lead.business as Record<string, unknown> | undefined;
                return (
                  <button key={String(lead.id)} onClick={() => { setSelectedLead(lead); setSubject(''); setBody(''); }}
                    className={`w-full text-left p-3 rounded-lg transition-all ${selectedLead?.id === lead.id ? 'bg-violet-500/10 border border-violet-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs text-white font-medium shrink-0">
                        {String(business?.name || 'B')[0]}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${selectedLead?.id === lead.id ? 'text-violet-400' : 'text-[#f4f4f5]'}`}>{business?.name as string || 'Unknown'}</p>
                        <p className="text-xs text-[#6c6c74] truncate">{business?.email as string || 'No email'}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <div className="glass-panel rounded-xl p-6">
            {selectedLead ? (
              <>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-sm text-white font-medium">
                      {String((selectedLead.business as Record<string, unknown>)?.name || 'B')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#f4f4f5]">{(selectedLead.business as Record<string, unknown>)?.name as string || 'Unknown'}</p>
                      <p className="text-xs text-[#6c6c74]">{(selectedLead.business as Record<string, unknown>)?.email as string || ''}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generateOutreach.isPending}
                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 gap-2">
                    <Sparkles className="w-4 h-4" /> AI Generate
                  </Button>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Subject</label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter subject..."
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5]" />
                </div>

                <div className="mb-4">
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Message</label>
                  {previewMode ? (
                    <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 min-h-[300px] text-sm text-[#f4f4f5] whitespace-pre-line">{body}</div>
                  ) : (
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your email..."
                      className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] min-h-[300px] resize-none" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}
                      className="border-[#2a2a2e] text-[#8c8c96]"><Eye className="w-4 h-4 mr-1" />{previewMode ? 'Edit' : 'Preview'}</Button>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(`Subject: ${subject}\n\n${body}`)}
                      className="border-[#2a2a2e] text-[#8c8c96]"><Copy className="w-4 h-4 mr-1" /> Copy</Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setSubject(''); setBody(''); }} className="text-[#6c6c74]">
                      <Trash2 className="w-4 h-4 mr-1" /> Clear
                    </Button>
                    <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}
                      className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2">
                      {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      Send
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <Mail className="w-12 h-12 text-[#2a2a2e] mx-auto mb-4" />
                <p className="text-[#6c6c74]">Select a recipient to compose an email</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
