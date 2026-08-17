import { useState, useEffect } from 'react';
import { UserPlus, RefreshCw, Shield, User, Mail, Phone, X, Save, Eye, EyeOff, Church as ChurchIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Church } from '../../types';
import { logActivity } from '../../utils/activityLogger';
import { useAuth } from '../../context/AuthContext';

interface AdminProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  church_id: string | null;
  church?: { name: string } | null;
  is_approved: boolean;
  created_at?: string;
}

export default function AdminsPage() {
  const { profile } = useAuth();
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({ email: '', password: '', full_name: '', mobile: '', role: 'church_admin', church_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async function fetchData() {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*, church:churches(name)')
        .order('role')
        .order('full_name');

      if (profilesError) throw profilesError;
      setAdmins(profilesData || []);

      const { data: churchData } = await supabase.from('churches').select('*').order('name');
      setChurches(churchData || []);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password || !form.full_name) { setError('Name, email, and password are required.'); return; }
    if (form.role === 'church_admin' && !form.church_id) { setError('Select a church for church admins.'); return; }

    setSaving(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { role: form.role } },
      });

      if (signUpError || !authData.user) {
        setError(signUpError?.message || 'Failed to create account.');
        setSaving(false);
        return;
      }

      // Use edge function to create profile and set app_metadata
      const isApproved = form.role === 'super_admin';
      const createResponse = await fetch(`${supabaseUrl}/functions/v1/create_account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          user_id: authData.user.id,
          email: form.email,
          role: form.role,
          church_id: form.role === 'church_admin' ? form.church_id : null,
          full_name: form.full_name,
          mobile: form.mobile,
          is_approved: isApproved,
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        setError(createData.error || 'Failed to create profile');
      } else {
        const logChurchId = form.role === 'church_admin' ? form.church_id : (profile?.church_id || null);
        logActivity(
          profile?.id || authData.user.id,
          logChurchId,
          'create',
          'admin',
          authData.user.id,
          `Created ${form.role}: ${form.full_name} (${form.email})`
        );
        await supabase.auth.signOut();
        setShowAdd(false);
        setForm({ email: '', password: '', full_name: '', mobile: '', role: 'church_admin', church_id: '' });
        await fetchData();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    }
    setSaving(false);
  }

  const superCount = admins.filter(a => a.role === 'super_admin').length;
  const churchCount = admins.filter(a => a.role === 'church_admin').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage super admins and church admins</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <UserPlus className="w-4 h-4" />
            Add Admin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Admins</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{admins.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Super Admins</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{superCount}</p>
            </div>
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-teal-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Church Admins</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{churchCount}</p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <ChurchIcon className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Church</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map(admin => (
                <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${admin.role === 'super_admin' ? 'bg-teal-600' : 'bg-blue-500'}`}>
                        {admin.full_name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{admin.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500 md:hidden">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600"><Mail className="w-3 h-3 text-slate-400" />{admin.email || '—'}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600"><Phone className="w-3 h-3 text-slate-400" />{admin.mobile || '—'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      admin.role === 'super_admin' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {admin.role === 'super_admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {admin.role === 'super_admin' ? 'Super Admin' : 'Church Admin'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-slate-600">{(admin.church as { name: string } | null)?.name || (admin.role === 'super_admin' ? 'All Churches' : '—')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      admin.is_approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {admin.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No admins found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Add Admin User</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-800" placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-800" placeholder="email@church.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                  <input type="tel" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-800" placeholder="9876543210" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-slate-800" placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-800">
                    <option value="church_admin">Church Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                {form.role === 'church_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Church *</label>
                    <select value={form.church_id} onChange={e => setForm(p => ({ ...p, church_id: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-slate-800">
                      <option value="">Select church</option>
                      {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors">
                  <Save className="w-4 h-4" />
                  {saving ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
