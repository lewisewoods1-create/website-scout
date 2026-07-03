import type { ReactNode } from 'react';
import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  console.log('[RENDER] Layout');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <TopBar onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
      <main className="pt-16 min-h-screen md:ml-16 lg:ml-64 transition-all duration-200">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
