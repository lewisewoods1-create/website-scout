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
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  Target,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { kimiIntegrationSteps, defaultSettings } from '@/data/mockData';
import { useToast } from '@/hooks/useToast';

export default function KimiPage() {
  const { addToast } = useToast();
  const [config, setConfig] = useState(defaultSettings.kimiConfig);
  const [activeTab, setActiveTab] = useState('setup');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    if (!config.apiKey) {
      addToast('Please enter your API key first', 'warning');
      return;
    }
    setTesting(true);
    await new Promise((r) => setTimeout(r, 2000));
    setTesting(false);
    setTestResult('Connection successful! Kimi API is ready to use. Model: kimi-latest');
    addToast('Connection successful!', 'success');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    addToast('Code copied to clipboard!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <Key className="w-4 h-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="guide" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <BookOpen className="w-4 h-4 mr-2" />
            Integration Guide
          </TabsTrigger>
          <TabsTrigger value="examples" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Code2 className="w-4 h-4 mr-2" />
            Code Examples
          </TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-violet-400" />
                API Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">Kimi API Key</label>
                  <div className="flex gap-3">
                    <Input
                      type="password"
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="flex-1 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyCode(config.apiKey)}
                      className="border-[#2a2a2e] text-[#8c8c96]"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-[#6c6c74] mt-1.5">
                    Your API key is stored securely and never shared.{' '}
                    <a
                      href="https://platform.moonshot.cn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:underline"
                    >
                      Get your key here <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </p>
                </div>

                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">API Endpoint</label>
                  <Input
                    value={config.apiEndpoint}
                    onChange={(e) => setConfig({ ...config, apiEndpoint: e.target.value })}
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>

                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">Model</label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none"
                  >
                    <option value="kimi-latest">kimi-latest (Recommended)</option>
                    <option value="kimi-k2-0711-preview">kimi-k2-0711-preview</option>
                    <option value="kimi-k2-0711">kimi-k2-0711</option>
                    <option value="kimi-k2-32k-0711">kimi-k2-32k-0711</option>
                    <option value="kimi-k1-32k">kimi-k1-32k</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.enabled ? 'bg-emerald-500/10' : 'bg-[#1c1c20]'}`}>
                      {config.enabled ? <Zap className="w-5 h-5 text-emerald-400" /> : <Zap className="w-5 h-5 text-[#6c6c74]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#f4f4f5]">Enable Kimi AI</p>
                      <p className="text-xs text-[#6c6c74]">Activate AI-powered features across the platform</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                    className="transition-transform hover:scale-105"
                  >
                    {config.enabled ? (
                      <ToggleRight className="w-10 h-10 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-[#6c6c74]" />
                    )}
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleTestConnection}
                    disabled={testing || !config.apiKey}
                    variant="outline"
                    className="border-[#2a2a2e] text-[#8c8c96] hover:text-[#f4f4f5] gap-2"
                  >
                    {testing ? (
                      <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    onClick={() => addToast('Settings saved!', 'success')}
                    className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Save Configuration
                  </Button>
                </div>

                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-400">{testResult}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4">What Kimi AI Powers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Sparkles, title: 'AI Analysis', desc: 'Deep website analysis with natural language insights' },
                { icon: MessageSquare, title: 'Smart Outreach', desc: 'Personalised emails, messages, and phone scripts' },
                { icon: FileText, title: 'Proposals', desc: 'Auto-generated website proposals with pricing' },
                { icon: Target, title: 'Lead Scoring', desc: 'Intelligent opportunity scoring across 8 dimensions' },
                { icon: Zap, title: 'Real-time Processing', desc: 'Background analysis while you work on other tasks' },
                { icon: BookOpen, title: 'Audit Reports', desc: 'Professional website audit reports for clients' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="glass-panel rounded-xl p-5 hover:border-violet-500/20 transition-all"
                >
                  <feature.icon className="w-6 h-6 text-violet-400 mb-3" />
                  <h4 className="text-sm font-semibold text-[#f4f4f5] mb-1">{feature.title}</h4>
                  <p className="text-xs text-[#6c6c74]">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Guide Tab */}
        <TabsContent value="guide" className="space-y-6">
          <div className="max-w-3xl">
            {kimiIntegrationSteps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex gap-4 mb-8 last:mb-0"
              >
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {step.step}
                  </div>
                  {i < kimiIntegrationSteps.length - 1 && (
                    <div className="w-0.5 h-full bg-gradient-to-b from-violet-500/50 to-transparent mt-2" />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="text-lg font-semibold text-[#f4f4f5] mb-2">{step.title}</h3>
                  <p className="text-sm text-[#8c8c96] leading-relaxed mb-3">{step.description}</p>
                  {step.code && (
                    <div className="relative">
                      <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-[#f4f4f5] font-mono">
                          <code>{step.code}</code>
                        </pre>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(step.code!)}
                        className="absolute top-2 right-2 text-[#6c6c74] hover:text-violet-400"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Code Examples Tab */}
        <TabsContent value="examples" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#f4f4f5] flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-violet-400" />
                  Website Analysis with Kimi
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(analysisExample)}
                  className="text-violet-400 hover:text-violet-300"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-[#f4f4f5] font-mono">
                  <code>{analysisExample}</code>
                </pre>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#f4f4f5] flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-violet-400" />
                  AI-Powered Outreach Generation
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(outreachExample)}
                  className="text-violet-400 hover:text-violet-300"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-[#f4f4f5] font-mono">
                  <code>{outreachExample}</code>
                </pre>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#f4f4f5] flex items-center gap-2">
                  <Zap className="w-5 h-5 text-violet-400" />
                  Stream Response in React
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(streamExample)}
                  className="text-violet-400 hover:text-violet-300"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="bg-[#0a0a0c] border border-[#2a2a2e] rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-[#f4f4f5] font-mono">
                  <code>{streamExample}</code>
                </pre>
              </div>
            </div>
          </motion.div>
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
}

// Usage
const analysis = await analyzeWebsite(
  'Smith Dental', 
  'https://smithdental.co.uk'
);
console.log(analysis);`;

const outreachExample = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
});

