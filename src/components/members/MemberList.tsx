import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, UserPlus, Trash2, Search, Users, ChevronRight, Home, Download, FileText, X, Church, Folder, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Member, Church as ChurchType, NavState } from '../../types';
import { useAuth } from '../../context/AuthContext';
import AddMemberModal from './AddMemberModal';
import { exportMembersToExcel, generatePDF } from '../../utils/export';
import { logActivity } from '../../utils/activityLogger';

interface MemberListProps {
  searchQuery: string;
  onNavigate: (state: NavState) => void;
  onSearchChange: (q: string) => void;
}

interface FamilyGroup {
  family_number: string;
  members: Member[];
}

interface ChurchFolder {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  familyCount: number;
}

export default function MemberList({ searchQuery, onNavigate, onSearchChange }: MemberListProps) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  // Super admin view mode: 'all' = flat list, 'churches' = folder view
  const [viewMode, setViewMode] = useState<'all' | 'churches'>('churches');
  const [churchFolders, setChurchFolders] = useState<ChurchFolder[]>([]);
  const [drilledChurchId, setDrilledChurchId] = useState<string | null>(null);
  const [drilledChurch, setDrilledChurch] = useState<ChurchType | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('members')
      .select('*, church:churches(id,name,location)')
      .order('family_number', { ascending: true })
      .order('member_name', { ascending: true });

    if (isSuperAdmin && drilledChurchId) {
      query = query.eq('church_id', drilledChurchId);
    } else if (profile?.role === 'church_admin' && profile.church_id) {
      query = query.eq('church_id', profile.church_id);
    }

    const { data } = await query;
    setMembers(data || []);
    setLoading(false);
  }, [profile, isSuperAdmin, drilledChurchId]);

  const fetchChurchFolders = useCallback(async () => {
    setLoading(true);
    const [churchRes, memberRes] = await Promise.all([
      supabase.from('churches').select('id, name, location').order('name'),
      supabase.from('members').select('id, church_id, family_number'),
    ]);

    const churches = churchRes.data || [];
    const allMembers = memberRes.data || [];

    const folders: ChurchFolder[] = churches.map(c => {
      const churchMembers = allMembers.filter(m => m.church_id === c.id);
      const families = new Set(churchMembers.map(m => m.family_number));
      return {
        id: c.id,
        name: c.name,
        location: c.location || '',
        memberCount: churchMembers.length,
        familyCount: families.size,
      };
    });

    setChurchFolders(folders);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isSuperAdmin && viewMode === 'churches' && !drilledChurchId) {
      fetchChurchFolders();
    } else {
      fetchMembers();
    }
  }, [fetchMembers, fetchChurchFolders, isSuperAdmin, viewMode, drilledChurchId]);

  useEffect(() => { setPage(1); }, [searchQuery, drilledChurchId, viewMode]);

  // Fetch church details when drilling in
  useEffect(() => {
    if (drilledChurchId) {
      supabase.from('churches').select('*').eq('id', drilledChurchId).maybeSingle().then(({ data }) => {
        setDrilledChurch(data as ChurchType | null);
      });
    } else {
      setDrilledChurch(null);
    }
  }, [drilledChurchId]);

  const filtered = members.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.member_name.toLowerCase().includes(q) ||
      m.family_number.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.mobile && m.mobile.includes(q))
    );
  });

  const grouped: FamilyGroup[] = filtered.reduce<FamilyGroup[]>((acc, member) => {
    const existing = acc.find(g => g.family_number === member.family_number);
    if (existing) existing.members.push(member);
    else acc.push({ family_number: member.family_number, members: [member] });
    return acc;
  }, []);

  const totalGroups = grouped.length;
  const paginatedGroups = grouped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(totalGroups / PAGE_SIZE);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleFamily(members: Member[]) {
    const allSelected = members.every(m => selectedIds.has(m.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      members.forEach(m => allSelected ? next.delete(m.id) : next.add(m.id));
      return next;
    });
  }

  async function handleDelete() {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} member(s)? This cannot be undone.`)) return;
    setDeleting(true);

    const deletedNames = members
      .filter(m => selectedIds.has(m.id))
      .map(m => m.member_name);

    await supabase.from('members').delete().in('id', Array.from(selectedIds));

    if (profile) {
      logActivity(
        profile.id,
        drilledChurchId || profile.church_id || null,
        'delete',
        'member',
        Array.from(selectedIds).join(','),
        `Deleted ${selectedIds.size} member(s): ${deletedNames.join(', ')}`
      );
    }

    setSelectedIds(new Set());
    await fetchMembers();
    setDeleting(false);
  }

  function handleExportCSV() {
    const exportData = filtered.map(m => ({
      family_number: m.family_number,
      member_name: m.member_name,
      address: m.address,
      email: m.email,
      mobile: m.mobile,
    }));
    const churchName = drilledChurch?.name || profile?.church?.name || 'church';
    exportMembersToExcel(exportData as any, churchName);
  }

  function handleExportPDF() {
    const rows = filtered.map(m => `
      <tr>
        <td>${m.family_number}</td>
        <td>${m.member_name}</td>
        <td>${m.address}</td>
        <td>${m.email}</td>
        <td>${m.mobile}</td>
      </tr>
    `).join('');

    const table = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Family Number</th>
            <th>Member Name</th>
            <th>Address</th>
            <th>Email</th>
            <th>Mobile</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    const churchName = drilledChurch?.name || profile?.church?.name || 'church';
    generatePDF(`Members - ${churchName}`, table, `members-${churchName}`);
  }

  // ─── Church folder view (super admin, no drill-in) ───
  if (isSuperAdmin && viewMode === 'churches' && !drilledChurchId) {
    const filteredChurches = churchFolders.filter(c => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.location && c.location.toLowerCase().includes(q));
    });

    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Members</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {churchFolders.length} church{churchFolders.length !== 1 ? 'es' : ''} · {churchFolders.reduce((s, c) => s + c.memberCount, 0)} total members
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('churches')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'churches' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Folder className="w-4 h-4 inline mr-1.5" />
                By Church
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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

        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search churches by name or location..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredChurches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Church className="w-12 h-12 mb-3 opacity-40" />
            <p className="font-medium">{searchQuery ? 'No churches match your search' : 'No churches found'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChurches.map((c, i) => {
              const colors = ['bg-teal-500', 'bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-rose-500', 'bg-cyan-500'];
              const colorClass = colors[i % colors.length];
              return (
                <button
                  key={c.id}
                  onClick={() => setDrilledChurchId(c.id)}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all p-5 text-left group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${colorClass} group-hover:scale-105 transition-transform`}>
                      <Folder className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 leading-tight group-hover:text-teal-700 transition-colors">{c.name}</h3>
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <p className="text-xs text-slate-500 truncate">{c.location || 'Location not set'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-600 transition-colors flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-slate-800">{c.memberCount}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Members</p>
                    </div>
                    <div className="flex-1 bg-teal-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-teal-700">{c.familyCount}</p>
                      <p className="text-xs text-teal-600 mt-0.5">Families</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Drilled-in church view or flat member list ───
  const showBackToChurches = isSuperAdmin && viewMode === 'churches' && drilledChurchId;
  const headerTitle = showBackToChurches ? drilledChurch?.name || 'Church' : 'Members';
  const headerSubtitle = showBackToChurches
    ? drilledChurch?.location || ''
    : `${filtered.length} member${filtered.length !== 1 ? 's' : ''} in ${grouped.length} famil${grouped.length !== 1 ? 'ies' : 'y'}`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {showBackToChurches && (
            <button
              onClick={() => { setDrilledChurchId(null); setSelectedIds(new Set()); }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Churches</span>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {showBackToChurches && <Church className="w-6 h-6 text-teal-600" />}
              {headerTitle}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && !showBackToChurches && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => { setViewMode('churches'); setDrilledChurchId(null); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'churches' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Folder className="w-4 h-4 inline mr-1.5" />
                By Church
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                All
              </button>
            </div>
          )}
          <button
            onClick={fetchMembers}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 border-l border-slate-300 pl-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors border border-green-200"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition-colors border border-orange-200"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors border border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by name, family number, email, or mobile..."
            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
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
      </div>

      {searchQuery && (
        <div className="mb-4 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
          <Search className="w-4 h-4 text-teal-600" />
          <span className="text-sm text-teal-700">
            Showing results for "<strong>{searchQuery}</strong>" — {filtered.length} member(s) found
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Users className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">{searchQuery ? 'No members match your search' : 'No members found'}</p>
          <p className="text-sm mt-1">{searchQuery ? 'Try a different search term' : 'Add members to get started'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedGroups.map(group => {
            const allSelected = group.members.every(m => selectedIds.has(m.id));
            const someSelected = group.members.some(m => selectedIds.has(m.id));

            return (
              <div key={group.family_number} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer group hover:bg-teal-50 transition-colors"
                  onClick={() => onNavigate({ page: 'member-detail', familyNumber: group.family_number })}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={e => { e.stopPropagation(); toggleFamily(group.members); }}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-teal-600"
                  />
                  <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Home className="w-4 h-4 text-teal-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-slate-800">Family: {group.family_number}</span>
                    <span className="ml-2 text-xs text-slate-500">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                </div>

                <div className="divide-y divide-slate-100">
                  {group.members.map(member => (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedIds.has(member.id) ? 'bg-teal-50' : ''}`}
                      onClick={() => onNavigate({ page: 'member-detail', memberId: member.id, familyNumber: member.family_number })}
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
                        <p className="text-sm font-medium text-slate-800 truncate">{member.member_name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.mobile || member.email || member.address || 'No contact info'}</p>
                      </div>
                      {isSuperAdmin && viewMode === 'all' && (member as Member & { church?: { name: string } }).church && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full hidden sm:inline">
                          {(member as Member & { church?: { name: string } }).church?.name}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  ))}
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
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 px-2">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-100 transition-colors"
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
