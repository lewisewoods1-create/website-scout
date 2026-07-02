import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Shield,
  Palette,
  Key,
  Save,
  CheckCircle,
  Moon,
  Sun,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { useEffect } from 'react';

export default function SettingsPage() {
  const { addToast } = useToast();
  const { settings, upsert, testKimi: testKimiApi } = useSettings();

  const [name, setName] = useState('Alex Johnson');
  const [company, setCompany] = useState('WebDev Pro');
  const [kimiKey, setKimiKey] = useState('');
  const [kimiModel, setKimiModel] = useState('kimi-latest');
  const [googleKey, setGoogleKey] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [saving, setSaving] = useState(false);
  const [testingKimi, setTestingKimi] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; model?: string; error?: string } | null>(null);

  // Sync form fields when settings load from server
  useEffect(() => {
    if (settings) {
      setName(settings.name || 'Alex Johnson');
      setCompany(settings.company || 'WebDev Pro');
      setKimiKey(settings.kimiApiKey || '');
      setKimiModel(settings.kimiModel || 'kimi-latest');
      setGoogleKey(settings.googlePlacesApiKey || '');
      setNotifications(settings.notifications || false);
      setDailyDigest(settings.dailyDigest || false);
    }
  }, [settings]);

  const handleTestKimi = async () => {
    if (!kimiKey) return;
    setTestingKimi(true);
    setTestResult(null);
    try {
      const result = await testKimiApi(kimiKey);
      setTestResult(result);
      if (result.ok) addToast(`Kimi connected! Model: ${result.model}`, 'success');
      else addToast(`Connection failed: ${result.error}`, 'error');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Test failed', 'error');
    } finally {
      setTestingKimi(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert({
        name,
        company,
        notifications,
        dailyDigest,
        kimiApiKey: kimiKey || undefined,
        googlePlacesApiKey: googleKey || undefined,
        kimiModel,
      });
      addToast('Settings saved!', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">Settings</h1>
        <p className="text-[#8c8c96]">Manage your account, API keys, and preferences</p>
      </motion.div>

      <Tabs defaultValue="api" className="space-y-6">
        <TabsList className="bg-[#131316] border border-[#2a2a2e] p-1">
          <TabsTrigger value="api" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Key className="w-4 h-4 mr-2" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <User className="w-4 h-4 mr-2" /> Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Bell className="w-4 h-4 mr-2" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Palette className="w-4 h-4 mr-2" /> Appearance
          </TabsTrigger>
        </TabsList>

        {/* API Keys */}
        <TabsContent value="api" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              AI Services
            </h3>

            <div className="space-y-5">
              {/* Kimi API Key */}
              <div>
                <label className="text-sm text-[#8c8c96] mb-1.5 block flex items-center gap-2">
                  Kimi API Key
                  {settings?.kimiApiKey && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </label>
                <div className="flex gap-3">
                  <Input type="password" value={kimiKey} onChange={(e) => setKimiKey(e.target.value)}
                    placeholder="sk-..." className="flex-1 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5]" />
                </div>
                <p className="text-xs text-[#6c6c74] mt-1">
                  <a href="https://platform.moonshot.cn" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
                    Get your key at platform.moonshot.cn
                  </a>
                </p>
              </div>

              {/* Kimi Model */}
              <div>
                <label className="text-sm text-[#8c8c96] mb-1.5 block">Model</label>
                <select value={kimiModel} onChange={(e) => setKimiModel(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e] text-[#f4f4f5] text-sm focus:border-violet-500/50 focus:outline-none">
                  <option value="kimi-latest">kimi-latest (Recommended)</option>
                  <option value="kimi-k2-0711-preview">kimi-k2-0711-preview</option>
                  <option value="kimi-k1-32k">kimi-k1-32k</option>
                </select>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleTestKimi}
                  disabled={!kimiKey || testingKimi}
                  className="border-[#2a2a2e] text-[#8c8c96] gap-2">
                  {testingKimi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Test Connection
                </Button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg ${testResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'} text-sm`}>
                  {testResult.ok ? `Connected! Model: ${testResult.model}` : `Failed: ${testResult.error}`}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-violet-400" />
              Google Places API
            </h3>
            <div>
              <label className="text-sm text-[#8c8c96] mb-1.5 block flex items-center gap-2">
                API Key
                {settings?.googlePlacesApiKey && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </label>
              <div className="flex gap-3">
                <Input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)}
                  placeholder="AIza..." className="flex-1 bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5]" />
              </div>
              <p className="text-xs text-[#6c6c74] mt-1">
                <a href="https://developers.google.com/maps/documentation/places/web-service/get-api-key" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">
                  Get your key from Google Cloud Console
                </a>
              </p>
            </div>
          </motion.div>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Profile Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#8c8c96] mb-1.5 block">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5]" />
              </div>
              <div>
                <label className="text-sm text-[#8c8c96] mb-1.5 block">Company</label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5]" />
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { label: 'Push Notifications', desc: 'Browser notifications for new leads', value: notifications, setter: setNotifications },
                { label: 'Daily Digest', desc: 'Summary of new opportunities', value: dailyDigest, setter: setDailyDigest },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">{item.label}</p>
                    <p className="text-xs text-[#6c6c74]">{item.desc}</p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.setter} />
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Theme</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setTheme('dark')} className={`p-6 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-violet-500 bg-violet-500/10' : 'border-[#2a2a2e]'}`}>
                <Moon className="w-8 h-8 text-violet-400 mb-3" />
                <p className="text-sm font-medium text-[#f4f4f5]">Dark Mode</p>
              </button>
              <button onClick={() => setTheme('light')} className={`p-6 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-violet-500 bg-violet-500/10' : 'border-[#2a2a2e]'}`}>
                <Sun className="w-8 h-8 text-amber-400 mb-3" />
                <p className="text-sm font-medium text-[#f4f4f5]">Light Mode</p>
              </button>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed bottom-6 right-6">
        <Button onClick={handleSave} disabled={saving}
          className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white gap-2 shadow-lg shadow-violet-500/25">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </motion.div>
    </div>
  );
}

import { Globe } from 'lucide-react';
