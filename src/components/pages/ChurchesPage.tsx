import { useState, useEffect } from 'react';
import { Church, MapPin, Users, RefreshCw, Plus, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

interface ChurchData {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  familyCount: number;
}

export default function ChurchesPage() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [churches, setChurches] = useState<ChurchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchChurches() {
    setLoading(true);
    const { data: churchData } = await supabase.from('churches').select('*').order('name');
    if (!churchData) { setLoading(false); return; }

    const { data: memberData } = await supabase.from('members').select('church_id, family_number');

    const enriched: ChurchData[] = churchData.map(c => {
      const members = memberData?.filter(m => m.church_id === c.id) || [];
      const families = new Set(members.map(m => m.family_number));
      return {
        id: c.id,
        name: c.name,
        location: c.location || '',
        memberCount: members.length,
        familyCount: families.size,
      };
    });

    setChurches(enriched);
    setLoading(false);
  }

  useEffect(() => { fetchChurches(); }, []);

  async function handleAddChurch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Church name is required.'); return; }

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from('churches')
      .insert({ name: form.name.trim(), location: form.location.trim() })
      .select('id')
      .maybeSingle();

    if (insertError || !data) {
      setError(insertError?.message || 'Failed to add church.');
      setSaving(false);
      return;
    }

    if (profile) {
      logActivity(
        profile.id,
        profile.church_id || null,
        'create',
        'church',
        data.id,
        `Created church: ${form.name.trim()}`,
        { name: form.name.trim(), location: form.location.trim() }
      );
    }

    setShowAddModal(false);
    setForm({ name: '', location: '' });
    setSaving(false);
    await fetchChurches();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Church Branches</h1>
          <p className="text-slate-500 text-sm mt-0.5">{churches.length} branches registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchChurches}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Church
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {churches.map((c, i) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  ['bg-teal-500', 'bg-blue-500', 'bg-amber-500', 'bg-green-500', 'bg-rose-500', 'bg-cyan-500'][i % 6]
                }`}>
                  <Church className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 leading-tight">{c.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <p className="text-xs text-slate-500">{c.location || 'Location not set'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-slate-800">{c.memberCount}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Members</p>
                </div>
                <div className="flex-1 bg-teal-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-teal-700">{c.familyCount}</p>
                  <p className="text-xs text-teal-600 mt-0.5">Families</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${c.memberCount > 0 ? 'bg-green-400' : 'bg-slate-300'}`} />
                <span className="text-slate-500">{c.memberCount > 0 ? 'Active' : 'No members yet'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
        <Users className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-teal-800">Total across all branches</p>
          <p className="text-xs text-teal-600 mt-0.5">
            {churches.reduce((s, c) => s + c.memberCount, 0)} total members,{' '}
            {churches.reduce((s, c) => s + c.familyCount, 0)} total families
          </p>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Add New Church</h2>
              <button onClick={() => { setShowAddModal(false); setError(''); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddChurch} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Church Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. St. Mary's Church, Chennai"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. 123 Main St, Chennai, TN"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setError(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Adding...' : 'Add Church'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
