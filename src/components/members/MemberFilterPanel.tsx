import { Member } from '../../types';
import { getAge } from '../../utils/age';
import { parseFamilyNumber } from '../../utils/familyUtils';

export const MIN_CONTRIBUTION = 240;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type GenderFilter = 'all' | 'Male' | 'Female' | 'Rather not say' | 'notset';
export type ConfirmFilter = 'all' | 'Confirmed' | 'Not confirmed' | 'notset';

export interface MemberFilters {
  alpha: string;
  famFrom: string;
  famTo: string;
  ageMin: string;
  ageMax: string;
  gender: GenderFilter;
  street: string;
  contrib: 'all' | 'min240';
  confirmation: ConfirmFilter;
}

export const DEFAULT_FILTERS: MemberFilters = {
  alpha: '',
  famFrom: '',
  famTo: '',
  ageMin: '',
  ageMax: '',
  gender: 'all',
  street: '',
  contrib: 'all',
  confirmation: 'all',
};

export function countActiveFilters(f: MemberFilters): number {
  return (
    (f.alpha ? 1 : 0) +
    (f.famFrom !== '' || f.famTo !== '' ? 1 : 0) +
    (f.ageMin !== '' || f.ageMax !== '' ? 1 : 0) +
    (f.gender !== 'all' ? 1 : 0) +
    (f.street.trim() !== '' ? 1 : 0) +
    (f.contrib !== 'all' ? 1 : 0) +
    (f.confirmation !== 'all' ? 1 : 0)
  );
}

export function memberMatchesFilters(member: Member, f: MemberFilters, grandTotal: number): boolean {
  if (f.contrib === 'min240' && grandTotal < MIN_CONTRIBUTION) return false;

  if (f.confirmation !== 'all') {
    if (f.confirmation === 'notset') {
      if (member.confirmation_status) return false;
    } else if (member.confirmation_status !== f.confirmation) {
      return false;
    }
  }

  if (f.alpha && !member.member_name.trim().toUpperCase().startsWith(f.alpha)) return false;

  if (f.famFrom !== '' || f.famTo !== '') {
    const num = parseFamilyNumber(member.family_number).num;
    if (f.famFrom !== '' && num < Number(f.famFrom)) return false;
    if (f.famTo !== '' && num > Number(f.famTo)) return false;
  }

  if (f.gender !== 'all') {
    if (f.gender === 'notset') {
      if (member.gender) return false;
    } else if (member.gender !== f.gender) {
      return false;
    }
  }

  const street = f.street.trim().toLowerCase();
  if (street && !(member.address || '').toLowerCase().includes(street)) return false;

  if (f.ageMin !== '' || f.ageMax !== '') {
    const age = getAge(member.date_of_birth);
    if (age === null) return false;
    if (f.ageMin !== '' && age < Number(f.ageMin)) return false;
    if (f.ageMax !== '' && age > Number(f.ageMax)) return false;
  }

  return true;
}

interface PanelProps {
  filters: MemberFilters;
  onChange: (next: MemberFilters) => void;
  streetSuggestions: string[];
}

const selectClass =
  'px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none w-full';
const inputClass =
  'px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none w-full';
const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

export default function MemberFilterPanel({ filters, onChange, streetSuggestions }: PanelProps) {
  function set<K extends keyof MemberFilters>(key: K, value: MemberFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const letterClass = (active: boolean) =>
    active
      ? 'bg-teal-600 border-teal-600 text-white'
      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50';

  return (
    <div className="mb-4 bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <div>
        <label className={labelClass}>Name starts with</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => set('alpha', '')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${letterClass(filters.alpha === '')}`}
          >
            All
          </button>
          {ALPHABET.map(letter => (
            <button
              key={letter}
              onClick={() => set('alpha', filters.alpha === letter ? '' : letter)}
              className={`w-7 h-7 rounded-md text-xs font-semibold border transition-colors ${letterClass(filters.alpha === letter)}`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Sandha number</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} value={filters.famFrom}
              onChange={e => set('famFrom', e.target.value)}
              placeholder="From" className={inputClass} aria-label="Sandha number from"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="number" min={0} value={filters.famTo}
              onChange={e => set('famTo', e.target.value)}
              placeholder="To" className={inputClass} aria-label="Sandha number to"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Age</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={120} value={filters.ageMin}
              onChange={e => set('ageMin', e.target.value)}
              placeholder="From" className={inputClass} aria-label="Minimum age"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="number" min={0} max={120} value={filters.ageMax}
              onChange={e => set('ageMax', e.target.value)}
              placeholder="To" className={inputClass} aria-label="Maximum age"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Gender</label>
          <select
            value={filters.gender}
            onChange={e => set('gender', e.target.value as GenderFilter)}
            className={selectClass} aria-label="Filter by gender"
          >
            <option value="all">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Rather not say">Rather not say</option>
            <option value="notset">Gender not set</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Street / area</label>
          <input
            type="text" list="street-suggestions" value={filters.street}
            onChange={e => set('street', e.target.value)}
            placeholder="Type or pick a street..." className={inputClass} aria-label="Filter by street"
          />
          <datalist id="street-suggestions">
            {streetSuggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Confirmation</label>
          <select
            value={filters.confirmation}
            onChange={e => set('confirmation', e.target.value as ConfirmFilter)}
            className={selectClass} aria-label="Filter by confirmation"
          >
            <option value="all">All</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Not confirmed">Not confirmed</option>
            <option value="notset">Not set</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Contribution</label>
          <select
            value={filters.contrib}
            onChange={e => set('contrib', e.target.value as 'all' | 'min240')}
            className={selectClass} aria-label="Filter by contribution"
          >
            <option value="all">All contributions</option>
            <option value="min240">Grand total ₹{MIN_CONTRIBUTION} and above</option>
          </select>
        </div>
      </div>
    </div>
  );
}