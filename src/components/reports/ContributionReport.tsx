import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MONTHS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { fetchAllPages } from '../../utils/fetchAll';
import { compareFamilyNumbers } from '../../utils/familyUtils';
import { cleanPart } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';
import { firstOfMonth, todayISO, formatDisplayDate } from '../../utils/dates';
import {
  EntryKind, MemberLite, RowType, buildDateWiseTable, columnsFor, kindFile, kindLabel, loadDateWise,
} from '../../utils/dateWiseExport';

type View = 'member' | 'date';

interface ReportTable {
  headers: string[];
  body: (string | number)[][];
  rowTypes: RowType[];
}

const EMPTY: ReportTable = { headers: [], body: [], rowTypes: [] };

const fmt = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v);

// Members as rows (Sandha No + name), contribution types as columns
async function buildMemberTable(
  kind: EntryKind, churchId: string, year: number, monthFrom: number, monthTo: number
): Promise<ReportTable> {
  const cols = columnsFor(kind);
  const tableName = kind === 'subscription' ? 'subscriptions' : 'building_construction_fund';
  const select = ['member_id', ...cols.map(c => c.key)].join(', ');
  const db: any = supabase;

  const [members, rows] = await Promise.all([
    fetchAllPages<MemberLite>((a, b) =>
      supabase
        .from('members')
        .select('id, family_number, title, member_name')
        .eq('church_id', churchId)
        .order('id')
        .range(a, b)
    ),
    fetchAllPages<Record<string, unknown>>((a, b) =>
      db
        .from(tableName)
        .select(select)
        .eq('church_id', churchId)
        .eq('year', year)
        .gte('month', monthFrom)
        .lte('month', monthTo)
        .order('id')
        .range(a, b)
    ),
  ]);

  const sums = new Map<string, Record<string, number>>();
  rows.forEach(r => {
    const id = String(r.member_id);
    if (!sums.has(id)) sums.set(id, {});
    const rec = sums.get(id)!;
    cols.forEach(c => { rec[c.key] = (rec[c.key] || 0) + (Number(r[c.key]) || 0); });
  });

  const body: (string | number)[][] = [];
  const rowTypes: RowType[] = [];

  [...members]
    .sort((a, b) => compareFamilyNumbers(a.family_number, b.family_number))
    .forEach(m => {
      const rec = sums.get(m.id) || {};
      const amounts = cols.map(c => rec[c.key] || 0);
      const total = amounts.reduce((s, v) => s + v, 0);
      body.push([
        m.family_number,
        `${m.title ? `${m.title} ` : ''}${m.member_name}`,
        ...amounts.map(v => (v === 0 ? '' : v)),
        total,
      ]);
      rowTypes.push('row');
    });

  return { headers: ['Sandha No', 'Member Name', ...cols.map(c => c.label), 'Total'], body, rowTypes };
}

