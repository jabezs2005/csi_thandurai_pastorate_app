import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Save, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SUBSCRIPTION_FIELDS, MONTHS } from '../../types';
import { fetchAllPages } from '../../utils/fetchAll';
import { sortMembersByFamily } from '../../utils/familyUtils';
import { recordEntries } from '../../utils/contributionEntries';
import { logActivity } from '../../utils/activityLogger';
import { lastSunday, isSunday, todayISO, toISODate, formatDisplayDate } from '../../utils/dates';
import { columnsFor, kindLabel, EntryKind, MemberLite } from '../../utils/dateWiseExport';

const db: any = supabase;

type Grid = Record<string, Record<string, string>>;
type Entered = Record<string, Record<string, number>>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const parseAmount = (s?: string) => round2(Number(s) || 0);

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

interface Props {
  churchId: string;
  churchName: string;
}

export default function WeeklyEntry({ churchId, churchName }: Props) {
  const { profile } = useAuth();

  const [kind, setKind] = useState<EntryKind>('subscription');
  const [date, setDate] = useState(lastSunday());
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [entered, setEntered] = useState<Entered>({});
  const [values, setValues] = useState<Grid>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyEntered, setOnlyEntered] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const cols = columnsFor(kind);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  // Members of this church, in Sandha order
  useEffect(() => {
    let cancelled = false;
    fetchAllPages<MemberLite>((a, b) =>
      db.from('members').select('id, family_number, title, member_name').eq('church_id', churchId).order('id').range(a, b)
    )
      .then(list => { if (!cancelled) setMembers(sortMembersByFamily(list)); })
      .catch((e: any) => { if (!cancelled) setMessage({ type: 'error', text: e?.message || 'Could not load members.' }); });
    return () => { cancelled = true; };
  }, [churchId]);

  // Amounts already entered on the chosen date
  const loadEntered = useCallback(async () => {
    if (!validDate) return;
    setLoading(true);
    try {
      const rows = await fetchAllPages<{ member_id: string; field_key: string; amount: number | null }>((a, b) =>
        db
          .from('contribution_entries')
          .select('member_id, field_key, amount')
          .eq('church_id', churchId)
          .eq('kind', kind)
          .eq('entry_date', date)
          .order('id')
          .range(a, b)
      );

      const sums: Entered = {};
      rows.forEach(r => {
        if (!sums[r.member_id]) sums[r.member_id] = {};
        sums[r.member_id][r.field_key] = round2((sums[r.member_id][r.field_key] || 0) + (Number(r.amount) || 0));
      });

      const grid: Grid = {};
      Object.entries(sums).forEach(([memberId, fields]) => {
        grid[memberId] = {};
        Object.entries(fields).forEach(([key, amount]) => {
          if (amount !== 0) grid[memberId][key] = String(amount);
        });
      });

      setEntered(sums);
      setValues(grid);
      setDirty(false);
    } catch (e: any) {
      setMessage({
        type: 'error',
        text: `${e?.message || 'Could not load the entries.'} (If it says the table was not found, run the contribution_entries SQL in your Supabase project.)`,
      });
    } finally {
      setLoading(false);
    }
  }, [churchId, kind, date, validDate]);

  useEffect(() => {
    setMessage(null);
    loadEntered();
  }, [loadEntered]);

  function confirmDiscard() {
    return !dirty || window.confirm('You have unsaved changes. Discard them?');
  }

  function changeDate(next: string) {
    if (next === date || !confirmDiscard()) return;
    setDate(next);
  }

  function changeKind(next: EntryKind) {
    if (next === kind || !confirmDiscard()) return;
    setKind(next);
  }

  function setCell(memberId: string, key: string, raw: string) {
    const clean = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setValues(prev => ({ ...prev, [memberId]: { ...(prev[memberId] || {}), [key]: clean } }));
    setDirty(true);
    setMessage(null);
  }

  const rowTotal = (id: string) => round2(cols.reduce((s, c) => s + parseAmount(values[id]?.[c.key]), 0));
  const colTotal = (key: string) => round2(members.reduce((s, m) => s + parseAmount(values[m.id]?.[key]), 0));
  const grandTotal = round2(members.reduce((s, m) => s + rowTotal(m.id), 0));
  const filledCount = members.filter(m => rowTotal(m.id) !== 0).length;

  const q = search.trim().toLowerCase();
  const visible = members.filter(m => {
    if (q && !m.family_number.toLowerCase().includes(q) && !m.member_name.toLowerCase().includes(q)) return false;
    if (onlyEntered && rowTotal(m.id) === 0) return false;
    return true;
  });

  async function handleSave() {
    if (saving) return;
    if (!validDate) { setMessage({ type: 'error', text: 'Please choose a valid date.' }); return; }
    if (date > todayISO()) { setMessage({ type: 'error', text: 'The entry date cannot be in the future.' }); return; }

    // What changed compared with what was already entered for this date
    const changes: { memberId: string; key: string; delta: number }[] = [];
    members.forEach(m =>
      cols.forEach(c => {
        const value = parseAmount(values[m.id]?.[c.key]);
        const old = entered[m.id]?.[c.key] || 0;
        if (value !== old) changes.push({ memberId: m.id, key: c.key, delta: round2(value - old) });
      })
    );

    if (changes.length === 0) { setMessage({ type: 'ok', text: 'Nothing has changed.' }); return; }

    setSaving(true);
    setMessage(null);

    try {
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(5, 7));
      const table = kind === 'subscription' ? 'subscriptions' : 'building_construction_fund';

      const deltas: Record<string, Record<string, number>> = {};
      changes.forEach(c => {
        if (!deltas[c.memberId]) deltas[c.memberId] = {};
        deltas[c.memberId][c.key] = c.delta;
      });
      const memberIds = Object.keys(deltas);

      // The month of the entry date already holds the member's amounts: add this Sunday to them
      const existingRows = await fetchAllPages<Record<string, any>>((a, b) =>
        db.from(table).select('*').eq('church_id', churchId).eq('year', year).eq('month', month).order('id').range(a, b)
      );
      const existing = new Map<string, Record<string, any>>(existingRows.map(r => [String(r.member_id), r]));

      const upserts = memberIds.map(id => {
        const base = existing.get(id) || {};
        const row: Record<string, any> = { member_id: id, church_id: churchId, year, month };
        if (kind === 'subscription') {
          SUBSCRIPTION_FIELDS.forEach(f => {
            const key = String(f.key);
            row[key] = Math.max(0, round2((Number(base[key]) || 0) + (deltas[id][key] || 0)));
          });
        } else {
          row.amount = Math.max(0, round2((Number(base.amount) || 0) + (deltas[id].amount || 0)));
        }
        return row;
      });

      for (let i = 0; i < upserts.length; i += 200) {
        const { error } = await db.from(table).upsert(upserts.slice(i, i + 200), { onConflict: 'member_id,year,month' });
        if (error) throw error;
      }

      // The dated record (this is what the Date-wise Report reads)
      const entryRows = changes.map(c => ({
        church_id: churchId,
        member_id: c.memberId,
        kind,
        entry_date: date,
        year,
        month,
        field_key: c.key,
        amount: c.delta,
        created_by: profile?.id ?? null,
      }));
      for (let i = 0; i < entryRows.length; i += 500) {
        const err = await recordEntries(entryRows.slice(i, i + 500));
        if (err) throw new Error(`The amounts were saved, but the date record failed: ${err}`);
      }

      if (profile?.id) {
        try {
          await logActivity(
            profile.id,
            churchId,
            'update',
            kind === 'subscription' ? 'subscription' : 'building_construction_fund',
            churchId,
            `Weekly entry for ${formatDisplayDate(date)}: ${memberIds.length} member(s), ${kindLabel(kind)}`,
            {
              operation: 'UPDATE',
              table,
              weekly: true,
              entryDate: date,
              year,
              month,
              changedMemberCount: memberIds.length,
              grandTotal,
            }
          );
        } catch (e) {
          console.warn('Weekly entry saved, but the activity log failed:', e);
        }
      }

      await loadEntered();
      setMessage({ type: 'ok', text: `Saved ${memberIds.length} member(s) for ${formatDisplayDate(date)}.` });
    } catch (e: any) {
      console.error('Weekly entry failed:', e);
      setMessage({ type: 'error', text: e?.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  }

  const toggle = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  const nextWeek = shiftDate(date, 7);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => changeKind('subscription')} className={toggle(kind === 'subscription')}>
              Subscription
            </button>
            <button onClick={() => changeKind('building_fund')} className={toggle(kind === 'building_fund')}>
              Building Fund
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => validDate && changeDate(shiftDate(date, -7))}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={e => changeDate(e.target.value)}
              className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Entry date"
            />
            <button
              onClick={() => validDate && changeDate(nextWeek)}
              disabled={!validDate || nextWeek > todayISO()}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => changeDate(lastSunday())}
              className="ml-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              Last Sunday
            </button>
          </div>

          {validDate && !isSunday(date) && <span className="text-xs text-amber-600">not a Sunday</span>}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Sandha No or name..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 w-56"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyEntered} onChange={e => setOnlyEntered(e.target.checked)} className="accent-teal-600" />
            Only members with an amount
          </label>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="sm:ml-auto flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : dirty ? 'Save entry *' : 'Save entry'}
          </button>
        </div>

        {validDate && (
          <p className="text-xs text-slate-500">
            {churchName} · {kindLabel(kind)} · Sunday collection of <strong>{formatDisplayDate(date)}</strong> is added to{' '}
            <strong>{MONTHS[Number(date.slice(5, 7)) - 1]} {date.slice(0, 4)}</strong> of each member · {filledCount} of{' '}
            {members.length} members have an amount · Total ₹{grandTotal.toLocaleString('en-IN')}
          </p>
        )}
      </div>

      {message && (
        <div
          className={`px-3 py-2 rounded-lg text-sm border ${
            message.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
          No members found for this church.
        </div>
      ) : (
        <div className="overflow-auto max-h-[65vh] rounded-xl border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-xs border-collapse" style={{ minWidth: kind === 'subscription' ? 1300 : 520 }}>
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-3 text-left font-semibold sticky top-0 left-0 z-30 bg-slate-800 w-20 min-w-[80px]">
                  Sandha No
                </th>
                <th className="px-3 py-3 text-left font-semibold sticky top-0 left-20 z-30 bg-slate-800 min-w-[200px]">
                  Member Name
                </th>
                {cols.map(c => (
                  <th key={c.key} className="px-2 py-3 text-center font-semibold whitespace-nowrap sticky top-0 z-20 bg-slate-800">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap sticky top-0 z-20 bg-teal-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m, i) => {
                const zebra = i % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                const total = rowTotal(m.id);
                return (
                  <tr key={m.id} className={`${zebra} hover:bg-teal-50`}>
                    <td className={`px-3 py-1.5 font-semibold text-teal-700 sticky left-0 z-10 ${zebra}`}>{m.family_number}</td>
                    <td className={`px-3 py-1.5 text-slate-800 sticky left-20 z-10 ${zebra} border-r border-slate-200`}>
                      {m.title ? `${m.title} ` : ''}
                      {m.member_name}
                    </td>
                    {cols.map(c => (
                      <td key={c.key} className="px-1 py-1 text-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={values[m.id]?.[c.key] ?? ''}
                          onChange={e => setCell(m.id, c.key, e.target.value)}
                          placeholder="0"
                          className="w-full min-w-[56px] px-1.5 py-1 text-center border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white text-slate-700"
                        />
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-right font-bold ${total !== 0 ? 'text-teal-700 bg-teal-50' : 'text-slate-300'}`}>
                      {total !== 0 ? total.toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={cols.length + 3} className="px-3 py-8 text-center text-slate-400">
                    No members match.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold">
                <td className="px-3 py-3 text-yellow-300">TOTAL</td>
                <td className="px-3 py-3 text-yellow-300">{filledCount} members</td>
                {cols.map(c => (
                  <td key={c.key} className="px-2 py-3 text-center text-yellow-200">
                    {colTotal(c.key) !== 0 ? colTotal(c.key).toLocaleString('en-IN') : '—'}
                  </td>
                ))}
                <td className="px-3 py-3 text-right text-yellow-300 bg-teal-900">{grandTotal.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}