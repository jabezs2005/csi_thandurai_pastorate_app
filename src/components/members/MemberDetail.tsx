import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Mail, MapPin, Home, CreditCard as Edit2, Users, Calendar, Heart, User, Cake } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Member, NavState } from '../../types';
import AddMemberModal from './AddMemberModal';
import SubscriptionTable from '../subscriptions/SubscriptionTable';
import BuildingConstructionFundTable from '../subscriptions/BuildingConstructionFundTable';
import { parseFamilyNumber, sortMembersByFamily } from '../../utils/familyUtils';
import { formatAge } from '../../utils/age';

interface MemberDetailProps {
  memberId?: string;
  familyNumber?: string;
  onNavigate: (state: NavState) => void;
}

export default function MemberDetail({ memberId, familyNumber, onNavigate }: MemberDetailProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<Member | null>(null);

  async function fetchData() {
    setLoading(true);
    if (familyNumber) {
      // Load the whole Sandha group: 1, 1A, 1B ...
      const base = parseFamilyNumber(familyNumber).base;
      const { data } = await supabase
        .from('members')
        .select('*, church:churches(id,name,location)')
        .ilike('family_number', `${base}%`);

      let list = ((data || []) as Member[]).filter(m => parseFamilyNumber(m.family_number).base === base);

      // Keep only one church's group (the same number can exist in other churches)
      const target = memberId ? list.find(m => m.id === memberId) : undefined;
      const churchId = (target || list[0])?.church_id;
      if (churchId) list = list.filter(m => m.church_id === churchId);

      list = sortMembersByFamily(list);
      setMembers(list);
      setSelectedMember((memberId && list.find(m => m.id === memberId)) || list[0] || null);
    } else if (memberId) {
      const { data } = await supabase
        .from('members')
        .select('*, church:churches(id,name,location)')
        .eq('id', memberId)
        .maybeSingle();
      if (data) {
        setSelectedMember(data);
        setMembers([data]);
      }
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [memberId, familyNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selectedMember) {
    return (
      <div className="text-center text-slate-500 mt-12">
        <p>Member not found.</p>
        <button onClick={() => onNavigate({ page: 'members' })} className="mt-3 text-teal-600 hover:underline text-sm">
          Back to Members
        </button>
      </div>
    );
  }

  const church = (selectedMember as Member & { church?: { name: string; location: string } }).church;
  const sandhaBase = parseFamilyNumber(selectedMember.family_number).base;
  const displayName = (m: Member) => `${m.title ? `${m.title} ` : ''}${m.member_name}`;
  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => onNavigate({ page: 'members' })}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Members</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Home className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Sandha No</p>
              <p className="text-lg font-bold text-slate-800">{sandhaBase}</p>
            </div>
          </div>
          <div className="space-y-2">
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  selectedMember.id === m.id
                    ? 'bg-teal-600 text-white'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className={`min-w-[2rem] h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  selectedMember.id === m.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {m.family_number}
                </div>
                <span className="truncate flex-1">{displayName(m)}</span>
                <span className={`text-xs flex-shrink-0 ${selectedMember.id === m.id ? 'text-white/80' : 'text-slate-400'}`}>
                  {m.date_of_birth ? formatAge(m.date_of_birth) : ''}
                </span>
              </button>
            ))}
          </div>
          {members.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <Users className="w-3 h-3" />
              <span>{members.length} members</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md">
                {selectedMember.member_name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{displayName(selectedMember)}</h2>
                {church && <p className="text-sm text-teal-600 font-medium">{church.name}</p>}
                <p className="text-xs text-slate-400 mt-0.5">Sandha No: {selectedMember.family_number}</p>
              </div>
            </div>
            <button
              onClick={() => setEditMember(selectedMember)}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-sm transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoBlock icon={<User className="w-4 h-4" />} label="Gender" value={selectedMember.gender || '—'} />
            <InfoBlock icon={<Cake className="w-4 h-4" />} label="Age" value={formatAge(selectedMember.date_of_birth)} />
            <InfoBlock icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={formatDate(selectedMember.date_of_birth)} />
            <InfoBlock icon={<Phone className="w-4 h-4" />} label="Mobile" value={selectedMember.mobile || '—'} />
            <InfoBlock icon={<Mail className="w-4 h-4" />} label="Email" value={selectedMember.email || '—'} />
            <InfoBlock icon={<Heart className="w-4 h-4" />} label="Wedding Date" value={formatDate(selectedMember.wedding_date)} />
            <InfoBlock icon={<User className="w-4 h-4" />} label="Confirmation" value={selectedMember.confirmation_status || 'Not set'} />
            <div className="sm:col-span-3">
              <InfoBlock icon={<MapPin className="w-4 h-4" />} label="Address" value={selectedMember.address || '—'} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <SubscriptionTable memberId={selectedMember.id} churchId={selectedMember.church_id} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mt-6">
        <BuildingConstructionFundTable
          memberId={selectedMember.id}
          churchId={selectedMember.church_id}
          memberName={selectedMember.member_name}
        />
      </div>

      {editMember && (
        <AddMemberModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSave={() => { setEditMember(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="text-teal-500 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}