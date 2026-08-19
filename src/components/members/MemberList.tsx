import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  UserPlus,
  Trash2,
  Search,
  Users,
  ChevronRight,
  Home,
  Download,
  FileText,
  X,
  Church,
  Folder,
  ArrowLeft,
  MapPin,
  IndianRupee
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  Member,
  Church as ChurchType,
  NavState
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import AddMemberModal from './AddMemberModal';
import {
  generatePDF
} from '../../utils/export';
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

interface SubscriptionRow {
  id?: string;
  member_id?: string | null;
  memberId?: string | null;
  family_number?: string | number | null;
  family_no?: string | number | null;
  church_id?: string | null;

  sandha?: number | string | null;
  kattida_nidhi?: number | string | null;
  aalaya_paraamarippu?: number | string | null;
  narseidhi_thiruppani?: number | string | null;
  yezhaiyar_nidhi?: number | string | null;
  pengal_thiruppani?: number | string | null;
  aangal_thiruppani?: number | string | null;
  ilainyar_thiruppani?: number | string | null;
  siruvar_thiruppani?: number | string | null;
  girama_nidhi?: number | string | null;
  kalvi_nidhi?: number | string | null;

  [key: string]: unknown;
}

export default function MemberList({
  searchQuery,
  onNavigate,
  onSearchChange
}: MemberListProps) {
  const { profile } = useAuth();

  const isSuperAdmin =
    profile?.role === 'super_admin';

  const [members, setMembers] =
    useState<Member[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    memberContributionTotals,
    setMemberContributionTotals
  ] = useState<Record<string, number>>({});

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(new Set());

  const [deleting, setDeleting] =
    useState(false);

  const [page, setPage] =
    useState(1);

  const PAGE_SIZE = 30;

  const [viewMode, setViewMode] =
    useState<'all' | 'churches'>(
      'churches'
    );

  const [
    churchFolders,
    setChurchFolders
  ] = useState<ChurchFolder[]>([]);

  const [
    drilledChurchId,
    setDrilledChurchId
  ] = useState<string | null>(null);

  const [
    drilledChurch,
    setDrilledChurch
  ] = useState<ChurchType | null>(null);

  function toNumber(
    value: unknown
  ): number {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value)
        ? value
        : 0;
    }

    const cleanedValue = String(value)
      .replace(/₹/g, '')
      .replace(/,/g, '')
      .trim();

    const numberValue =
      Number(cleanedValue);

    return Number.isNaN(numberValue)
      ? 0
      : numberValue;
  }

  function normalizeValue(
    value: unknown
  ): string {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return String(value)
      .trim()
      .toLowerCase();
  }

  function calculateSubscriptionTotal(
    subscription: SubscriptionRow
  ): number {
    return (
      toNumber(subscription.sandha) +
      toNumber(subscription.kattida_nidhi) +
      toNumber(
        subscription.aalaya_paraamarippu
      ) +
      toNumber(
        subscription.narseidhi_thiruppani
      ) +
      toNumber(
        subscription.yezhaiyar_nidhi
      ) +
      toNumber(
        subscription.pengal_thiruppani
      ) +
      toNumber(
        subscription.aangal_thiruppani
      ) +
      toNumber(
        subscription.ilainyar_thiruppani
      ) +
      toNumber(
        subscription.siruvar_thiruppani
      ) +
      toNumber(
        subscription.girama_nidhi
      ) +
      toNumber(
        subscription.kalvi_nidhi
      )
    );
  }

  const fetchContributionTotals =
    useCallback(
      async (memberList: Member[]) => {
        try {
          if (
            !memberList ||
            memberList.length === 0
          ) {
            setMemberContributionTotals({});
            return;
          }

          const totals: Record<
            string,
            number
          > = {};

          memberList.forEach(member => {
            totals[member.id] = 0;
          });

          const { data, error } =
            await supabase
              .from('subscriptions')
              .select('*');

          if (error) {
            console.error(
              'Error fetching subscriptions:',
              error
            );

            setMemberContributionTotals(
              totals
            );
            return;
          }

          const subscriptions =
            (data || []) as SubscriptionRow[];

          if (subscriptions.length === 0) {
            setMemberContributionTotals(
              totals
            );
            return;
          }

          memberList.forEach(member => {
            const normalizedMemberId =
              normalizeValue(member.id);

            const normalizedFamilyNumber =
              normalizeValue(
                member.family_number
              );

            let memberTotal = 0;

            subscriptions.forEach(
              subscription => {
                const subscriptionMemberId =
                  normalizeValue(
                    subscription.member_id ||
                      subscription.memberId
                  );

                const subscriptionFamilyNumber =
                  normalizeValue(
                    subscription.family_number ||
                      subscription.family_no
                  );

                const memberIdMatches =
                  subscriptionMemberId !== '' &&
                  subscriptionMemberId ===
                    normalizedMemberId;

                const familyNumberMatches =
                  subscriptionFamilyNumber !== '' &&
                  normalizedFamilyNumber !== '' &&
                  subscriptionFamilyNumber ===
                    normalizedFamilyNumber;

                if (
                  memberIdMatches ||
                  familyNumberMatches
                ) {
                  memberTotal +=
                    calculateSubscriptionTotal(
                      subscription
                    );
                }
              }
            );

            totals[member.id] =
              memberTotal;
          });

          setMemberContributionTotals(
            totals
          );
        } catch (error) {
          console.error(
            'Contribution total calculation error:',
            error
          );

          const fallbackTotals: Record<
            string,
            number
          > = {};

          memberList.forEach(member => {
            fallbackTotals[member.id] = 0;
          });

          setMemberContributionTotals(
            fallbackTotals
          );
        }
      },
      []
    );

  const fetchMembers = useCallback(
    async () => {
      setLoading(true);

      try {
        let query = supabase
          .from('members')
          .select(
            '*, church:churches(id,name,location)'
          )
          .order('family_number', {
            ascending: true
          })
          .order('member_name', {
            ascending: true
          });

        if (
          isSuperAdmin &&
          drilledChurchId
        ) {
          query = query.eq(
            'church_id',
            drilledChurchId
          );
        } else if (
          profile?.role ===
            'church_admin' &&
          profile.church_id
        ) {
          query = query.eq(
            'church_id',
            profile.church_id
          );
        }

        const { data, error } =
          await query;

        if (error) {
          console.error(
            'Error fetching members:',
            error
          );

          setMembers([]);
          setMemberContributionTotals({});
          return;
        }

        const memberData =
          (data || []) as Member[];

        setMembers(memberData);

        await fetchContributionTotals(
          memberData
        );
      } catch (error) {
        console.error(
          'Error fetching members:',
          error
        );

        setMembers([]);
        setMemberContributionTotals({});
      } finally {
        setLoading(false);
      }
    },
    [
      profile,
      isSuperAdmin,
      drilledChurchId,
      fetchContributionTotals
    ]
  );

  const fetchChurchFolders =
    useCallback(async () => {
      setLoading(true);

      try {
        const [
          churchRes,
          memberRes
        ] = await Promise.all([
          supabase
            .from('churches')
            .select(
              'id, name, location'
            )
            .order('name'),

          supabase
            .from('members')
            .select(
              'id, church_id, family_number'
            )
        ]);

        if (churchRes.error) {
          console.error(
            'Error fetching churches:',
            churchRes.error
          );
        }

        if (memberRes.error) {
          console.error(
            'Error fetching members:',
            memberRes.error
          );
        }

        const churches =
          churchRes.data || [];

        const allMembers =
          memberRes.data || [];

        const folders: ChurchFolder[] =
          churches.map(c => {
            const churchMembers =
              allMembers.filter(
                m =>
                  m.church_id === c.id
              );

            const families = new Set(
              churchMembers
                .map(
                  m => m.family_number
                )
                .filter(Boolean)
            );

            return {
              id: c.id,
              name: c.name,
              location:
                c.location || '',
              memberCount:
                churchMembers.length,
              familyCount:
                families.size
            };
          });

        setChurchFolders(folders);
      } catch (error) {
        console.error(
          'Error fetching church folders:',
          error
        );

        setChurchFolders([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    if (
      isSuperAdmin &&
      viewMode === 'churches' &&
      !drilledChurchId
    ) {
      fetchChurchFolders();
    } else {
      fetchMembers();
    }
  }, [
    fetchMembers,
    fetchChurchFolders,
    isSuperAdmin,
    viewMode,
    drilledChurchId
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    searchQuery,
    drilledChurchId,
    viewMode
  ]);

  useEffect(() => {
    if (drilledChurchId) {
      supabase
        .from('churches')
        .select('*')
        .eq(
          'id',
          drilledChurchId
        )
        .maybeSingle()
        .then(
          ({ data, error }) => {
            if (error) {
              console.error(
                'Error fetching selected church:',
                error
              );

              setDrilledChurch(null);
              return;
            }

            setDrilledChurch(
              data as ChurchType | null
            );
          }
        );
    } else {
      setDrilledChurch(null);
    }
  }, [drilledChurchId]);

  const filtered = members.filter(
    member => {
      if (!searchQuery) {
        return true;
      }

      const q =
        searchQuery.toLowerCase();

      return (
        member.member_name
          .toLowerCase()
          .includes(q) ||
        member.family_number
          .toLowerCase()
          .includes(q) ||
        (member.email &&
          member.email
            .toLowerCase()
            .includes(q)) ||
        (member.mobile &&
          member.mobile.includes(q))
      );
    }
  );

  const grouped: FamilyGroup[] =
    filtered.reduce<FamilyGroup[]>(
      (acc, member) => {
        const existing =
          acc.find(
            group =>
              group.family_number ===
              member.family_number
          );

        if (existing) {
          existing.members.push(
            member
          );
        } else {
          acc.push({
            family_number:
              member.family_number,
            members: [member]
          });
        }

        return acc;
      },
      []
    );

  const totalGroups =
    grouped.length;

  const paginatedGroups =
    grouped.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );

  const totalPages =
    Math.ceil(
      totalGroups / PAGE_SIZE
    );

  function formatCurrency(
    amount: number
  ) {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    ).format(amount || 0);
  }

  function getMemberGrandTotal(
    memberId: string
  ) {
    return (
      memberContributionTotals[
        memberId
      ] || 0
    );
  }

  function escapeCSVValue(
    value: unknown
  ): string {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    const stringValue =
      String(value);

    return `"${stringValue.replace(
      /"/g,
      '""'
    )}"`;
  }

  /**
   * Download CSV directly.
   *
   * This does not depend on exportMembersToExcel,
   * so both column names AND actual member data
   * will be written into the downloaded file.
   */
  function handleExportCSV() {
    try {
      const headers = [
        'Family Number',
        'Member Name',
        'Address',
        'Email',
        'Mobile',
        'Grand Total Contribution (INR)'
      ];

      const rows = filtered.map(
        member => {
          const grandTotal =
            getMemberGrandTotal(
              member.id
            );

          return [
            member.family_number || '',
            member.member_name || '',
            member.address || '',
            member.email || '',
            member.mobile || '',
            grandTotal.toFixed(2)
          ];
        }
      );

      const csvContent = [
        headers.map(
          escapeCSVValue
        ).join(','),

        ...rows.map(row =>
          row
            .map(
              escapeCSVValue
            )
            .join(',')
        )
      ].join('\n');

      const BOM = '\uFEFF';

      const blob = new Blob(
        [BOM + csvContent],
        {
          type:
            'text/csv;charset=utf-8;'
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      const churchName =
        drilledChurch?.name ||
        profile?.church?.name ||
        'church';

      const safeChurchName =
        churchName
          .replace(
            /[^a-z0-9]/gi,
            '-'
          )
          .replace(
            /-+/g,
            '-'
          )
          .replace(
            /^-|-$/g,
            ''
          );

      link.href = url;

      link.setAttribute(
        'download',
        `${safeChurchName || 'church'}-members-with-contributions.csv`
      );

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(
        url
      );
    } catch (error) {
      console.error(
        'Error exporting CSV:',
        error
      );

      alert(
        'Failed to export CSV. Please try again.'
      );
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleFamily(
    familyMembers: Member[]
  ) {
    const allSelected =
      familyMembers.every(member =>
        selectedIds.has(member.id)
      );

    setSelectedIds(prev => {
      const next = new Set(prev);

      familyMembers.forEach(
        member => {
          if (allSelected) {
            next.delete(member.id);
          } else {
            next.add(member.id);
          }
        }
      );

      return next;
    });
  }

  async function handleDelete() {
    if (!selectedIds.size) {
      return;
    }

    if (
      !confirm(
        `Delete ${selectedIds.size} member(s)? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);

    try {
      const deletedNames = members
        .filter(member =>
          selectedIds.has(member.id)
        )
        .map(
          member =>
            member.member_name
        );

      const { error } =
        await supabase
          .from('members')
          .delete()
          .in(
            'id',
            Array.from(selectedIds)
          );

      if (error) {
        console.error(
          'Error deleting members:',
          error
        );

        alert(
          'Failed to delete member(s).'
        );

        return;
      }

      if (profile) {
        await logActivity(
          profile.id,
          drilledChurchId ||
            profile.church_id ||
            null,
          'delete',
          'member',
          Array.from(
            selectedIds
          ).join(','),
          `Deleted ${selectedIds.size} member(s): ${deletedNames.join(
            ', '
          )}`
        );
      }

      setSelectedIds(new Set());

      await fetchMembers();
    } catch (error) {
      console.error(
        'Error deleting members:',
        error
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleExportPDF() {
    const rows = filtered
      .map(
        member => `
          <tr>
            <td>${member.family_number || ''}</td>
            <td>${member.member_name || ''}</td>
            <td>${member.address || ''}</td>
            <td>${member.email || ''}</td>
            <td>${member.mobile || ''}</td>
            <td>${formatCurrency(
              getMemberGrandTotal(member.id)
            )}</td>
          </tr>
        `
      )
      .join('');

    const table = `
      <table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Family Number</th>
            <th>Member Name</th>
            <th>Address</th>
            <th>Email</th>
            <th>Mobile</th>
            <th>Grand Total Contribution</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    const churchName =
      drilledChurch?.name ||
      profile?.church?.name ||
      'church';

    generatePDF(
      `Members - ${churchName}`,
      table,
      `members-${churchName}`
    );
  }

  if (
    isSuperAdmin &&
    viewMode === 'churches' &&
    !drilledChurchId
  ) {
    const filteredChurches =
      churchFolders.filter(church => {
        if (!searchQuery) {
          return true;
        }

        const q =
          searchQuery.toLowerCase();

        return (
          church.name
            .toLowerCase()
            .includes(q) ||
          (church.location &&
            church.location
              .toLowerCase()
              .includes(q))
        );
      });

    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Members
            </h1>

            <p className="text-slate-500 text-sm mt-0.5">
              {churchFolders.length} church
              {churchFolders.length !== 1
                ? 'es'
                : ''}{' '}
              ·{' '}
              {churchFolders.reduce(
                (sum, church) =>
                  sum +
                  church.memberCount,
                0
              )}{' '}
              total members
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() =>
                  setViewMode(
                    'churches'
                  )
                }
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode ===
                  'churches'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Folder className="w-4 h-4 inline mr-1.5" />
                By Church
              </button>

              <button
                onClick={() =>
                  setViewMode('all')
                }
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                All Members
              </button>
            </div>

            <button
              onClick={
                fetchChurchFolders
              }
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
              onChange={event =>
                onSearchChange(
                  event.target.value
                )
              }
              placeholder="Search churches by name or location..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />

            {searchQuery && (
              <button
                onClick={() =>
                  onSearchChange('')
                }
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
        ) : filteredChurches.length ===
          0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Church className="w-12 h-12 mb-3 opacity-40" />

            <p className="font-medium">
              {searchQuery
                ? 'No churches match your search'
                : 'No churches found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChurches.map(
              (church, index) => {
                const colors = [
                  'bg-teal-500',
                  'bg-blue-500',
                  'bg-amber-500',
                  'bg-green-500',
                  'bg-rose-500',
                  'bg-cyan-500'
                ];

                const colorClass =
                  colors[
                    index % colors.length
                  ];

                return (
                  <button
                    key={church.id}
                    onClick={() =>
                      setDrilledChurchId(
                        church.id
                      )
                    }
                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all p-5 text-left group"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${colorClass} group-hover:scale-105 transition-transform`}
                      >
                        <Folder className="w-6 h-6 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 leading-tight group-hover:text-teal-700 transition-colors">
                          {church.name}
                        </h3>

                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-slate-400" />

                          <p className="text-xs text-slate-500 truncate">
                            {church.location ||
                              'Location not set'}
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-600 transition-colors flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-slate-800">
                          {
                            church.memberCount
                          }
                        </p>

                        <p className="text-xs text-slate-500 mt-0.5">
                          Members
                        </p>
                      </div>

                      <div className="flex-1 bg-teal-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-teal-700">
                          {
                            church.familyCount
                          }
                        </p>

                        <p className="text-xs text-teal-600 mt-0.5">
                          Families
                        </p>
                      </div>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    );
  }

  const showBackToChurches =
    isSuperAdmin &&
    viewMode === 'churches' &&
    drilledChurchId;

  const headerTitle =
    showBackToChurches
      ? drilledChurch?.name ||
        'Church'
      : 'Members';

  const headerSubtitle =
    showBackToChurches
      ? drilledChurch?.location || ''
      : `${filtered.length} member${
          filtered.length !== 1
            ? 's'
            : ''
        } in ${grouped.length} famil${
          grouped.length !== 1
            ? 'ies'
            : 'y'
        }`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {showBackToChurches && (
            <button
              onClick={() => {
                setDrilledChurchId(
                  null
                );
                setSelectedIds(
                  new Set()
                );
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">
                Churches
              </span>
            </button>
          )}

          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {showBackToChurches && (
                <Church className="w-6 h-6 text-teal-600" />
              )}

              {headerTitle}
            </h1>

            <p className="text-slate-500 text-sm mt-0.5">
              {headerSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin &&
            !showBackToChurches && (
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => {
                    setViewMode(
                      'churches'
                    );
                    setDrilledChurchId(
                      null
                    );
                  }}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode ===
                    'churches'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Folder className="w-4 h-4 inline mr-1.5" />
                  By Church
                </button>

                <button
                  onClick={() =>
                    setViewMode('all')
                  }
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
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
                onClick={
                  handleExportCSV
                }
                className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors border border-green-200"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>

              <button
                onClick={
                  handleExportPDF
                }
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
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors border border-red-200 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </button>
          )}

          <button
            onClick={() =>
              setShowAddModal(true)
            }
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
            onChange={event =>
              onSearchChange(
                event.target.value
              )
            }
            placeholder="Search by name, family number, email, or mobile..."
            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />

          {searchQuery && (
            <button
              onClick={() =>
                onSearchChange('')
              }
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
            Showing results for "
            <strong>
              {searchQuery}
            </strong>
            " — {filtered.length} member(s) found
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedGroups.length ===
        0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Users className="w-12 h-12 mb-3 opacity-40" />

          <p className="font-medium">
            {searchQuery
              ? 'No members match your search'
              : 'No members found'}
          </p>

          <p className="text-sm mt-1">
            {searchQuery
              ? 'Try a different search term'
              : 'Add members to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedGroups.map(
            group => {
              const allSelected =
                group.members.every(
                  member =>
                    selectedIds.has(
                      member.id
                    )
                );

              const someSelected =
                group.members.some(
                  member =>
                    selectedIds.has(
                      member.id
                    )
                );

              return (
                <div
                  key={
                    group.family_number
                  }
                  className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer group hover:bg-teal-50 transition-colors"
                    onClick={() =>
                      onNavigate({
                        page:
                          'member-detail',
                        familyNumber:
                          group.family_number
                      })
                    }
                  >
                    <input
                      type="checkbox"
                      checked={
                        allSelected
                      }
                      ref={element => {
                        if (element) {
                          element.indeterminate =
                            someSelected &&
                            !allSelected;
                        }
                      }}
                      onChange={event => {
                        event.stopPropagation();
                        toggleFamily(
                          group.members
                        );
                      }}
                      onClick={event =>
                        event.stopPropagation()
                      }
                      className="w-4 h-4 rounded accent-teal-600"
                    />

                    <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Home className="w-4 h-4 text-teal-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-slate-800">
                        Family:{' '}
                        {
                          group.family_number
                        }
                      </span>

                      <span className="ml-2 text-xs text-slate-500">
                        {
                          group.members
                            .length
                        }{' '}
                        member
                        {group.members
                          .length !== 1
                          ? 's'
                          : ''}
                      </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.members.map(
                      member => {
                        const grandTotal =
                          getMemberGrandTotal(
                            member.id
                          );

                        return (
                          <div
                            key={
                              member.id
                            }
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                              selectedIds.has(
                                member.id
                              )
                                ? 'bg-teal-50'
                                : ''
                            }`}
                            onClick={() =>
                              onNavigate({
                                page:
                                  'member-detail',
                                memberId:
                                  member.id,
                                familyNumber:
                                  member.family_number
                              })
                            }
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(
                                member.id
                              )}
                              onChange={event => {
                                event.stopPropagation();

                                toggleSelect(
                                  member.id
                                );
                              }}
                              onClick={event =>
                                event.stopPropagation()
                              }
                              className="w-4 h-4 rounded accent-teal-600"
                            />

                            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-slate-600">
                                {member.member_name
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {
                                  member.member_name
                                }
                              </p>

                              <p className="text-xs text-slate-500 truncate">
                                {member.mobile ||
                                  member.email ||
                                  member.address ||
                                  'No contact info'}
                              </p>
                            </div>

                            {isSuperAdmin &&
                              viewMode ===
                                'all' &&
                              (
                                member as Member & {
                                  church?: {
                                    name: string;
                                  };
                                }
                              ).church && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full hidden lg:inline">
                                  {
                                    (
                                      member as Member & {
                                        church?: {
                                          name: string;
                                        };
                                      }
                                    ).church?.name
                                  }
                                </span>
                              )}

                            <div
                              className="hidden sm:flex flex-col items-end min-w-[150px] px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg"
                              onClick={event =>
                                event.stopPropagation()
                              }
                            >
                              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                <IndianRupee className="w-3 h-3" />
                                Grand Total
                              </div>

                              <p className="text-sm font-bold text-emerald-700 mt-0.5">
                                {formatCurrency(
                                  grandTotal
                                )}
                              </p>
                            </div>

                            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() =>
              setPage(previous =>
                Math.max(
                  1,
                  previous - 1
                )
              )
            }
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >
            Previous
          </button>

          <span className="text-sm text-slate-600 px-2">
            Page {page} of{' '}
            {totalPages}
          </span>

          <button
            onClick={() =>
              setPage(previous =>
                Math.min(
                  totalPages,
                  previous + 1
                )
              )
            }
            disabled={
              page === totalPages
            }
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {showAddModal && (
        <AddMemberModal
          onClose={() =>
            setShowAddModal(false)
          }
          onSave={() => {
            setShowAddModal(false);
            fetchMembers();
          }}
          defaultChurchId={
            drilledChurchId ||
            profile?.church_id ||
            undefined
          }
        />
      )}
    </div>
  );
}