import { useState, useEffect } from 'react';
import { RefreshCw, Activity, Filter, X, ChevronDown, ChevronUp, User, Calendar, CreditCard as Edit3, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ActivityLog {
  id: string;
  admin_id: string;
  church_id: string;
  action_type: string;
  target_type: string;
  target_id?: string;
  description: string;
  changes: Record<string, any>;
  created_at: string;
  admin?: { full_name: string; email: string };
  church?: { name: string };
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  member: 'Member',
  subscription: 'Contributions',
  building_construction_fund: 'Building Fund',
  admin_approval: 'Account Approval',
  circular: 'Circular',
  harvest_festival: 'Harvest Festival',
  church: 'Church',
};

export default function ActivityLogsPage() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterTargetType, setFilterTargetType] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  async function fetchLogs() {
    setLoading(true);
    let query = supabase
      .from('activity_logs')
      .select('*, admin:profiles!fk_activity_logs_admin_id(full_name,email), church:churches!activity_logs_church_id_fkey(name)')
      .order('created_at', { ascending: false });

    if (!isSuperAdmin && profile?.church_id) {
      query = query.eq('church_id', profile.church_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch activity logs:', error);
    } else if (data) {
      setLogs(data as ActivityLog[]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchLogs(); }, [isSuperAdmin, profile?.church_id]);

  const filtered = logs
    .filter(l => filterType === 'all' || l.action_type === filterType)
    .filter(l => filterTargetType === 'all' || l.target_type === filterTargetType);

  const actionTypes = ['create', 'update', 'delete'];
  const targetTypes = [...new Set(logs.map(l => l.target_type))].sort();
  const paginatedLogs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function getActionColor(actionType: string) {
    switch (actionType) {
      case 'create': return 'bg-green-100 text-green-700';
      case 'update': return 'bg-blue-100 text-blue-700';
      case 'delete': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  function renderDetailedChanges(log: ActivityLog) {
    const changes = log.changes;
    if (!changes?.monthChanges || changes.monthChanges.length === 0) {
      return null;
    }

    const isSubscription = log.target_type === 'subscription';
    const isBuildingFund = log.target_type === 'building_construction_fund';
    const adminName = log.admin?.full_name || 'Unknown Admin';
    const memberName = changes.memberName || 'Unknown Member';
    const monthsEdited = changes.monthChanges.map((mc: any) => mc.monthName).join(', ');

    return (
      <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
        {/* Summary Header */}
        <div className="bg-white rounded-lg p-3 mb-3 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-bold text-slate-800">Edit Summary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-slate-500">Edited by: </span>
                <span className="font-semibold text-slate-800">{adminName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-teal-500" />
              <div>
                <span className="text-slate-500">Member: </span>
                <span className="font-semibold text-teal-700">{memberName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-slate-500">Year: </span>
                <span className="font-semibold text-amber-700">{changes.year}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <div>
                <span className="text-slate-500">Grand Total: </span>
                <span className="font-bold text-green-700">{isSubscription ? '₹' : 'Rs.'}{changes.grandTotal?.toLocaleString('en-IN') || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Months Edited Badge */}
        <div className="mb-3">
          <span className="text-xs font-semibold text-slate-600">Months Edited: </span>
          <span className="inline-flex flex-wrap gap-1 mt-1">
            {changes.monthChanges.map((mc: any, idx: number) => (
              <span key={idx} className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                {mc.monthName}
              </span>
            ))}
          </span>
        </div>

        {/* Detailed Changes by Month */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Field Changes by Month</p>
          {changes.monthChanges.map((mc: any, idx: number) => (
            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-teal-700">{mc.month}</span>
                </div>
                <span className="text-sm font-bold text-teal-700">{mc.monthName}</span>
              </div>
              {isSubscription && mc.changes && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {mc.changes.map((c: any, cIdx: number) => (
                    <div key={cIdx} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded">
                      <span className="text-xs font-medium text-slate-600">{c.fieldLabel}:</span>
                      <span className="text-xs text-red-500 line-through">₹{c.oldValue.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-slate-400">→</span>
                      <span className="text-xs text-green-600 font-bold">₹{c.newValue.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
              {isBuildingFund && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded">
                  <span className="text-xs font-medium text-slate-600">Amount:</span>
                  <span className="text-xs text-red-500 line-through">Rs.{mc.oldValue.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-slate-400">→</span>
                  <span className="text-xs text-green-600 font-bold">Rs.{mc.newValue.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function toggleLogExpansion(logId: string) {
    setExpandedLogId(prev => prev === logId ? null : logId);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Logs</h1>
          <p className="text-slate-500 text-sm mt-0.5">All admin actions and changes</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Action Type</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setFilterType('all'); setPage(1); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({logs.length})
            </button>
            {actionTypes.map(type => {
              const count = logs.filter(l => l.action_type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => { setFilterType(type); setPage(1); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === type
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Target Type</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setFilterTargetType('all'); setPage(1); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterTargetType === 'all'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Targets
            </button>
            {targetTypes.map(type => {
              const count = logs.filter(l => l.target_type === type).length;
              const label = TARGET_TYPE_LABELS[type] || type;
              return (
                <button
                  key={type}
                  onClick={() => { setFilterTargetType(type); setPage(1); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterTargetType === type
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
          <Activity className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">No activity logs found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date & Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin</th>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Church</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map(log => {
                  const hasDetailedChanges = log.changes?.monthChanges && log.changes.monthChanges.length > 0;
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`hover:bg-slate-50 transition-colors ${hasDetailedChanges ? 'cursor-pointer' : ''}`}
                        onClick={() => hasDetailedChanges && toggleLogExpansion(log.id)}
                      >
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="flex flex-col">
                            <span>{new Date(log.created_at).toLocaleDateString('en-IN')}</span>
                            <span className="text-slate-400">{new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>
                            <p className="font-medium text-slate-800">{log.admin?.full_name || 'Unknown'}</p>
                            <p className="text-slate-500 truncate">{log.admin?.email}</p>
                          </div>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">
                            {log.church?.name || '—'}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action_type)}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700">
                          {TARGET_TYPE_LABELS[log.target_type] || log.target_type}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {hasDetailedChanges ? (
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-800">
                                    {log.admin?.full_name || 'Admin'} edited {log.changes?.memberName || 'member'}'s {log.target_type === 'subscription' ? 'Contributions' : 'Building Fund'}
                                  </p>
                                  <p className="text-slate-500">
                                    Year: {log.changes?.year} | Months: {log.changes?.monthChanges?.map((mc: any) => mc.monthName).join(', ')}
                                  </p>
                                  <p className="text-teal-600 font-medium text-[10px] uppercase tracking-wide">
                                    Click to view field-by-field changes
                                  </p>
                                </div>
                              ) : (
                                <p className="truncate">{log.description}</p>
                              )}
                            </div>
                            {hasDetailedChanges && (
                              <button className="p-1 hover:bg-slate-100 rounded transition-colors flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && hasDetailedChanges && (
                        <tr key={`${log.id}-details`} className="bg-slate-50">
                          <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-3">
                            {renderDetailedChanges(log)}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
