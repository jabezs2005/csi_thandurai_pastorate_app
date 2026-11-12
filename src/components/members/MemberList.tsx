import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, UserPlus, Trash2, Search, Users, ChevronRight, Home, Download,
  FileText, X, Church, Folder, ArrowLeft, MapPin, IndianRupee, ArrowUp, ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Member, Church as ChurchType, NavState } from '../../types';
import { useAuth } from '../../context/AuthContext';
import AddMemberModal from './AddMemberModal';
import BuildingFundDownload from './BuildingFundDownload';
import MemberFilterPanel, {
  DEFAULT_FILTERS, MIN_CONTRIBUTION, MemberFilters, ConfirmFilter,
  countActiveFilters, memberMatchesFilters,
} from './MemberFilterPanel';
import { exportMembersCsv, exportMembersPdf } from '../../utils/memberExport';
import { logActivity } from '../../utils/activityLogger';
import { getAge } from '../../utils/age';
import {
  sortMembersByFamily, compareFamilyNumbers, parseFamilyNumber, countFamilies,
} from '../../utils/familyUtils';

interface MemberListProps {
  searchQuery: string;
  onNavigate: (state: NavState) => void;
  onSearchChange: (q: string) => void;
}

interface ChurchFolder {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  familyCount: number;
}

interface SandhaGroup {
  key: string;
  base: string;
  members: Member[];
}

type SubscriptionRow = Record<string, unknown>;
type MemberWithChurch = Member & { church?: { name: string } };
type SortBy = 'family' | 'name' | 'age' | 'total';
type SortDir = 'asc' | 'desc';

const AMOUNT_FIELDS = [
  'sandha', 'kattida_nidhi', 'aalaya_paraamarippu', 'narseidhi_thiruppani',
  'yezhaiyar_nidhi', 'pengal_thiruppani', 'aangal_thiruppani',
  'ilainyar_thiruppani', 'siruvar_thiruppani', 'girama_nidhi', 'kalvi_nidhi',
];

const SORT_HINTS: Record<SortBy, [string, string]> = {
  family: ['1, 1A, 1B, 2 ...', '... 2, 1B, 1A, 1'],
  name: ['A → Z', 'Z → A'],
  age: ['Youngest first', 'Oldest first'],
  total: ['Lowest first', 'Highest first'],
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/₹/g, '').replace(/,/g, '').trim());
  return Number.isNaN(n) ? 0 : n;
}

