import { useLocation } from 'react-router';
import { Rocket, Bell, Menu } from 'lucide-react';
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
  '/admin': 'Admin Dashboard',
};

interface TopBarProps {
  onMobileMenuToggle: () => void;
}

export default function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const location = useLocation();
  const pageName = routeNames[location.pathname] || 'Dashboard';
  const [notifCount] = useState(0);

  return (
    <header className="fixed top-0 left-0 right-0 md:left-16 lg:left-64 h-16 glass-nav z-40 flex items-center justify-between px-4 md:px-6 transition-all duration-200">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMobileMenuToggle}
          className="md:hidden text-[#6c6c74] hover:text-[#f4f4f5] -ml-2"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <nav className="flex items-center gap-2 text-sm text-[#6c6c74]">
          <span className="hover:text-[#8c8c96] cursor-pointer transition-colors hidden sm:inline">Home</span>
          <span className="text-[#2a2a2e] hidden sm:inline">/</span>
          <span className="text-[#f4f4f5] font-medium">{pageName}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="outline"
          size="sm"
          className="relative border-[#2a2a2e] bg-transparent text-[#8c8c96] hover:text-[#f4f4f5] hover:bg-white/5 hover:border-violet-500/30 transition-all"
        >
          <Bell className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Notifications</span>
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-[10px] flex items-center justify-center text-white font-medium">
              {notifCount}
            </span>
          )}
        </Button>

        <Button
          size="sm"
          className="hidden sm:flex bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white gap-2 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
        >
          <Rocket className="w-4 h-4" />
          Deploy Agent
        </Button>
      </div>
    </header>
  );
}