export default function ContributionReport() {
  const { profile, church } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const thisYear = new Date().getFullYear();

  const [kind, setKind] = useState<EntryKind>('subscription');
  const [view, setView] = useState<View>('member');
  const [churches, setChurches] = useState<{ id: string; name: string }[]>([]);
  const [churchId, setChurchId] = useState(profile?.church_id || '');
  const [year, setYear] = useState(thisYear);
  const [monthFrom, setMonthFrom] = useState(1);
  const [monthTo, setMonthTo] = useState(12);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [table, setTable] = useState<ReportTable>(EMPTY);

  const churchName = isSuperAdmin ? churches.find(c => c.id === churchId)?.name || '' : church?.name || '';
  const years = Array.from({ length: 8 }, (_, i) => thisYear + 1 - i);

  useEffect(() => {
    if (!isSuperAdmin) {
      if (profile?.church_id) setChurchId(profile.church_id);
      return;
    }
    supabase
      .from('churches')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        const list = (data || []) as { id: string; name: string }[];
        setChurches(list);
        setChurchId(current => current || list[0]?.id || '');
      });
  }, [isSuperAdmin, profile?.church_id]);

  useEffect(() => {
    if (!churchId) { setTable(EMPTY); return; }
    if (view === 'member' && monthFrom > monthTo) { setError('"From month" is after "To month".'); setTable(EMPTY); return; }
    if (view === 'date' && (!from || !to || from > to)) { setError('"From" date is after "To" date.'); setTable(EMPTY); return; }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        let result: ReportTable;
        if (view === 'member') {
          result = await buildMemberTable(kind, churchId, year, monthFrom, monthTo);
        } else {
          const data = await loadDateWise({ kind, churchId, from, to });
          const built = buildDateWiseTable(data, kind);
          result = { headers: built.headers, body: built.body, rowTypes: built.rowTypes };
        }
        if (!cancelled) setTable(result);
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || 'Failed to load the report.'); setTable(EMPTY); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [kind, view, churchId, year, monthFrom, monthTo, from, to]);

  // Member view: search and "hide members with no amount" re-calculate the total row
  const shown = useMemo<ReportTable>(() => {
    if (view === 'date' || table.headers.length === 0) return table;

    const q = search.trim().toLowerCase();
    const rows: (string | number)[][] = [];
    table.body.forEach((row, i) => {
      if (table.rowTypes[i] !== 'row') return;
      if (hideEmpty && (Number(row[row.length - 1]) || 0) === 0) return;
      if (q && !String(row[0]).toLowerCase().includes(q) && !String(row[1]).toLowerCase().includes(q)) return;
      rows.push(row);
    });

    const sums = table.headers.slice(2).map((_, idx) => rows.reduce((s, r) => s + (Number(r[idx + 2]) || 0), 0));
    return {
      headers: table.headers,
      body: [...rows, ['', 'TOTAL', ...sums]],
      rowTypes: [...rows.map((): RowType => 'row'), 'grand' as RowType],
    };
  }, [table, view, search, hideEmpty]);

  const hasRows = shown.rowTypes.some(t => t === 'row');
  const firstAmountCol = view === 'member' ? 2 : 3;

  function download(format: 'csv' | 'pdf') {
    if (!hasRows) return;
    const church = cleanPart(churchName);
    const partial = monthFrom !== 1 || monthTo !== 12;
    const monthPart = partial ? `${cleanPart(MONTHS[monthFrom - 1])}-to-${cleanPart(MONTHS[monthTo - 1])}` : '';

    const fileName =
      view === 'member'
        ? [church, kindFile(kind), 'Member-wise', String(year), monthPart].filter(Boolean).join('_')
        : [church, kindFile(kind), 'Date-wise', `${from}_to_${to}`].filter(Boolean).join('_');

    const title =
      view === 'member'
        ? `${churchName} - ${kindLabel(kind)} - Member-wise ${year}${partial ? ` (${MONTHS[monthFrom - 1]} to ${MONTHS[monthTo - 1]})` : ''}`
        : `${churchName} - ${kindLabel(kind)} - Date-wise ${formatDisplayDate(from)} to ${formatDisplayDate(to)}`;

    if (format === 'csv') downloadCsv(fileName, shown.headers, shown.body);
    else downloadPdf(fileName, title, shown.headers, shown.body);
  }

  const selectClass =
    'px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500';
  const toggle = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Contribution Report</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Members listed by Sandha No. Use Date-wise to see what was collected on each Sunday.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setKind('subscription')} className={toggle(kind === 'subscription')}>
              Subscription
            </button>
            <button onClick={() => setKind('building_fund')} className={toggle(kind === 'building_fund')}>
              Building Fund
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setView('member')} className={toggle(view === 'member')}>
              Member-wise
            </button>
            <button onClick={() => setView('date')} className={toggle(view === 'date')}>
              Date-wise
            </button>
          </div>

          {isSuperAdmin && (
            <select value={churchId} onChange={e => setChurchId(e.target.value)} className={selectClass} aria-label="Church">
              {churches.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view === 'member' ? (
            <>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectClass} aria-label="Year">
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select value={monthFrom} onChange={e => setMonthFrom(Number(e.target.value))} className={selectClass} aria-label="From month">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>From {m}</option>
                ))}
              </select>
              <select value={monthTo} onChange={e => setMonthTo(Number(e.target.value))} className={selectClass} aria-label="To month">
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>To {m}</option>
                ))}
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search Sandha No or name..."
                  className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 w-64"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} className="accent-teal-600" />
                Hide members with no amount
              </label>
            </>
          ) : (
            <>
              <label className="text-xs text-slate-500">
                From
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="ml-2 px-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
              <label className="text-xs text-slate-500">
                To
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="ml-2 px-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
            </>
          )}

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => download('csv')}
              disabled={!hasRows}
              className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium border border-green-200 disabled:opacity-40"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={() => download('pdf')}
              disabled={!hasRows}
              className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium border border-orange-200 disabled:opacity-40"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasRows ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
          {view === 'date'
            ? 'No dated entries in this period. Dates are recorded each time a Sunday update is saved.'
            : 'No members to show.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                {shown.headers.map((h, i) => (
                  <th
                    key={h + i}
                    className={`px-3 py-3 font-semibold whitespace-nowrap ${i >= firstAmountCol ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.body.map((row, r) => {
                const type = shown.rowTypes[r];
                const rowClass =
                  type === 'grand'
                    ? 'bg-slate-800 text-yellow-300 font-bold'
                    : type === 'subtotal'
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : r % 2 === 0
                    ? 'bg-white'
                    : 'bg-slate-50';
                return (
                  <tr key={r} className={rowClass}>
                    {row.map((cell, c) => (
                      <td key={c} className={`px-3 py-2 whitespace-nowrap ${c >= firstAmountCol ? 'text-right' : 'text-left'}`}>
                        {fmt(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}