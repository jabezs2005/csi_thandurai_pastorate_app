import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Member, Church } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';
import { formatAge } from '../../utils/age';

interface AddMemberModalProps {
  member?: Member | null;
  onClose: () => void;
  onSave: () => void;
  defaultChurchId?: string;
}

const TITLES = ['Rev', 'Mr', 'Mrs', 'Ms', 'Selvan', 'Selvi'];
const GENDERS = ['Male', 'Female', 'Rather not say'];
const CONFIRMATION = ['Confirmed', 'Not confirmed'];

export default function AddMemberModal({ member, onClose, onSave, defaultChurchId }: AddMemberModalProps) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [churches, setChurches] = useState<Church[]>([]);
  const [form, setForm] = useState({
    church_id: member?.church_id || defaultChurchId || '',
    family_number: member?.family_number || '',
    title: member?.title || '',
    member_name: member?.member_name || '',
    gender: member?.gender || '',
    confirmation_status: member?.confirmation_status || '',
    address: member?.address || '',
    email: member?.email || '',
    mobile: member?.mobile || '',
    date_of_birth: member?.date_of_birth || '',
    wedding_date: member?.wedding_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toLocaleDateString('en-CA');

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
    if (!form.family_number.trim()) { setError('Sandha number is required.'); return; }
    if (!form.member_name.trim()) { setError('Member name is required.'); return; }
    if (form.date_of_birth && form.date_of_birth > todayStr) {
      setError('Date of birth cannot be in the future.');
      return;
    }

    setSaving(true);

    const cleanName = form.member_name.trim().replace(/\s+/g, ' ');
    const cleanFamily = form.family_number.trim().toUpperCase();
    const escape = (s: string) => s.replace(/[%_\\]/g, '\\$&');

    // Only the Sandha number must be unique in a church. Names can repeat.
    let famQuery = supabase
      .from('members')
      .select('id, member_name')
      .eq('church_id', form.church_id)
      .ilike('family_number', escape(cleanFamily))
      .limit(1);
    if (member?.id) famQuery = famQuery.neq('id', member.id);
    const { data: famDup, error: famErr } = await famQuery;
    if (famErr) { setError(famErr.message); setSaving(false); return; }
    if (famDup && famDup.length > 0) {
      setError(`Sandha number ${cleanFamily} already exists (${famDup[0].member_name}).`);
      setSaving(false);
      return;
    }

    const payload = {
      church_id: form.church_id,
      family_number: cleanFamily,
      title: form.title || null,
      member_name: cleanName,
      gender: form.gender || null,
      confirmation_status: form.confirmation_status || null,
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
      setError(
        queryError.code === '23505'
          ? `Sandha number ${cleanFamily} already exists in this church.`
          : queryError.message
      );
    } else {
      onSave();
    }
    setSaving(false);
  }

  const isEditing = !!member?.id;
  const inputClass =
    'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none';

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
                className={`${inputClass} bg-white`}
              >
                <option value="">Select church</option>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sandha Number *</label>
              <input
                type="text"
                value={form.family_number}
                onChange={e => handleChange('family_number', e.target.value)}
                placeholder="e.g. 1, 1A, 1B"
                className={`${inputClass} uppercase`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={e => handleChange('gender', e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Select gender</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <select
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Select</option>
                {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Member Name *</label>
              <input
                type="text"
                value={form.member_name}
                onChange={e => handleChange('member_name', e.target.value)}
                placeholder="Full name"
                className={inputClass}
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
              className={`${inputClass} resize-none`}
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
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
              <input
                type="tel"
                value={form.mobile}
                onChange={e => handleChange('mobile', e.target.value)}
                placeholder="9876543210"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.date_of_birth}
                max={todayStr}
                onChange={e => handleChange('date_of_birth', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Age (auto)</label>
              <div className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-700">
                {form.date_of_birth ? formatAge(form.date_of_birth) : 'Select date of birth'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wedding Date</label>
              <input
                type="date"
                value={form.wedding_date}
                onChange={e => handleChange('wedding_date', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmation</label>
              <select
                value={form.confirmation_status}
                onChange={e => handleChange('confirmation_status', e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Select</option>
                {CONFIRMATION.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
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