import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, Search, Bell, LogOut, ChevronDown, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { NavState } from '../../types';

interface TopBarProps {
  onMenuToggle: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  navState: NavState;
  onNavigate: (state: NavState) => void;
}

export default function TopBar({ onMenuToggle, searchQuery, onSearchChange, navState, onNavigate }: TopBarProps) {
  const { profile, church, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isSuperAdmin = profile?.role === 'super_admin';
  const churchId = profile?.church_id || '';
  const isSuperAdminRef = useRef(isSuperAdmin);
  const churchIdRef = useRef(churchId);
  isSuperAdminRef.current = isSuperAdmin;
  churchIdRef.current = churchId;

  const fetchUnread = useCallback(async () => {
    if (isSuperAdminRef.current) {
      // Super admin: count circulars that have at least one unread church
      const { data, error } = await supabase
        .from('circulars')
        .select('id, circular_churches!left(read_at)')
        .eq('created_by', profile?.id || '');
      if (error) { setUnreadCount(0); return; }
      const unreadCirculars = (data || []).filter((c: any) => {
        const churches = c.circular_churches || [];
        if (churches.length === 0) return false;
        return churches.some((cc: any) => !cc.read_at);
      });
      setUnreadCount(unreadCirculars.length);
    } else if (churchIdRef.current) {
      // Church admin: count circulars targeting their church that they haven't read
      const { count, error } = await supabase
        .from('circular_churches')
        .select('id', { count: 'exact', head: true })
        .eq('church_id', churchIdRef.current)
        .is('read_at', null);
      if (error) { setUnreadCount(0); return; }
      setUnreadCount(count || 0);
    }
  }, [profile?.id]);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Real-time subscription for circular_churches changes
  useEffect(() => {
    const channel = supabase
      .channel('circular-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circular_churches' }, () => {
        fetchUnread();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circulars' }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnread]);

  // Refetch when navigating to circulars page (user may have just read something)
  useEffect(() => {
    if (navState.page === 'circulars') {
      fetchUnread();
    }
  }, [navState.page, fetchUnread]);

  const displayName = profile?.full_name || profile?.email || 'Admin';
  const roleLabel = isSuperAdmin ? 'Super Admin' : 'Church Admin';
  const churchLabel = !isSuperAdmin && church ? ` - ${church.name}` : '';

  const showSearch = navState.page === 'members';

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <Menu className="w-5 h-5" />
      </button>

      {showSearch && (
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, family number, email, or mobile..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {!showSearch && <div className="flex-1" />}

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => onNavigate({ page: 'circulars' })}
          className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          title="Circulars & Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-teal-700" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{displayName}</p>
              <p className="text-xs text-slate-500">{roleLabel}{churchLabel}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                  <p className="text-xs text-teal-600 mt-0.5">{roleLabel}{churchLabel}</p>
                </div>
                <button
                  onClick={() => { onNavigate({ page: 'circulars' }); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  <span>Circulars</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { signOut(); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
