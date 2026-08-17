import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Mail, MapPin, Home, CreditCard as Edit2, Users, Calendar, Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Member, NavState } from '../../types';
import AddMemberModal from './AddMemberModal';
import SubscriptionTable from '../subscriptions/SubscriptionTable';
import BuildingConstructionFundTable from '../subscriptions/BuildingConstructionFundTable';

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
      const { data } = await supabase
        .from('members')
        .select('*, church:churches(id,name,location)')
        .eq('family_number', familyNumber)
        .order('member_name');
      const list = data || [];
      setMembers(list);
      if (memberId) {
        setSelectedMember(list.find(m => m.id === memberId) || list[0] || null);
      } else {
        setSelectedMember(list[0] || null);
      }
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
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Family</p>
              <p className="text-lg font-bold text-slate-800">{selectedMember.family_number}</p>
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
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  selectedMember.id === m.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {m.member_name.charAt(0)}
                </div>
                <span className="truncate">{m.member_name}</span>
              </button>
            ))}
          </div>
          {members.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <Users className="w-3 h-3" />
              <span>{members.length} family members</span>
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
                <h2 className="text-xl font-bold text-slate-800">{selectedMember.member_name}</h2>
                {church && <p className="text-sm text-teal-600 font-medium">{church.name}</p>}
                <p className="text-xs text-slate-400 mt-0.5">Family: {selectedMember.family_number}</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <InfoBlock icon={<Phone className="w-4 h-4" />} label="Mobile" value={selectedMember.mobile || '—'} />
            <InfoBlock icon={<Mail className="w-4 h-4" />} label="Email" value={selectedMember.email || '—'} />
            <InfoBlock icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={selectedMember.date_of_birth ? new Date(selectedMember.date_of_birth).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} />
            <InfoBlock icon={<Heart className="w-4 h-4" />} label="Wedding Date" value={selectedMember.wedding_date ? new Date(selectedMember.wedding_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} />
            <InfoBlock icon={<MapPin className="w-4 h-4" />} label="Address" value={selectedMember.address || '—'} />
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
