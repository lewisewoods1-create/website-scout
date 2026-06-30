import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Copy,
  Sparkles,
  Send,
  Loader2,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockLeads } from '@/data/mockData';
import { useToast } from '@/hooks/useToast';

export default function OutreachPage() {
  const { addToast } = useToast();
  const [selectedLead, setSelectedLead] = useState(mockLeads[0]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Record<string, string>>({});

  const generateContent = async (type: string) => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    
    const content: Record<string, string> = {
      coldEmail: generateColdEmail(selectedLead),
      linkedin: generateLinkedInMessage(selectedLead),
      facebook: generateFacebookMessage(selectedLead),
      phoneScript: generatePhoneScript(selectedLead),
      followup1: generateFollowUp(selectedLead, 1),
      followup2: generateFollowUp(selectedLead, 2),
      proposal: generateProposal(selectedLead),
    };
    
    setGenerated({ ...generated, [type]: content[type] });
    setGenerating(false);
    addToast(`${type} generated!`, 'success');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied to clipboard!`, 'success');
  };

  const outreachTypes = [
    { id: 'coldEmail', label: 'Cold Email', icon: Mail, description: 'Personalised outreach email' },
    { id: 'linkedin', label: 'LinkedIn Message', icon: MessageSquare, description: 'Professional LinkedIn DM' },
    { id: 'facebook', label: 'Facebook Message', icon: MessageSquare, description: 'Casual Facebook outreach' },
    { id: 'phoneScript', label: 'Phone Script', icon: Phone, description: 'Complete call script' },
    { id: 'followup1', label: 'Follow-up #1', icon: Send, description: 'First follow-up email' },
    { id: 'followup2', label: 'Follow-up #2', icon: Send, description: 'Second follow-up email' },
    { id: 'proposal', label: 'Proposal', icon: FileText, description: 'Website proposal draft' },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">AI Outreach Assistant</h1>
        <p className="text-[#8c8c96]">Generate personalised outreach content powered by AI</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Selector */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-4">Select Lead</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-1">
              {mockLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedLead.id === lead.id
                      ? 'bg-violet-500/10 border border-violet-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs text-white font-medium shrink-0">
                      {lead.business.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedLead.id === lead.id ? 'text-violet-400' : 'text-[#f4f4f5]'}`}>
                        {lead.business.name}
                      </p>
                      <p className="text-xs text-[#6c6c74] truncate">{lead.business.industry} • {lead.score.overall} score</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Lead Info */}
          <div className="glass-panel rounded-xl p-5 mt-4">
            <h3 className="text-sm font-semibold text-[#f4f4f5] mb-3">Selected Lead</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#8c8c96]">
                <Building2 className="w-4 h-4 text-violet-400" />
                {selectedLead.business.name}
              </div>
              <div className="flex items-center gap-2 text-[#8c8c96]">
                <MessageSquare className="w-4 h-4 text-violet-400" />
                {selectedLead.business.owner}
              </div>
              <div className="flex items-center gap-2 text-[#8c8c96]">
                <Mail className="w-4 h-4 text-violet-400" />
                {selectedLead.business.email}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Generator */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <div className="space-y-4">
            {outreachTypes.map((type, i) => (
              <motion.div
                key={type.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="glass-panel rounded-xl p-5"
              >
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
                  <Button
                    size="sm"
                    onClick={() => generateContent(type.id)}
                    disabled={generating}
                    className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2"
                  >
                    {generating && !generated[type.id] ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Generate
                  </Button>
                </div>

                {generated[type.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-[#0a0a0c] rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#6c6c74]">Generated Content</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(generated[type.id]!, type.label)}
                        className="h-7 text-violet-400 hover:text-violet-300"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="text-sm text-[#f4f4f5] whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                      {generated[type.id]}
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

function generateColdEmail(lead: typeof mockLeads[0]): string {
  return `Subject: Your ${lead.business.name} deserves a stunning website

Hi ${lead.business.owner.split(' ')[0]},

I came across ${lead.business.name} and was impressed by your ${lead.business.googleRating}-star rating and ${lead.business.reviewCount} reviews. You clearly deliver exceptional service to your customers!

${!lead.business.hasWebsite 
  ? `I noticed you don't currently have a website. In today's digital-first world, 76% of consumers search online before choosing a ${lead.business.industry.toLowerCase()}. You're potentially missing out on dozens of new customers every month.`
  : `I reviewed your current website and identified several key opportunities to improve your online presence, attract more local customers, and increase your conversion rate by an estimated 40-60%.`
}

I'd love to build you a modern, professional website that truly reflects the quality of your business. Here's what I'd recommend:

• Mobile-responsive design (60%+ of searches are on mobile)
• SEO optimisation for "${lead.business.industry.toLowerCase()} in ${lead.business.location.city}"
• Online booking/contact system
• Customer testimonials and portfolio showcase
• Fast loading speeds and professional design

A project like this typically starts at £1,500-£3,000 depending on features, with a turnaround of 2-3 weeks.

Would you be open to a quick 10-minute call this week to discuss your needs?

Best regards,
[Your Name]
[Your Phone]
[Your Website]`;
}

function generateLinkedInMessage(lead: typeof mockLeads[0]): string {
  return `Hi ${lead.business.owner.split(' ')[0]},

I came across ${lead.business.name} and was really impressed by what you've built. Your ${lead.business.googleRating}-star reputation speaks volumes about your commitment to quality.

I'm a web designer who specialises in helping ${lead.business.industry.toLowerCase()} businesses like yours attract more customers online. ${!lead.business.hasWebsite ? "I'd love to help you establish a strong web presence." : "I'd love to help you take your online presence to the next level."}

Would you be open to a quick chat about your digital goals?

Best,
[Your Name]`;
}

function generateFacebookMessage(lead: typeof mockLeads[0]): string {
  return `Hi ${lead.business.owner.split(' ')[0]}! 

Love what you're doing at ${lead.business.name}! Your reviews are amazing.

I'm a local web designer and I'd love to help you reach more customers with a beautiful new website. No obligation - just thought I'd reach out! 

Would you be interested in a free consultation? 🙂`;
}

function generatePhoneScript(lead: typeof mockLeads[0]): string {
  return `PHONE SCRIPT - ${lead.business.name}

INTRODUCTION:
"Hi, is this ${lead.business.owner.split(' ')[0]}?"

"Hi ${lead.business.owner.split(' ')[0]}, my name is [Your Name] from [Company]. How are you today?"

[Wait for response, build rapport]

PITCH:
"The reason I'm calling is I came across ${lead.business.name} online and I was really impressed by your reviews - ${lead.business.googleRating} stars is fantastic. 

I'm a web designer who helps ${lead.business.industry.toLowerCase()} businesses get more customers through better websites. ${!lead.business.hasWebsite ? "I noticed you don't have a website yet, and I think you're missing out on a lot of potential business." : "I think with a few improvements to your current site, you could be getting a lot more enquiries."}

I'd love to show you what I could do - would you have 10 minutes this week for a quick chat? I can come to you or we can do a video call, whatever works best."

OBJECTION HANDLING:
- "I don't have time" → "I totally understand, you're busy. This would just be a quick 10-minute chat. Would Tuesday or Thursday work better?"
- "I already have a website" → "That's great! When I took a quick look, I noticed a few things that could really improve your results. Happy to share those with you."
- "How much does it cost?" → "It really depends on what you need, but most of my ${lead.business.industry.toLowerCase()} clients invest between £1,500 and £4,000. I'd rather understand your needs first before giving you a proper quote."

CLOSE:
"Shall we pencil in Tuesday at 2pm or Thursday at 10am?"

[Get commitment, confirm details, send follow-up email within 1 hour]`;
}

function generateFollowUp(lead: typeof mockLeads[0], num: number): string {
  const subjects = [
    `Quick follow-up, ${lead.business.owner.split(' ')[0]}`,
    `Re: ${lead.business.name} website`,
  ];
  const bodies = [
    `Hi ${lead.business.owner.split(' ')[0]},

Just following up on my message from last week. I know you're busy running ${lead.business.name}, so I'll keep this brief.

I genuinely believe I can help you attract more customers with a better web presence. No pressure at all - just wanted to make sure my message didn't get lost in your inbox.

Would a quick 10-minute call work for you this week?

Best,
[Your Name]`,
    `Hi ${lead.business.owner.split(' ')[0]},

I wanted to reach out one more time about helping ${lead.business.name} with your website.

I've helped several ${lead.business.industry.toLowerCase()} businesses in ${lead.business.location.city} increase their enquiries by 40-70% with a modern website and proper SEO.

If now isn't the right time, I completely understand. Just thought I'd check in one last time.

Best wishes,
[Your Name]`,
  ];
  return `Subject: ${subjects[num - 1] || subjects[0]}

${bodies[num - 1] || bodies[0]}`;
}

function generateProposal(lead: typeof mockLeads[0]): string {
  return `WEBSITE PROPOSAL FOR ${lead.business.name.toUpperCase()}

PREPARED FOR: ${lead.business.owner}
DATE: ${new Date().toLocaleDateString()}
VALID FOR: 30 days

EXECUTIVE SUMMARY:
This proposal outlines a modern, professional website solution for ${lead.business.name} designed to attract more local customers, showcase your services, and generate enquiries.

CURRENT SITUATION:
${!lead.business.hasWebsite 
  ? `${lead.business.name} currently has no website presence. With ${lead.business.reviewCount} reviews and a ${lead.business.googleRating}-star rating, you're clearly providing excellent service - but potential customers searching online can't find you.`
  : `${lead.business.name} has an existing website that would benefit from modernisation to better reflect your ${lead.business.googleRating}-star quality and attract more enquiries.`
}

RECOMMENDED SOLUTION:
• Custom-designed website (5-7 pages)
• Mobile-responsive design
• SEO optimisation for ${lead.business.industry.toLowerCase()} in ${lead.business.location.city}
• Contact form with email notifications
• Photo gallery/portfolio section
• Customer testimonials integration
• Google Maps integration
• Social media links
• Blog section for content marketing
• SSL certificate and security
• 12 months hosting included

INVESTMENT:
Website Design & Development: £2,400
12 Months Hosting & Support: £240
Total: £2,640 (or £220/month for 12 months)

TIMELINE:
Design: 1 week
Development: 2 weeks
Revisions & Launch: 1 week
Total: 4 weeks from approval

NEXT STEPS:
To proceed, simply reply to this email or call me on [Your Phone]. I'll send over the contract and we can get started right away.

[Your Name]
[Your Company]
[Your Phone]
[Your Email]
[Your Website]`;
}
