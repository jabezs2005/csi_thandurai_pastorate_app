import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Search } from 'lucide-react';
import { cleanPart } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';
import { addDays, formatDisplayDate, formatWithDay, todayISO, weekEnd, weekStart } from '../../utils/dates';
import {
  Basis, DateWiseData, EntryKind, buildWeeklyTable, kindFile, kindLabel, loadDateWise,
} from '../../utils/dateWiseExport';

interface Props {
  churchId: string;
  churchName: string;
}

const fmt = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('en-IN') : v);

export default function WeeklyReport({ churchId, churchName }: Props) {
  const [kind, setKind] = useState<EntryKind>('subscription');
  const [basis, setBasis] = useState<Basis>('saved');
  const [pick, setPick] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [data, setData] = useState<DateWiseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(pick);
  const start = valid ? weekStart(pick) : '';
  const end = valid ? weekEnd(pick) : '';
  const nextStart = valid ? addDays(start, 7) : '';

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError('');
      try {
        const result = await loadDateWise({ kind, churchId, from: start, to: end, basis });
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
  }, [kind, basis, churchId, start, end, valid]);

  const table = useMemo(() => {
    if (!data) return null;
    const q = search.trim().toLowerCase();
    const entries = q
      ? data.entries.filter(e => {
          const m = data.members.get(e.member_id);
          return Boolean(m && (m.member_name.toLowerCase().includes(q) || m.family_number.toLowerCase().includes(q)));
        })
      : data.entries;
    return buildWeeklyTable({ members: data.members, entries }, kind);
  }, [data, search, kind]);

  const hasRows = !!table && table.count > 0;

  function download(format: 'csv' | 'pdf') {
    if (!table || !hasRows) return;
    const fileName = [cleanPart(churchName), kindFile(kind), 'Weekly', `${start}_to_${end}`].filter(Boolean).join('_');
    const title = `${churchName} - ${kindLabel(kind)} - Week ${formatWithDay(start)} to ${formatWithDay(end)}`;
    if (format === 'csv') downloadCsv(fileName, table.headers, table.body);
    else downloadPdf(fileName, title, table.headers, table.body);
  }

  const toggle = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

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

          <div className="flex items-center gap-1">
            <button
              onClick={() => valid && setPick(addDays(start, -7))}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <input
              type="date"
              value={pick}
              max={todayISO()}
              onChange={e => setPick(e.target.value)}
              className="px-2 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Any date in the week"
            />
            <button
              onClick={() => valid && setPick(nextStart)}
              disabled={!valid || nextStart > todayISO()}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setPick(todayISO())}
              className="ml-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              This week
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

        {valid && (
          <p className="text-xs text-slate-500">
            {churchName} · {kindLabel(kind)} · Week <strong>{formatWithDay(start)}</strong> to{' '}
            <strong>{formatWithDay(end)}</strong> (Sunday to Saturday) ·{' '}
            {hasRows ? (
              <>
                <strong>{table!.count}</strong> member{table!.count !== 1 ? 's' : ''} edited
              </>
            ) : (
              'no members edited'
            )}{' '}
            · amounts are what was entered in this week. {basis === 'saved' ? 'Day saved' : 'Entry date'} is used to place each
            entry in the week.
          </p>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasRows ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
          No members were edited in the week of {formatDisplayDate(start)} to {formatDisplayDate(end)}.
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
                const isGrand = table!.rowTypes[r] === 'grand';
                const rowClass = isGrand
                  ? 'bg-slate-800 text-yellow-300 font-bold'
                  : r % 2 === 0
                  ? 'bg-white hover:bg-teal-50'
                  : 'bg-slate-50 hover:bg-teal-50';
                return (
                  <tr key={r} className={rowClass}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className={`px-3 py-2 whitespace-nowrap ${c >= 4 ? 'text-right' : 'text-left'} ${
                          !isGrand && c === 0 ? 'font-semibold text-teal-700' : ''
                        }`}
                      >
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