function normalize(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

function subscriptionTotal(s: SubscriptionRow): number {
  return AMOUNT_FIELDS.reduce((sum, field) => sum + toNumber(s[field]), 0);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

// Keeps the order of the list it receives (so the chosen sort is respected)
function groupInOrder(list: Member[]): SandhaGroup[] {
  const map = new Map<string, SandhaGroup>();
  for (const m of list) {
    const base = parseFamilyNumber(m.family_number).base;
    const key = `${m.church_id ?? ''}|${base}`;
    if (!map.has(key)) map.set(key, { key, base, members: [] });
    map.get(key)!.members.push(m);
  }
  return Array.from(map.values());
}

export default function MemberList({ searchQuery, onNavigate, onSearchChange }: MemberListProps) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;
  const [viewMode, setViewMode] = useState<'all' | 'churches'>('churches');
  const [churchFolders, setChurchFolders] = useState<ChurchFolder[]>([]);
  const [drilledChurchId, setDrilledChurchId] = useState<string | null>(null);
  const [drilledChurch, setDrilledChurch] = useState<ChurchType | null>(null);
  const [exportMenu, setExportMenu] = useState<'csv' | 'pdf' | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortBy>('family');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const activeFilterCount = countActiveFilters(filters);
  const hasActiveFilters = activeFilterCount > 0 || sortBy !== 'family' || sortDir !== 'asc';

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setSortBy('family');
    setSortDir('asc');
  }

  const grandTotal = (memberId: string) => totals[memberId] || 0;

  const fetchTotals = useCallback(async (memberList: Member[]) => {
    const result: Record<string, number> = {};
    memberList.forEach(m => { result[m.id] = 0; });

    try {
      if (memberList.length === 0) { setTotals({}); return; }

      const { data, error } = await supabase.from('subscriptions').select('*');
      if (error) {
        console.error('Error fetching subscriptions:', error);
        setTotals(result);
        return;
      }

      const subs = (data || []) as SubscriptionRow[];
      memberList.forEach(member => {
        const memberId = normalize(member.id);
        const family = normalize(member.family_number);
        let sum = 0;

        subs.forEach(s => {
          const subMember = normalize(s.member_id || s.memberId);
          const subFamily = normalize(s.family_number || s.family_no);
          const byMember = subMember !== '' && subMember === memberId;
          const byFamily = subFamily !== '' && family !== '' && subFamily === family;
          if (byMember || byFamily) sum += subscriptionTotal(s);
        });

        result[member.id] = sum;
      });

      setTotals(result);
    } catch (error) {
      console.error('Contribution total calculation error:', error);
      setTotals(result);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('members')
        .select('*, church:churches(id,name,location)')
        .order('member_name', { ascending: true });

      if (isSuperAdmin && drilledChurchId) {
        query = query.eq('church_id', drilledChurchId);
      } else if (profile?.role === 'church_admin' && profile.church_id) {
        query = query.eq('church_id', profile.church_id);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching members:', error);
        setMembers([]);
        setTotals({});
        return;
      }

      const list = sortMembersByFamily((data || []) as Member[]);
      setMembers(list);
      await fetchTotals(list);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]);
      setTotals({});
    } finally {
      setLoading(false);
    }
  }, [profile, isSuperAdmin, drilledChurchId, fetchTotals]);

  const fetchChurchFolders = useCallback(async () => {
    setLoading(true);
    try {
      const [churchRes, memberRes] = await Promise.all([
        supabase.from('churches').select('id, name, location').order('name'),
        supabase.from('members').select('id, church_id, family_number'),
      ]);

      if (churchRes.error) console.error('Error fetching churches:', churchRes.error);
      if (memberRes.error) console.error('Error fetching members:', memberRes.error);

      const allMembers = memberRes.data || [];
      const folders: ChurchFolder[] = (churchRes.data || []).map(c => {
        const churchMembers = allMembers.filter(m => m.church_id === c.id);
        return {
          id: c.id,
          name: c.name,
          location: c.location || '',
          memberCount: churchMembers.length,
          familyCount: countFamilies(churchMembers), // 1, 1A, 1B = one family
        };
      });

      setChurchFolders(folders);
    } catch (error) {
      console.error('Error fetching church folders:', error);
      setChurchFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin && viewMode === 'churches' && !drilledChurchId) {
      fetchChurchFolders();
    } else {
      fetchMembers();
    }
  }, [fetchMembers, fetchChurchFolders, isSuperAdmin, viewMode, drilledChurchId]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, drilledChurchId, viewMode, filters, sortBy, sortDir]);

  useEffect(() => {
    if (!drilledChurchId) { setDrilledChurch(null); return; }
    supabase
      .from('churches')
      .select('*')
      .eq('id', drilledChurchId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('Error fetching selected church:', error); setDrilledChurch(null); return; }
        setDrilledChurch(data as ChurchType | null);
      });
  }, [drilledChurchId]);

  const streetSuggestions = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      const first = (m.address || '').split(',')[0].trim();
      if (first) set.add(first);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [members]);

  // members = full list, filtered = after search + all filters
  const filtered = members.filter(member => {
    if (!memberMatchesFilters(member, filters, grandTotal(member.id))) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.member_name.toLowerCase().includes(q) ||
      member.family_number.toLowerCase().includes(q) ||
      (member.email && member.email.toLowerCase().includes(q)) ||
      (member.mobile && member.mobile.includes(q))
    );
  });

  let sortedFiltered: Member[];
  if (sortBy === 'family') {
    sortedFiltered = sortMembersByFamily(filtered);
    if (sortDir === 'desc') sortedFiltered.reverse();
  } else {
    const dir = sortDir === 'asc' ? 1 : -1;
    sortedFiltered = [...filtered].sort((a, b) => {
      let r = 0;
      if (sortBy === 'name') {
        r = a.member_name.localeCompare(b.member_name);
      } else if (sortBy === 'age') {
        const aa = getAge(a.date_of_birth);
        const ba = getAge(b.date_of_birth);
        if (aa === null && ba === null) return compareFamilyNumbers(a.family_number, b.family_number);
        if (aa === null) return 1;
        if (ba === null) return -1;
        r = aa - ba;
      } else {
        r = grandTotal(a.id) - grandTotal(b.id);
      }
      return r !== 0 ? r * dir : compareFamilyNumbers(a.family_number, b.family_number);
    });
  }

  const grouped = groupInOrder(sortedFiltered);
  const paginatedGroups = grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(grouped.length / PAGE_SIZE);

  const churchName = drilledChurch?.name || profile?.church?.name || 'church';
  const exportOptions = (label: 'all' | 'filtered') => ({ churchName, label, getTotal: grandTotal });

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupMembers: Member[]) {
    const allSelected = groupMembers.every(m => selectedIds.has(m.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      groupMembers.forEach(m => {
        if (allSelected) next.delete(m.id);
        else next.add(m.id);
      });
      return next;
    });
  }

  async function handleDelete() {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} member(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const names = members.filter(m => selectedIds.has(m.id)).map(m => m.member_name);
      const { error } = await supabase.from('members').delete().in('id', Array.from(selectedIds));
      if (error) {
        console.error('Error deleting members:', error);
        alert('Failed to delete member(s).');
        return;
      }

      if (profile) {
        await logActivity(
          profile.id,
          drilledChurchId || profile.church_id || null,
          'delete',
          'member',
          Array.from(selectedIds).join(','),
          `Deleted ${selectedIds.size} member(s): ${names.join(', ')}`
        );
      }

      setSelectedIds(new Set());
      await fetchMembers();
    } catch (error) {
      console.error('Error deleting members:', error);
    } finally {
      setDeleting(false);
    }
  }

  // ---------- Church folders view (super admin) ----------
  if (isSuperAdmin && viewMode === 'churches' && !drilledChurchId) {
    const visibleChurches = churchFolders.filter(c => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.location && c.location.toLowerCase().includes(q));
    });
    const colors = ['bg-teal-500', 'bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-rose-500', 'bg-cyan-500'];

    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Members</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {churchFolders.length} church{churchFolders.length !== 1 ? 'es' : ''} ·{' '}
              {churchFolders.reduce((sum, c) => sum + c.memberCount, 0)} total members
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('churches')}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-white text-teal-700 shadow-sm"
              >
                <Folder className="w-4 h-4 inline mr-1.5" />
                By Church
              </button>
              <button
                onClick={() => setViewMode('all')}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                All Members
              </button>
            </div>
            <button
              onClick={fetchChurchFolders}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search churches by name or location..."
            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleChurches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Church className="w-12 h-12 mb-3 opacity-40" />
            <p className="font-medium">{searchQuery ? 'No churches match your search' : 'No churches found'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleChurches.map((church, index) => (
              <button
                key={church.id}
                onClick={() => setDrilledChurchId(church.id)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all p-5 text-left group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${colors[index % colors.length]}`}>
                    <Folder className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 leading-tight group-hover:text-teal-700 transition-colors">
                      {church.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <p className="text-xs text-slate-500 truncate">{church.location || 'Location not set'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-600 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-slate-800">{church.memberCount}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Members</p>
                  </div>
                  <div className="flex-1 bg-teal-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-teal-700">{church.familyCount}</p>
                    <p className="text-xs text-teal-600 mt-0.5">Families</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Members list view ----------
  const showBack = isSuperAdmin && viewMode === 'churches' && drilledChurchId;
  const subtitle = `${filtered.length} member${filtered.length !== 1 ? 's' : ''} in ${grouped.length} famil${
    grouped.length !== 1 ? 'ies' : 'y'
  }`;
  const selectClass =
    'px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-teal-500 outline-none';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => { setDrilledChurchId(null); setSelectedIds(new Set()); }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Churches</span>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {showBack && <Church className="w-6 h-6 text-teal-600" />}
              {showBack ? drilledChurch?.name || 'Church' : 'Members'}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {showBack && drilledChurch?.location ? `${drilledChurch.location} · ` : ''}
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && !showBack && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => { setViewMode('churches'); setDrilledChurchId(null); }}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <Folder className="w-4 h-4 inline mr-1.5" />
                By Church
              </button>
              <button className="px-3 py-1.5 rounded-md text-sm font-medium bg-white text-teal-700 shadow-sm">
                <Users className="w-4 h-4 inline mr-1.5" />
                All
              </button>
            </div>
          )}

          <button
            onClick={fetchMembers}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          {members.length > 0 && (
            <div className="flex items-center gap-2 border-l border-slate-300 pl-2">
              <div className="relative">
                <button
                  onClick={() => setExportMenu(exportMenu === 'csv' ? null : 'csv')}
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium border border-green-200"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                {exportMenu === 'csv' && (
                  <div className="absolute right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => { exportMembersCsv(sortMembersByFamily(members), exportOptions('all')); setExportMenu(null); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      All members ({members.length})
                    </button>
                    <button
                      onClick={() => { exportMembersCsv(sortedFiltered, exportOptions('filtered')); setExportMenu(null); }}
                      disabled={sortedFiltered.length === 0}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Filtered members ({sortedFiltered.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setExportMenu(exportMenu === 'pdf' ? null : 'pdf')}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium border border-orange-200"
                >
                  <FileText className="w-4 h-4" />
                  PDF
                </button>
                {exportMenu === 'pdf' && (
                  <div className="absolute right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => { exportMembersPdf(sortMembersByFamily(members), exportOptions('all')); setExportMenu(null); }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      All members ({members.length})
                    </button>
                    <button
                      onClick={() => { exportMembersPdf(sortedFiltered, exportOptions('filtered')); setExportMenu(null); }}
                      disabled={sortedFiltered.length === 0}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Filtered members ({sortedFiltered.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Building Construction Fund: all members / filtered members */}
          {members.length > 0 && (
            <BuildingFundDownload
              churchId={drilledChurchId || profile?.church_id || undefined}
              churchName={churchName}
              filteredMemberIds={sortedFiltered.map(m => m.id)}
              filtersActive={activeFilterCount > 0 || !!searchQuery}
            />
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium border border-red-200 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      {/* Search + quick filters */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name, Sandha number, email, or mobile..."
            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setFilters({ ...filters, contrib: filters.contrib === 'min240' ? 'all' : 'min240' })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
            filters.contrib === 'min240'
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Grand total ≥ ₹{MIN_CONTRIBUTION}
        </button>

        <select
          value={filters.confirmation}
          onChange={e => setFilters({ ...filters, confirmation: e.target.value as ConfirmFilter })}
          className={selectClass}
          aria-label="Confirmation"
        >
          <option value="all">Confirmation: All</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Not confirmed">Not confirmed</option>
          <option value="notset">Not set</option>
        </select>

        <button
          onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-teal-50 border-teal-200 text-teal-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          More filters
          {activeFilterCount > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 bg-teal-600 text-white text-xs rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            <X className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      {/* Sort bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sort by</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className={selectClass} aria-label="Sort by">
          <option value="family">Sandha number</option>
          <option value="name">Name (alphabet)</option>
          <option value="age">Age</option>
          <option value="total">Grand total</option>
        </select>

        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setSortDir('asc')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
              sortDir === 'asc' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowUp className="w-4 h-4" />
            Ascending
          </button>
          <button
            onClick={() => setSortDir('desc')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
              sortDir === 'desc' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowDown className="w-4 h-4" />
            Descending
          </button>
        </div>

        <span className="text-sm text-slate-500">{SORT_HINTS[sortBy][sortDir === 'asc' ? 0 : 1]}</span>
      </div>

      {showFilters && (
        <MemberFilterPanel filters={filters} onChange={setFilters} streetSuggestions={streetSuggestions} />
      )}

      {(searchQuery || activeFilterCount > 0) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <span className="text-sm text-teal-800">
            <strong>{sortedFiltered.length}</strong> member{sortedFiltered.length !== 1 ? 's' : ''} match your search / filters
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportMembersCsv(sortedFiltered, exportOptions('filtered'))}
              disabled={sortedFiltered.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium border border-green-200 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={() => exportMembersPdf(sortedFiltered, exportOptions('filtered'))}
              disabled={sortedFiltered.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium border border-orange-200 disabled:opacity-40"
            >
              <FileText className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Users className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">
            {searchQuery || activeFilterCount > 0 ? 'No members match your filters' : 'No members found'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedGroups.map(group => {
            const allSelected = group.members.every(m => selectedIds.has(m.id));
            const someSelected = group.members.some(m => selectedIds.has(m.id));

            return (
              <div key={group.key} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer group hover:bg-teal-50"
                  onClick={() =>
                    onNavigate({ page: 'member-detail', familyNumber: group.base, memberId: group.members[0].id })
                  }
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={e => { e.stopPropagation(); toggleGroup(group.members); }}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-teal-600"
                  />
                  <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Home className="w-4 h-4 text-teal-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-slate-800">Sandha No: {group.base}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
                </div>

                <div className="divide-y divide-slate-100">
                  {group.members.map(member => {
                    const church = (member as MemberWithChurch).church;
                    const age = getAge(member.date_of_birth);

                    return (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 ${
                          selectedIds.has(member.id) ? 'bg-teal-50' : ''
                        }`}
                        onClick={() =>
                          onNavigate({ page: 'member-detail', memberId: member.id, familyNumber: member.family_number })
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(member.id)}
                          onChange={e => { e.stopPropagation(); toggleSelect(member.id); }}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded accent-teal-600"
                        />
                        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-slate-600">
                            {member.member_name.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-xs font-semibold">
                              {member.family_number}
                            </span>
                            {member.title ? `${member.title} ` : ''}
                            {member.member_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {member.gender ? `${member.gender} · ` : ''}
                            {age !== null ? `${age} yrs · ` : ''}
                            {member.mobile || member.email || member.address || 'No contact info'}
                          </p>
                        </div>

                        {member.confirmation_status && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full hidden md:inline ${
                              member.confirmation_status === 'Confirmed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {member.confirmation_status}
                          </span>
                        )}

                        {isSuperAdmin && viewMode === 'all' && church && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full hidden lg:inline">
                            {church.name}
                          </span>
                        )}

                        <div
                          className="hidden sm:flex flex-col items-end min-w-[150px] px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                            <IndianRupee className="w-3 h-3" />
                            Grand Total
                          </div>
                          <p className="text-sm font-bold text-emerald-700 mt-0.5">
                            {formatCurrency(grandTotal(member.id))}
                          </p>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-100"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 px-2">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-100"
          >
            Next
          </button>
        </div>
      )}

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={() => { setShowAddModal(false); fetchMembers(); }}
          defaultChurchId={drilledChurchId || profile?.church_id || undefined}
        />
      )}
    </div>
  );
}