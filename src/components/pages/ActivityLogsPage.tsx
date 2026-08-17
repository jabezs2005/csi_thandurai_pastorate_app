import { useState, useEffect } from 'react';
import { RefreshCw, Activity, Filter } from 'lucide-react';
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

export default function ActivityLogsPage() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
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

  const filtered = filterType === 'all'
    ? logs
    : logs.filter(l => l.action_type === filterType);

  const actionTypes = ['create', 'update', 'delete'];
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

      <div className="mb-6 flex flex-wrap gap-2">
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
                {paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(log.created_at).toLocaleDateString('en-IN')}{' '}
                      {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
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
                      {log.target_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                      {log.description}
                    </td>
                  </tr>
                ))}
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
