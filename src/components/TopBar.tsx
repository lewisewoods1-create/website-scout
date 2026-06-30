import { useLocation } from 'react-router-dom';
import { Rocket, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const routeNames: Record<string, string> = {
  '/': 'Dashboard',
  '/search': 'AI Scout',
  '/leads': 'Leads',
  '/pipeline': 'Pipeline',
  '/outreach': 'Outreach',
  '/email': 'Email Center',
  '/kimi': 'Kimi AI Integration',
  '/settings': 'Settings',
};

export default function TopBar() {
  const location = useLocation();
  const pageName = routeNames[location.pathname] || 'Dashboard';
  const [notifCount] = useState(3);

  return (
    <header className="fixed top-0 left-16 right-0 h-16 glass-nav z-40 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-2 text-sm text-[#6c6c74]">
          <span className="hover:text-[#8c8c96] cursor-pointer transition-colors">Home</span>
          <span className="text-[#2a2a2e]">/</span>
          <span className="text-[#f4f4f5] font-medium">{pageName}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="relative border-[#2a2a2e] bg-transparent text-[#8c8c96] hover:text-[#f4f4f5] hover:bg-white/5 hover:border-violet-500/30 transition-all"
        >
          <Bell className="w-4 h-4 mr-2" />
          Notifications
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-[10px] flex items-center justify-center text-white font-medium">
              {notifCount}
            </span>
          )}
        </Button>

        <Button
          size="sm"
          className="bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-2 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
        >
          <Rocket className="w-4 h-4" />
          Deploy Agent
        </Button>
      </div>
    </header>
  );
}
