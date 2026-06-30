import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Users,
  Kanban,
  MessageSquare,
  Send,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/search', icon: Search, label: 'AI Scout' },
  { path: '/leads', icon: Users, label: 'Leads' },
  { path: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { path: '/outreach', icon: MessageSquare, label: 'Outreach' },
  { path: '/email', icon: Send, label: 'Email' },
  { path: '/kimi', icon: Sparkles, label: 'Kimi AI' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen glass-nav flex flex-col items-center py-6 z-50 w-16">
      <div className="mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse-glow">
          <Zap className="w-5 h-5 text-white" />
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 w-full px-2">
        {navItems.map((item) => {
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-[#6c6c74] hover:text-[#f4f4f5] hover:bg-white/5'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-violet-500" />
              )}
              <div className="absolute left-14 px-3 py-1.5 bg-[#1c1c20] border border-[#2a2a2e] rounded-lg text-xs text-[#f4f4f5] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {item.label}
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white cursor-pointer hover:ring-2 hover:ring-violet-500/50 transition-all">
          AJ
        </div>
      </div>
    </aside>
  );
}