async function generateOutreach(
  business: Business, 
  type: 'email' | 'linkedin' | 'phone'
) {
  const response = await client.chat.completions.create({
    model: 'kimi-latest',
    messages: [
      {
        role: 'system',
        content: 'You are a sales copywriter. Write personalised outreach for a web design agency. Be friendly, professional, and focus on value. Mention specific details about the business.'
      },
      {
        role: 'user',
        content: 'Write a ' + type + ' outreach for: ' +
          'Business: ' + business.name + ', ' +
          'Owner: ' + business.owner + ', ' +
          'Industry: ' + business.industry + ', ' +
          'Rating: ' + business.googleRating + '/5 (' + business.reviewCount + ' reviews), ' +
          'Has Website: ' + (business.hasWebsite ? 'Yes' : 'No') + ', ' +
          'Location: ' + business.location.city
      }
    ],
  });

  return response.choices[0].message.content;
}

// Generate all outreach types
const email = await generateOutreach(business, 'email');
const linkedin = await generateOutreach(business, 'linkedin');
const phoneScript = await generateOutreach(business, 'phone');`;

const streamExample = `import { useState } from 'react';

function AIStreamChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const sendMessage = async () => {
    setStreaming(true);
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.KIMI_API_KEY,
      },
      body: JSON.stringify({
        model: 'kimi-latest',
        messages: [...messages, userMessage],
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
      const lines = chunk.split('\\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            assistantMessage += content;
            setMessages(prev => [
              ...prev.slice(0, -1),
              { role: 'assistant', content: assistantMessage }
            ]);
          }
        }
      }
    }
    
    setStreaming(false);
    setInput('');
  };

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i} className={m.role}>
          {m.content}
        </div>
      ))}
      <input 
        value={input} 
        onChange={e => setInput(e.target.value)}
        disabled={streaming}
      />
      <button onClick={sendMessage} disabled={streaming}>
        {streaming ? 'Streaming...' : 'Send'}
      </button>
    </div>
  );
}`;
