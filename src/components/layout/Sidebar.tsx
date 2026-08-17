import { Church, LayoutDashboard, Users, BookOpen, Settings, UserCog, BarChart3, ChevronRight, Activity, CheckSquare, Bell, Wheat } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NavState, Page } from '../../types';

interface SidebarProps {
  navState: NavState;
  onNavigate: (state: NavState) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: Page;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'churches', label: 'Churches', icon: Church, superAdminOnly: true },
  { id: 'admins', label: 'Admin Users', icon: UserCog, superAdminOnly: true },
  { id: 'account-approvals', label: 'Account Approvals', icon: CheckSquare, superAdminOnly: true },
  { id: 'activity-logs', label: 'Activity Logs', icon: Activity, superAdminOnly: true },
  { id: 'circulars', label: 'Circulars', icon: Bell },
  { id: 'harvest-festival', label: 'Harvest Festival', icon: Wheat },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function Sidebar({ navState, onNavigate, mobileOpen, onClose }: SidebarProps) {
  const { profile, church } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const filteredItems = navItems.filter(item => !item.superAdminOnly || isSuperAdmin);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Church className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-bold text-sm leading-tight">ChurchConnect</h2>
            <p className="text-teal-400 text-xs truncate">
              {isSuperAdmin ? 'Super Admin' : church?.name || 'Church Admin'}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredItems.map(item => {
            const Icon = item.icon;
            const isActive = navState.page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate({ page: item.id }); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-teal-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3" />}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={() => { onNavigate({ page: 'dashboard' }); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all group"
          >
            <Settings className="w-4 h-4 text-slate-500 group-hover:text-teal-400" />
            <span>Settings</span>
          </button>
        </div>

        <div className="px-4 py-3 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
            <span className="text-xs text-slate-500">
              {isSuperAdmin ? 'All Churches Access' : church?.location || 'Branch Access'}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
