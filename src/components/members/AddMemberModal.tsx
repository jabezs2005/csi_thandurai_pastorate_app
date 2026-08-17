import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Member, Church } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

interface AddMemberModalProps {
  member?: Member | null;
  onClose: () => void;
  onSave: () => void;
  defaultChurchId?: string;
}

export default function AddMemberModal({ member, onClose, onSave, defaultChurchId }: AddMemberModalProps) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [churches, setChurches] = useState<Church[]>([]);
  const [form, setForm] = useState({
    church_id: member?.church_id || defaultChurchId || '',
    family_number: member?.family_number || '',
    member_name: member?.member_name || '',
    address: member?.address || '',
    email: member?.email || '',
    mobile: member?.mobile || '',
    date_of_birth: member?.date_of_birth || '',
    wedding_date: member?.wedding_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('churches').select('*').order('name').then(({ data }) => {
        if (data) setChurches(data);
      });
    }
  }, [isSuperAdmin]);

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.church_id) { setError('Please select a church.'); return; }
    if (!form.family_number.trim()) { setError('Family number is required.'); return; }
    if (!form.member_name.trim()) { setError('Member name is required.'); return; }

    setSaving(true);
    const payload = {
      church_id: form.church_id,
      family_number: form.family_number.trim().toUpperCase(),
      member_name: form.member_name.trim(),
      address: form.address.trim(),
      email: form.email.trim().toLowerCase(),
      mobile: form.mobile.trim(),
      date_of_birth: form.date_of_birth || null,
      wedding_date: form.wedding_date || null,
    };

    let queryError;
    if (member?.id) {
      ({ error: queryError } = await supabase.from('members').update(payload).eq('id', member.id));
      if (!queryError && profile) {
        logActivity(profile.id, form.church_id, 'update', 'member', member.id, `Updated member: ${payload.member_name}`, payload);
      }
    } else {
      const { data: inserted, error: insertError } = await supabase.from('members').insert(payload).select('id').maybeSingle();
      queryError = insertError;
      if (!insertError && inserted && profile) {
        logActivity(profile.id, form.church_id, 'create', 'member', inserted.id, `Created member: ${payload.member_name}`, payload);
      }
    }

    if (queryError) {
      setError(queryError.message);
    } else {
      onSave();
    }
    setSaving(false);
  }

  const isEditing = !!member?.id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">{isEditing ? 'Edit Member' : 'Add New Member'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Church *</label>
              <select
                value={form.church_id}
                onChange={e => handleChange('church_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
              >
                <option value="">Select church</option>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Family Number *</label>
              <input
                type="text"
                value={form.family_number}
                onChange={e => handleChange('family_number', e.target.value)}
                placeholder="e.g. FAM001"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Member Name *</label>
              <input
                type="text"
                value={form.member_name}
                onChange={e => handleChange('member_name', e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              placeholder="Street, City, State"
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
              <input
                type="tel"
                value={form.mobile}
                onChange={e => handleChange('mobile', e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={e => handleChange('date_of_birth', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Wedding Date</label>
            <input
              type="date"
              value={form.wedding_date}
              onChange={e => handleChange('wedding_date', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              {saving ? 'Saving...' : isEditing ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
