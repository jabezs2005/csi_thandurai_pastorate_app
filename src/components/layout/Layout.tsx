import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import IdleLogout from './IdleLogout'; // NEW
import { NavState } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  navState: NavState;
  onNavigate: (state: NavState) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function Layout({ children, navState, onNavigate, searchQuery, onSearchChange }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <IdleLogout /> {/* NEW */}

      <Sidebar
        navState={navState}
        onNavigate={onNavigate}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          onMenuToggle={() => setMobileOpen(o => !o)}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          navState={navState}
          onNavigate={onNavigate}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}