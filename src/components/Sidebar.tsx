import { NavLink, useLocation } from 'react-router';
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
  Shield,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/search', icon: Search, label: 'AI Scout' },
  { path: '/leads', icon: Users, label: 'Leads' },
  { path: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { path: '/outreach', icon: MessageSquare, label: 'Outreach' },
  { path: '/email', icon: Send, label: 'Email' },
  { path: '/kimi', icon: Sparkles, label: 'Kimi AI' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  console.log('[RENDER] Sidebar');
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();

  const renderNavItems = () => (
    <nav className="flex-1 flex flex-col gap-1 w-full px-2">
      {navItems.map((item) => {
        const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onMobileClose}
            className={`relative flex items-center gap-3 px-3 h-12 rounded-xl transition-all duration-200 group ${
              isActive
                ? 'bg-violet-500/20 text-violet-400'
                : 'text-[#6c6c74] hover:text-[#f4f4f5] hover:bg-white/5'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium md:hidden lg:inline">{item.label}</span>
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-violet-500" />
            )}
          </NavLink>
        );
      })}
      {isAdmin && (
        <NavLink
          to="/admin"
          onClick={onMobileClose}
          className={`relative flex items-center gap-3 px-3 h-12 rounded-xl transition-all duration-200 group ${
            location.pathname === '/admin'
              ? 'bg-violet-500/20 text-violet-400'
              : 'text-[#6c6c74] hover:text-[#f4f4f5] hover:bg-white/5'
          }`}
        >
          <Shield className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium md:hidden lg:inline">Admin</span>
          {location.pathname === '/admin' && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-violet-500" />
          )}
        </NavLink>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar - always visible */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen glass-nav flex-col items-center py-6 z-50 w-16 lg:w-64 transition-all duration-200">
        <div className="mb-6 px-2 w-full flex items-center justify-center lg:justify-start lg:px-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse-glow flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="hidden lg:block ml-3 text-lg font-bold text-[#f4f4f5]">Website Scout</span>
        </div>

        {renderNavItems()}

        <div className="mt-auto w-full px-2">
          {user && (
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block min-w-0 flex-1">
                <p className="text-xs font-medium text-[#f4f4f5] truncate">{user.name || user.email}</p>
                <p className="text-[10px] text-[#6c6c74] capitalize">{user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 h-10 w-full rounded-xl text-[#6c6c74] hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:inline font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar - overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-[280px] glass-nav flex-col py-6 z-50 md:hidden flex"
            >
              <div className="flex items-center justify-between px-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center animate-pulse-glow">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-[#f4f4f5]">Website Scout</span>
                </div>
                <button onClick={onMobileClose} className="text-[#6c6c74] hover:text-[#f4f4f5]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNavItems()}

              <div className="mt-auto px-4">
                {user && (
                  <div className="flex items-center gap-3 py-3 border-t border-[#2a2a2e]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#f4f4f5] truncate">{user.name || user.email}</p>
                      <p className="text-xs text-[#6c6c74] capitalize">{user.role} • {user.authType}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-3 h-10 w-full rounded-xl text-[#6c6c74] hover:text-red-400 hover:bg-red-500/10 transition-all text-sm mt-2"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
