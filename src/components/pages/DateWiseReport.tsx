import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { fyLabel } from '../../utils/financialYear';
import { cleanPart } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';
import {
  firstOfMonth, formatDisplayDate, lastSunday, todayISO, weekEnd, weekStart,
} from '../../utils/dates';
import {
  Basis, DateWiseData, EntryKind, buildDateWiseTable, kindFile, kindLabel, loadDateWise,
} from '../../utils/dateWiseExport';

interface Props {
  churchId: string;
  churchName: string;
  fyStart: number;
}

const fmt = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v);

export default function DateWiseReport({ churchId, churchName, fyStart }: Props) {
  const [kind, setKind] = useState<EntryKind>('subscription');
  const [basis, setBasis] = useState<Basis>('saved');
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [data, setData] = useState<DateWiseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to) return;
    if (from > to) { setError('"From" date is after "To" date.'); setData(null); return; }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError('');
      try {
        const result = await loadDateWise({ kind, churchId, from, to, basis });
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) {
          setError(
            `${e?.message || 'Failed to load the report.'} (If it says the table was not found, run the contribution_entries SQL in your Supabase project.)`
          );
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [kind, basis, churchId, from, to]);

  // The name / Sandha No search keeps the date totals correct
  const table = useMemo(() => {
    if (!data) return null;
    const q = search.trim().toLowerCase();
    const entries = q
      ? data.entries.filter(e => {
          const m = data.members.get(e.member_id);
          return Boolean(m && (m.member_name.toLowerCase().includes(q) || m.family_number.toLowerCase().includes(q)));
        })
      : data.entries;
    return buildDateWiseTable({ members: data.members, entries }, kind);
  }, [data, search, kind]);

  const hasRows = !!table && table.count > 0;
  const datesCount = table ? table.rowTypes.filter(t => t === 'subtotal').length : 0;
  const membersCount = table
    ? new Set(table.body.filter((_, i) => table.rowTypes[i] === 'row').map(r => `${r[1]}|${r[2]}`)).size
    : 0;

  function download(format: 'csv' | 'pdf') {
    if (!table || !hasRows) return;
    const range = from === to ? from : `${from}_to_${to}`;
    const fileName = [cleanPart(churchName), kindFile(kind), 'Date-wise', range].filter(Boolean).join('_');
    const title = `${churchName} - ${kindLabel(kind)} - Date-wise - ${
      from === to ? formatDisplayDate(from) : `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`
    }`;

    if (format === 'csv') downloadCsv(fileName, table.headers, table.body);
    else downloadPdf(fileName, title, table.headers, table.body);
  }

  const toggle = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;
  const chip = 'px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50';
  const dateInput =
    'ml-2 px-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="space-y-4">
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

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1" title="Which date to use for each entry">
            <button onClick={() => setBasis('saved')} className={toggle(basis === 'saved')}>
              Day saved
            </button>
            <button onClick={() => setBasis('entry')} className={toggle(basis === 'entry')}>
              Entry date
            </button>
          </div>

          <label className="text-xs text-slate-500">
            From
            <input type="date" value={from} max={todayISO()} onChange={e => setFrom(e.target.value)} className={dateInput} />
          </label>
          <label className="text-xs text-slate-500">
            To
            <input type="date" value={to} max={todayISO()} onChange={e => setTo(e.target.value)} className={dateInput} />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button className={chip} onClick={() => { setFrom(todayISO()); setTo(todayISO()); }}>
              Today
            </button>
            <button className={chip} onClick={() => { setFrom(lastSunday()); setTo(lastSunday()); }}>
              Last Sunday
            </button>
            <button className={chip} onClick={() => { setFrom(weekStart(todayISO())); setTo(weekEnd(todayISO())); }}>
              This week (Sun to Sat)
            </button>
            <button className={chip} onClick={() => { setFrom(firstOfMonth()); setTo(todayISO()); }}>
              This month
            </button>
            <button
              className={chip}
              onClick={() => {
                setFrom(`${fyStart}-04-01`);
                const end = `${fyStart + 1}-03-31`;
                setTo(end > todayISO() ? todayISO() : end);
              }}
            >
              FY {fyLabel(fyStart)}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Sandha No or name..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 w-64"
            />
          </div>

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

        <p className="text-xs text-slate-500">
          {basis === 'saved'
            ? 'Showing what was entered on the chosen day (the day the admin pressed Save).'
            : 'Showing entries by their Entry date (the date typed beside the Save button).'}{' '}
          {hasRows && (
            <>
              {membersCount} member{membersCount !== 1 ? 's' : ''} across {datesCount} date{datesCount !== 1 ? 's' : ''}.
              "For month" is the month row that was edited. A negative amount is a correction.
            </>
          )}
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasRows ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
          No entries found for this period. Try the other date option (Day saved / Entry date), or check that the entry
          was saved.
        </div>
      ) : (
        <div className="overflow-auto max-h-[65vh] rounded-xl border border-slate-200 shadow-sm bg-white">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                {table!.headers.map((h, i) => (
                  <th
                    key={h + i}
                    className={`px-3 py-3 font-semibold whitespace-nowrap sticky top-0 bg-slate-800 z-10 ${i >= 4 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table!.body.map((row, r) => {
                const type = table!.rowTypes[r];
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
                      <td key={c} className={`px-3 py-2 whitespace-nowrap ${c >= 4 ? 'text-right' : 'text-left'}`}>
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