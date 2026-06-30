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
  FileText,
  Trash2,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { defaultSettings } from '@/data/mockData';
import { useToast } from '@/hooks/useToast';

export default function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    addToast('Settings saved successfully!', 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-[#f4f4f5] mb-2">Settings</h1>
        <p className="text-[#8c8c96]">Manage your account, preferences, and integrations</p>
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-[#131316] border border-[#2a2a2e] p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400 text-[#8c8c96]">
            <FileText className="w-4 h-4 mr-2" />
            Data
          </TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Profile Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-2xl text-white font-bold">
                  {settings.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#f4f4f5]">{settings.name}</p>
                  <p className="text-xs text-[#6c6c74]">{settings.email}</p>
                  <Button variant="ghost" size="sm" className="text-violet-400 hover:text-violet-300 mt-1 h-7">
                    Change Avatar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">Full Name</label>
                  <Input
                    value={settings.name}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">Email Address</label>
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">Company Name</label>
                  <Input
                    value={settings.company}
                    onChange={(e) => setSettings({ ...settings, company: e.target.value })}
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#8c8c96] mb-1.5 block">Default From Email</label>
                  <Input
                    type="email"
                    value={settings.email}
                    className="bg-[#0a0a0c] border-[#2a2a2e] text-[#f4f4f5] focus:border-violet-500/50"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { label: 'Push Notifications', desc: 'Receive browser notifications for new leads', key: 'notifications' as const },
                { label: 'Daily Digest', desc: 'Get a summary of new opportunities every morning', key: 'dailyDigest' as const },
                { label: 'Weekly Report', desc: 'Receive a detailed weekly performance report', key: 'weeklyReport' as const },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]"
                >
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">{item.label}</p>
                    <p className="text-xs text-[#6c6c74]">{item.desc}</p>
                  </div>
                  <Switch
                    checked={settings[item.key]}
                    onCheckedChange={(checked) => setSettings({ ...settings, [item.key]: checked })}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Email Notifications</h3>
            <div className="space-y-4">
              {[
                { label: 'New Lead Alert', desc: 'Email when AI finds a high-priority lead', enabled: true },
                { label: 'Scout Complete', desc: 'Email when a scout job finishes', enabled: true },
                { label: 'Follow-up Reminder', desc: 'Remind you to follow up with leads', enabled: false },
                { label: 'Weekly Pipeline', desc: 'Weekly summary of pipeline changes', enabled: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]"
                >
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">{item.label}</p>
                    <p className="text-xs text-[#6c6c74]">{item.desc}</p>
                  </div>
                  <Switch defaultChecked={item.enabled} />
                </div>
              ))}
            </div>
          </motion.div>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Theme</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSettings({ ...settings, theme: 'dark' })}
                className={`p-6 rounded-xl border-2 transition-all ${
                  settings.theme === 'dark'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-[#2a2a2e] hover:border-[#3a3a3e]'
                }`}
              >
                <Moon className="w-8 h-8 text-violet-400 mb-3" />
                <p className="text-sm font-medium text-[#f4f4f5]">Dark Mode</p>
                <p className="text-xs text-[#6c6c74]">Default dark theme</p>
              </button>
              <button
                onClick={() => setSettings({ ...settings, theme: 'light' })}
                className={`p-6 rounded-xl border-2 transition-all ${
                  settings.theme === 'light'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-[#2a2a2e] hover:border-[#3a3a3e]'
                }`}
              >
                <Sun className="w-8 h-8 text-amber-400 mb-3" />
                <p className="text-sm font-medium text-[#f4f4f5]">Light Mode</p>
                <p className="text-xs text-[#6c6c74]">Coming soon</p>
              </button>
            </div>
          </motion.div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 text-violet-400" />
              API Keys
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">Kimi API Key</p>
                    <p className="text-xs text-[#6c6c74]">For AI-powered features</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-violet-400" onClick={() => {}}>
                    Manage
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-[#8c8c96] bg-[#131316] px-2 py-1 rounded">
                    {settings.kimiConfig.apiKey ? '••••••••' + settings.kimiConfig.apiKey.slice(-4) : 'Not configured'}
                  </code>
                  {settings.kimiConfig.enabled && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">SendGrid / Email API</p>
                    <p className="text-xs text-[#6c6c74]">For sending emails from the platform</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-violet-400">
                    Configure
                  </Button>
                </div>
                <code className="text-xs text-[#8c8c96] bg-[#131316] px-2 py-1 rounded">Not configured</code>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Data */}
        <TabsContent value="data" className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[#f4f4f5] mb-6">Data Management</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-violet-400" />
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">Export Leads</p>
                    <p className="text-xs text-[#6c6c74]">Download all leads as CSV</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-[#2a2a2e] text-[#8c8c96]">
                  Export
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0c] border border-[#2a2a2e]">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-violet-400" />
                  <div>
                    <p className="text-sm font-medium text-[#f4f4f5]">Export Analytics</p>
                    <p className="text-xs text-[#6c6c74]">Download performance reports</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-[#2a2a2e] text-[#8c8c96]">
                  Export
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Delete All Data</p>
                    <p className="text-xs text-[#6c6c74]">This action cannot be undone</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed bottom-6 right-6"
      >
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-2 shadow-lg shadow-violet-500/25"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </Button>
      </motion.div>
    </div>
  );
}
