import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { NavState } from '../../types';

interface LayoutProps {
  navState: NavState;
  onNavigate: (state: NavState) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  children: React.ReactNode;
}

export default function Layout({ navState, onNavigate, searchQuery, onSearchChange, children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        navState={navState}
        onNavigate={onNavigate}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onMenuToggle={() => setMobileMenuOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          navState={navState}
          onNavigate={onNavigate}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
