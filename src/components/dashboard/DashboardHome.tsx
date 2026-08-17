import { useState, useEffect } from 'react';
import { Users, Church, TrendingUp, DollarSign, ArrowRight, Calendar, Cake, Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { NavState } from '../../types';

interface Stats {
  totalMembers: number;
  totalFamilies: number;
  totalChurches: number;
  totalContributions: number;
  churchBreakdown: { name: string; members: number; location: string }[];
}

interface BirthdayEvent {
  id: string;
  member_name: string;
  date_of_birth: string;
  church_name: string;
  family_number: string;
  mobile: string;
}

interface WeddingEvent {
  id: string;
  member_name: string;
  wedding_date: string;
  church_name: string;
  family_number: string;
  mobile: string;
}

interface DashboardHomeProps {
  onNavigate: (state: NavState) => void;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export default function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const { profile, church } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [stats, setStats] = useState<Stats>({
    totalMembers: 0,
    totalFamilies: 0,
    totalChurches: 0,
    totalContributions: 0,
    churchBreakdown: [],
  });
  const [birthdays, setBirthdays] = useState<BirthdayEvent[]>([]);
  const [weddings, setWeddings] = useState<WeddingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        if (isSuperAdmin) {
          const [churchRes, memberRes, subRes] = await Promise.all([
            supabase.from('churches').select('id, name, location'),
            supabase.from('members').select('id, church_id, family_number, church:churches(name)'),
            supabase.from('subscriptions').select('kattida_nidhi, sandha, aalaya_paraamarippu, narseidhi_thiruppani, yezhaiyar_nidhi, pengal_thiruppani, aangal_thiruppani, ilainyar_thiruppani, siruvar_thiruppani, girama_nidhi, kalvi_nidhi').eq('year', currentYear),
          ]);

          const members = memberRes.data || [];
          const churches = churchRes.data || [];
          const subs = subRes.data || [];

          const totalContributions = subs.reduce((sum, s) => sum + (
            (s.kattida_nidhi || 0) + (s.sandha || 0) + (s.aalaya_paraamarippu || 0) +
            (s.narseidhi_thiruppani || 0) + (s.yezhaiyar_nidhi || 0) + (s.pengal_thiruppani || 0) +
            (s.aangal_thiruppani || 0) + (s.ilainyar_thiruppani || 0) + (s.siruvar_thiruppani || 0) +
            (s.girama_nidhi || 0) + (s.kalvi_nidhi || 0)
          ), 0);

          const breakdown = churches.map(c => ({
            name: c.name,
            location: c.location || '',
            members: members.filter(m => m.church_id === c.id).length,
          }));

          const families = new Set(members.map(m => `${m.church_id}_${m.family_number}`));

          setStats({
            totalMembers: members.length,
            totalFamilies: families.size,
            totalChurches: churches.length,
            totalContributions,
            churchBreakdown: breakdown,
          });
        } else if (profile?.church_id) {
          const [memberRes, subRes] = await Promise.all([
            supabase.from('members').select('id, family_number').eq('church_id', profile.church_id),
            supabase.from('subscriptions').select('kattida_nidhi, sandha, aalaya_paraamarippu, narseidhi_thiruppani, yezhaiyar_nidhi, pengal_thiruppani, aangal_thiruppani, ilainyar_thiruppani, siruvar_thiruppani, girama_nidhi, kalvi_nidhi').eq('church_id', profile.church_id).eq('year', currentYear),
          ]);

          const members = memberRes.data || [];
          const subs = subRes.data || [];
          const families = new Set(members.map(m => m.family_number));
          const totalContributions = subs.reduce((sum, s) => sum + (
            (s.kattida_nidhi || 0) + (s.sandha || 0) + (s.aalaya_paraamarippu || 0) +
            (s.narseidhi_thiruppani || 0) + (s.yezhaiyar_nidhi || 0) + (s.pengal_thiruppani || 0) +
            (s.aangal_thiruppani || 0) + (s.ilainyar_thiruppani || 0) + (s.siruvar_thiruppani || 0) +
            (s.girama_nidhi || 0) + (s.kalvi_nidhi || 0)
          ), 0);

          setStats({
            totalMembers: members.length,
            totalFamilies: families.size,
            totalChurches: 1,
            totalContributions,
            churchBreakdown: church ? [{ name: church.name, location: church.location || '', members: members.length }] : [],
          });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [isSuperAdmin, profile, church, currentYear]);

  // Fetch today's birthdays and wedding anniversaries
  useEffect(() => {
    async function fetchEvents() {
      // Fetch members with date_of_birth
      let query = supabase
        .from('members')
        .select('id, member_name, date_of_birth, wedding_date, family_number, mobile, church:churches(name)')
        .not('date_of_birth', 'is', null);

      if (!isSuperAdmin && profile?.church_id) {
        query = query.eq('church_id', profile.church_id);
      }

      const { data: dobData } = await query;
      const allMembers = (dobData || []) as any[];

      // Filter to birthdays that fall on today's date (month + day match)
      const todayBdays = allMembers
        .filter(m => m.date_of_birth && isToday(m.date_of_birth))
        .map(m => ({
          id: m.id,
          member_name: m.member_name,
          date_of_birth: m.date_of_birth,
          church_name: m.church?.name || '',
          family_number: m.family_number,
          mobile: m.mobile || '',
        }));

      setBirthdays(todayBdays);

      // Fetch members with wedding_date (separate query to catch those without dob)
      let wQuery = supabase
        .from('members')
        .select('id, member_name, wedding_date, family_number, mobile, church:churches(name)')
        .not('wedding_date', 'is', null);

      if (!isSuperAdmin && profile?.church_id) {
        wQuery = wQuery.eq('church_id', profile.church_id);
      }

      const { data: wedData } = await wQuery;
      const wedMembers = (wedData || []) as any[];

      const todayWeddings = wedMembers
        .filter(m => m.wedding_date && isToday(m.wedding_date))
        .map(m => ({
          id: m.id,
          member_name: m.member_name,
          wedding_date: m.wedding_date,
          church_name: m.church?.name || '',
          family_number: m.family_number,
          mobile: m.mobile || '',
        }));

      setWeddings(todayWeddings);
    }
    fetchEvents();
  }, [isSuperAdmin, profile?.church_id]);

  const statCards = [
    { label: 'Total Members', value: stats.totalMembers, icon: Users, color: 'teal', bg: 'bg-teal-50', icon_bg: 'bg-teal-500', text: 'text-teal-700' },
    { label: 'Families', value: stats.totalFamilies, icon: Church, color: 'blue', bg: 'bg-blue-50', icon_bg: 'bg-blue-500', text: 'text-blue-700' },
    { label: isSuperAdmin ? 'Churches' : 'This Church', value: isSuperAdmin ? stats.totalChurches : 1, icon: TrendingUp, color: 'amber', bg: 'bg-amber-50', icon_bg: 'bg-amber-500', text: 'text-amber-700' },
    { label: `${currentYear} Contributions`, value: `₹${stats.totalContributions.toLocaleString('en-IN')}`, icon: DollarSign, color: 'green', bg: 'bg-green-50', icon_bg: 'bg-green-500', text: 'text-green-700', isAmount: true },
  ];

  const today = new Date();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {isSuperAdmin ? 'Overview Dashboard' : `${church?.name || 'Church'} Dashboard`}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className={`${card.bg} rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${card.text} opacity-70`}>{card.label}</p>
                    <p className={`text-2xl font-bold mt-1.5 ${card.text}`}>
                      {card.isAmount ? card.value : card.value.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className={`${card.icon_bg} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Today's Birthdays & Wedding Anniversaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Cake className="w-5 h-5 text-amber-500" />
              Today's Birthdays
            </h2>
            <span className="text-xs text-slate-400">{today.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
          </div>
          {birthdays.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No birthdays today</p>
          ) : (
            <div className="space-y-2">
              {birthdays.map(b => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer hover:bg-amber-100"
                  onClick={() => onNavigate({ page: 'member-detail', memberId: b.id, familyNumber: b.family_number })}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500 text-white">
                    <Cake className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{b.member_name}</p>
                    <p className="text-xs text-slate-500">
                      {b.church_name && <span>{b.church_name}</span>}
                      {b.mobile && <span className="ml-1.5 text-slate-600">| {b.mobile}</span>}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 bg-amber-500 text-white">
                    Birthday
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Today's Wedding Anniversaries
            </h2>
            <span className="text-xs text-slate-400">{today.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
          </div>
          {weddings.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No wedding anniversaries today</p>
          ) : (
            <div className="space-y-2">
              {weddings.map(w => {
                const years = new Date().getFullYear() - new Date(w.wedding_date).getFullYear();
                return (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer hover:bg-rose-100"
                    onClick={() => onNavigate({ page: 'member-detail', memberId: w.id, familyNumber: w.family_number })}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-500 text-white">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{w.member_name}</p>
                      <p className="text-xs text-slate-500">
                        {w.church_name && <span>{w.church_name}</span>}
                        {w.mobile && <span className="ml-1.5 text-slate-600">| {w.mobile}</span>}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 bg-rose-500 text-white">
                      {years > 0 ? `${years}yr` : 'Anniversary'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">
              {isSuperAdmin ? 'Church Branches' : 'Quick Actions'}
            </h2>
          </div>

          {isSuperAdmin ? (
            <div className="space-y-3">
              {stats.churchBreakdown.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer" onClick={() => onNavigate({ page: 'members' })}>
                  <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Church className="w-4 h-4 text-teal-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.location}</p>
                  </div>
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-semibold flex-shrink-0">
                    {c.members} members
                  </span>
                </div>
              ))}
              {stats.churchBreakdown.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">No church data available</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'View All Members', desc: 'Browse and manage members', action: () => onNavigate({ page: 'members' }) },
                { label: 'Add New Member', desc: 'Register a new church member', action: () => onNavigate({ page: 'members' }) },
                { label: 'View Reports', desc: 'Contribution and member reports', action: () => onNavigate({ page: 'reports' }) },
              ].map((item, i) => (
                <button key={i} onClick={item.action} className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-teal-50 rounded-lg text-left transition-colors group">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-4">Contribution Summary ({currentYear})</h2>
          <div className="space-y-3">
            {[
              { label: 'Total Contributions', value: stats.totalContributions, color: 'teal' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 font-medium">{item.label}</span>
                  <span className="font-bold text-slate-800">₹{item.value.toLocaleString('en-IN')}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-700"
                    style={{ width: item.value > 0 ? '75%' : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wide">System Info</p>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Active Year</span>
                <span className="font-semibold text-slate-800">{currentYear}</span>
              </div>
              <div className="flex justify-between">
                <span>Role</span>
                <span className="font-semibold text-teal-600">{isSuperAdmin ? 'Super Admin' : 'Church Admin'}</span>
              </div>
              {!isSuperAdmin && church && (
                <div className="flex justify-between">
                  <span>Assigned Church</span>
                  <span className="font-semibold text-slate-800">{church.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
