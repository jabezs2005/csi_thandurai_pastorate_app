import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CheckCircle, XCircle, AlertCircle, Clock, Mail, User as UserIcon } from 'lucide-react';
import { Church } from '../../types';
import { logActivity } from '../../utils/activityLogger';

interface PendingAccount {
  id: string;
  email: string | null;
  mobile: string | null;
  role: string;
  church_id: string | null;
  full_name: string | null;
  is_approved: boolean;
  created_at: string;
  church?: Church;
}

export default function AccountApprovalsPage() {
  const { profile } = useAuth();
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    loadPendingAccounts();
  }, []);

  async function loadPendingAccounts() {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*, church:churches(*)')
        .eq('is_approved', false)
        .eq('role', 'church_admin')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setPendingAccounts((data || []) as PendingAccount[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending accounts');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(accountId: string, email: string) {
    if (!profile) return;

    setApproving(prev => ({ ...prev, [accountId]: true }));
    try {
      // Use edge function to update profile and app_metadata
      const response = await fetch(`${supabaseUrl}/functions/v1/manage_approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'approve',
          account_id: accountId,
          admin_id: profile.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve account');
      }

      logActivity(
        profile.id,
        profile.church_id || null,
        'update',
        'admin_approval',
        accountId,
        `Approved account: ${email}`
      );

      setPendingAccounts(prev => prev.filter(acc => acc.id !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve account');
    } finally {
      setApproving(prev => ({ ...prev, [accountId]: false }));
    }
  }

  async function handleReject(accountId: string, email: string) {
    if (!window.confirm(`Are you sure you want to reject the account for ${email}?`)) return;

    setRejecting(prev => ({ ...prev, [accountId]: true }));
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/manage_approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'reject',
          account_id: accountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject account');
      }

      logActivity(
        profile.id,
        profile.church_id || null,
        'delete',
        'admin_approval',
        accountId,
        `Rejected account: ${email}`
      );

      setPendingAccounts(prev => prev.filter(acc => acc.id !== accountId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject account');
    } finally {
      setRejecting(prev => ({ ...prev, [accountId]: false }));
    }
  }

  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>Only super admins can access this page</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Approvals</h1>
        <p className="text-slate-600">Review and approve pending church admin accounts</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pendingAccounts.length === 0 ? (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-8 text-center">
          <CheckCircle className="w-12 h-12 text-teal-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-teal-800 mb-1">All Caught Up!</h2>
          <p className="text-teal-700">No pending account approvals</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendingAccounts.map(account => (
            <div key={account.id} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    <h3 className="text-lg font-semibold text-slate-900">{account.full_name || 'Unnamed'}</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{account.email}</span>
                    </div>
                    {account.mobile && (
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        <span>Mobile: {account.mobile}</span>
                      </div>
                    )}
                    {account.church && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Church:</span>
                        <span className="font-medium text-slate-700">{account.church.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Requested:</span>
                      <span>{new Date(account.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(account.id, account.email || '')}
                  disabled={approving[account.id] || rejecting[account.id]}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {approving[account.id] ? 'Approving...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(account.id, account.email || '')}
                  disabled={rejecting[account.id] || approving[account.id]}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {rejecting[account.id] ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
