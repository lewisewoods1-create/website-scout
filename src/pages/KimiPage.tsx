import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Key,
  BookOpen,
  Code2,
  CheckCircle,
  Copy,
  ExternalLink,
  Terminal,
  Zap,
  Shield,
  Loader2,
  MessageSquare,
  Target,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/providers/trpc';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { kimiIntegrationSteps } from '@/data/mockData';

export default function KimiPage() {
  const { addToast } = useToast();
  const { kimiApiKey } = useSettings();
  const [activeTab, setActiveTab] = useState('setup');

  const testKimi = trpc.settings.testKimi.useMutation({
    onSuccess: (data) => {
      if (data.ok) addToast(`Kimi connected! Model: ${data.model}`, 'success');
      else addToast(`Connection failed: ${data.error}`, 'error');
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    addToast('Code copied!', 'success');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#f4f4f5]">Kimi AI Integration</h1>
            <p className="text-[#8c8c96]">Connect Kimi AI to power your outreach and analysis</p>
          </div>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#131316] border border-[#2a2a2e] p-1">
          <TabsTrigger value="setup" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Key className="w-4 h-4 mr-2" /> Setup
          </TabsTrigger>
          <TabsTrigger value="guide" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <BookOpen className="w-4 h-4 mr-2" /> Integration Guide
          </TabsTrigger>
          <TabsTrigger value="examples" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Code2 className="w-4 h-4 mr-2" /> Code Examples
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-violet-400" /> Quick Setup
              </h3>
              <ol className="space-y-4 text-sm text-[#8c8c96]">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <span>Go to <a href="https://platform.moonshot.cn" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">platform.moonshot.cn <ExternalLink className="w-3 h-3 inline" /></a> and sign up</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Navigate to API Keys and create a new key</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Paste your key in <strong className="text-[#f4f4f5]">Settings {'>'} API Keys</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                  <span>Test the connection below</span>
                </li>
              </ol>

              {kimiApiKey && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-emerald-400">API key configured!</span>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <Button onClick={() => testKimi.mutate({ apiKey: kimiApiKey || '' })} disabled={!kimiApiKey || testKimi.isPending}
                  variant="outline" className="border-[#2a2a2e] text-[#8c8c96] gap-2">
                  {testKimi.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Test Connection
                </Button>
                <Button onClick={() => window.location.href = '/settings'} className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2">
                  <Key className="w-4 h-4" /> Go to Settings
                </Button>
              </div>

              {testKimi.data && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${testKimi.data.ok ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {testKimi.data.ok ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Shield className="w-5 h-5 text-red-400" />}
                  <p className={`text-sm ${testKimi.data.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testKimi.data.ok ? `Connected! Model: ${testKimi.data.model}` : `Failed: ${testKimi.data.error}`}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">What Kimi AI Powers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Sparkles, title: 'AI Analysis', desc: 'Deep website analysis with 8-dimension scoring' },
                { icon: MessageSquare, title: 'Smart Outreach', desc: 'Personalised emails, LinkedIn, phone scripts' },
                { icon: FileText, title: 'Proposals', desc: 'Auto-generated website proposals with pricing' },
                { icon: Target, title: 'Lead Scoring', desc: 'Intelligent opportunity scoring' },
                { icon: Zap, title: 'Real-time Processing', desc: 'Background analysis while you work' },
                { icon: BookOpen, title: 'Audit Reports', desc: 'Professional website audit reports' },
              ].map((feature, i) => (
                <motion.div key={feature.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  className="glass-panel rounded-xl p-5 hover:border-violet-500/20 transition-all">
                  <feature.icon className="w-6 h-6 text-violet-400 mb-3" />
                  <h4 className="text-sm font-semibold text-[#f4f4f5] mb-1">{feature.title}</h4>
                  <p className="text-xs text-[#6c6c74]">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="guide" className="space-y-6">
          <div className="max-w-3xl">
            {kimiIntegrationSteps.map((step, i) => (
              <motion.div key={step.step} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                className="flex gap-4 mb-8 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {step.step}
                  </div>
                  {i < kimiIntegrationSteps.length - 1 && <div className="w-0.5 h-full bg-gradient-to-b from-violet-500/50 to-transparent mt-2" />}
                </div>
                <div className="pb-8">
                  <h3 className="text-lg font-semibold text-[#f4f4f5] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#8c8c96] leading-relaxed mb-3">{step.description}</p>
                  {step.code && (
                    <div className="relative">
                      <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-[#f4f4f5] font-mono"><code>{step.code}</code></pre>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyCode(step.code!)} className="absolute top-2 right-2 text-[#6c6c74] hover:text-violet-400">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="space-y-6">
          {[
            { icon: Terminal, title: 'Website Analysis with Kimi', code: analysisExample },
            { icon: Code2, title: 'AI-Powered Outreach Generation', code: outreachExample },
            { icon: Zap, title: 'Stream Response in React', code: streamExample },
          ].map((example, idx) => (
            <motion.div key={example.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * idx }}>
              <div className="glass-panel rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#f4f4f5] flex items-center gap-2">
                    <example.icon className="w-5 h-5 text-violet-400" /> {example.title}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => copyCode(example.code)} className="text-violet-400">
                    <Copy className="w-4 h-4 mr-1" /> Copy
                  </Button>
                </div>
                <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-[#f4f4f5] font-mono"><code>{example.code}</code></pre>
                </div>
              </div>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const analysisExample = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

async function analyzeWebsite(businessName: string, websiteUrl: string) {
  const response = await client.chat.completions.create({
    model: 'kimi-latest',
    messages: [
      {
        role: 'system',
        content: 'You are an expert web analyst. Analyze the website and provide scores (0-100) for: design, seo, performance, accessibility, mobile responsiveness, content quality, conversion optimisation, and branding. Return as JSON.'
      },
      {
        role: 'user',
        content: 'Analyze ' + websiteUrl + ' for ' + businessName
      }
    ],
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0].message.content);
}`;

const outreachExample = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

async function generateOutreach(business: Business, type: 'email' | 'linkedin') {
  const response = await client.chat.completions.create({
    model: 'kimi-latest',
    messages: [
      {
        role: 'system',
        content: 'You are a sales copywriter. Write personalised outreach for a web design agency.'
      },
      {
        role: 'user',
        content: 'Write a ' + type + ' for: ' + business.name + ', ' + business.industry + ' in ' + business.city
      }
    ],
  });

  return response.choices[0].message.content;
}`;

const streamExample = `import { useState } from 'react';

function AIStreamChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kimi-latest',
        messages: [...messages, { role: 'user', content: input }],
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      // Parse SSE data and update UI
      for (const line of chunk.split('\\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev => [...prev.slice(0, -1),
                { role: 'assistant', content: assistantMessage }
              ]);
            }
          } catch {}
        }
      }
    }
  };

  return <div>{/* Your chat UI */}</div>;
}`;
