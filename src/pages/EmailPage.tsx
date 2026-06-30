import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Mail,
  Copy,
  Sparkles,
  Eye,
  Trash2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { mockLeads, mockEmailDrafts } from '@/data/mockData';
import { useToast } from '@/hooks/useToast';

export default function EmailPage() {
  const { addToast } = useToast();
  const [selectedLead, setSelectedLead] = useState<typeof mockLeads[0] | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const generateEmail = () => {
    if (!selectedLead) {
      addToast('Please select a lead first', 'warning');
      return;
    }
    
    const newSubject = `Your ${selectedLead.business.name} deserves a stunning website`;
    const newBody = `Hi ${selectedLead.business.owner.split(' ')[0]},\n\nI came across ${selectedLead.business.name} and was impressed by your ${selectedLead.business.googleRating}-star rating and ${selectedLead.business.reviewCount} reviews. You clearly deliver exceptional service!\n\n${!selectedLead.business.hasWebsite 
      ? "I noticed you don't currently have a website. In today's digital world, 76% of people search online before visiting a business. You're missing out on potential clients every day."
      : "I reviewed your current website and identified several opportunities to improve your online presence and attract more customers."
    }\n\nI'd love to build you a beautiful, modern website that showcases your work and brings in more bookings. A professional site starts at just £1,500.\n\nWould you be open to a quick 10-minute chat this week?\n\nBest regards,\n[Your Name]`;
    
    setSubject(newSubject);
    setBody(newBody);
    addToast('AI-generated email created!', 'success');
  };

  const handleSendEmail = async () => {
    if (!selectedLead) {
      addToast('Please select a lead', 'warning');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      addToast('Please enter a subject and body', 'warning');
      return;
    }

    setSending(true);
    await new Promise((r) => setTimeout(r, 2000));
    setSending(false);
    
    addToast(`Email sent to ${selectedLead.business.email}!`, 'success');
    setSubject('');
    setBody('');
    setSelectedLead(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard!', 'success');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">Email Center</h1>
        <p className="text-[#8c8c96]">Compose and send personalised emails to your leads</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Selector */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-4">Select Recipient</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
              {mockLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => {
                    setSelectedLead(lead);
                    setSubject('');
                    setBody('');
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedLead?.id === lead.id
                      ? 'bg-violet-500/10 border border-violet-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs text-white font-medium shrink-0">
                      {lead.business.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedLead?.id === lead.id ? 'text-violet-400' : 'text-[#f4f4f5]'}`}>
                        {lead.business.name}
                      </p>
                      <p className="text-xs text-[#6c6c74] truncate">{lead.business.email}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drafts */}
          <div className="glass-panel rounded-xl p-5 mt-4">
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-4">Recent Drafts</h3>
            <div className="space-y-2">
              {mockEmailDrafts.map((draft) => (
                <div key={draft.id} className="p-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] hover:border-violet-500/30 transition-all cursor-pointer">
                  <p className="text-sm text-[#f4f4f5] truncate">{draft.subject}</p>
                  <p className="text-xs text-[#6c6c74]">{new Date(draft.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Email Composer */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <div className="glass-panel rounded-xl p-6">
            {selectedLead ? (
              <>
                {/* Recipient Bar */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a2e]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-sm text-white font-medium">
                      {selectedLead.business.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#f4f4f5]">{selectedLead.business.name}</p>
                      <p className="text-xs text-[#6c6c74]">{selectedLead.business.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateEmail}
                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Generate
                  </Button>
                </div>

                {/* Subject */}
                <div className="mb-4">
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Subject</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>

                {/* Body */}
                <div className="mb-4">
                  <label className="text-xs text-[#6c6c74] mb-1.5 block">Message</label>
                  {previewMode ? (
                    <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 min-h-[300px] text-sm text-[#f4f4f5] whitespace-pre-line leading-relaxed">
                      {body || 'No content yet. Click AI Generate or type your message.'}
                    </div>
                  ) : (
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Write your email or click AI Generate..."
                      className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50 min-h-[300px] resize-none"
                    />
                  )}
                </div>

                {/* Attachments/Analysis toggle */}
                {body && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-4 p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-medium text-[#f4f4f5]">Include Analysis Report</span>
                      <Badge variant="outline" className="bg-violet-500/10 border-violet-500/20 text-violet-400 text-xs">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-xs text-[#6c6c74]">
                      Attach the AI website analysis and opportunity score to increase response rates by up to 40%.
                    </p>
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMode(!previewMode)}
                      className="border-[#2a2a2e] text-[#8c8c96] hover:text-[#f4f4f5]"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {previewMode ? 'Edit' : 'Preview'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`Subject: ${subject}\n\n${body}`)}
                      className="border-[#2a2a2e] text-[#8c8c96] hover:text-[#f4f4f5]"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSubject(''); setBody(''); }}
                      className="text-[#6c6c74] hover:text-[#f4f4f5]"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={sending || !subject.trim() || !body.trim()}
                      className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-2"
                    >
                      {sending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <Mail className="w-12 h-12 text-[#2a2a2e] mx-auto mb-4" />
                <p className="text-[#6c6c74] text-lg mb-2">Select a recipient to compose an email</p>
                <p className="text-sm text-[#6c6c74]">Choose a lead from the list on the left</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
