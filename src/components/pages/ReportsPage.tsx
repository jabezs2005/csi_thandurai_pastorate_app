import { useEffect, useState } from 'react';
import {
  BarChart3, Download, FileText, TrendingUp, ChevronLeft, ChevronRight, ClipboardList, CalendarDays,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SUBSCRIPTION_FIELDS, MONTHS } from '../../types';
import { fetchAllPages } from '../../utils/fetchAll';
import { currentFyStart, fyLabel, fyMonths } from '../../utils/financialYear';
import { cleanPart } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';
import WeeklyTab from './WeeklyTab';
import DateWiseReport from './DateWiseReport';

type Tab = 'summary' | 'entry' | 'datewise';

interface MonthRow {
  month: number;
  year: number;
  values: Record<string, number>;
  total: number;
}

const db: any = supabase;

export default function ReportsPage() {
  const { profile, church } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [tab, setTab] = useState<Tab>('summary');
  const [fyStart, setFyStart] = useState(currentFyStart());
  const [churches, setChurches] = useState<{ id: string; name: string }[]>([]);
  const [churchId, setChurchId] = useState(''); // '' = all churches (super admin, summary only)
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const churchName = isSuperAdmin
    ? churches.find(c => c.id === churchId)?.name || ''
    : church?.name || '';

  // Church admins are fixed to their own church
  useEffect(() => {
    if (!isSuperAdmin) setChurchId(profile?.church_id || '');
  }, [isSuperAdmin, profile?.church_id]);

  // Super admin: list of churches
  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase
      .from('churches')
      .select('id, name')
      .order('name')
      .then(({ data }) => setChurches((data || []) as { id: string; name: string }[]));
  }, [isSuperAdmin]);

  // Monthly summary: April to March of the financial year
  useEffect(() => {
    if (tab !== 'summary') return;
    if (!isSuperAdmin && !churchId) { setRows([]); setLoading(false); return; }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError('');
      try {
        const subs = await fetchAllPages<Record<string, any>>((a, b) => {
          let q = db.from('subscriptions').select('*').in('year', [fyStart, fyStart + 1]).order('id').range(a, b);
          if (churchId) q = q.eq('church_id', churchId);
          return q;
        });

        const result: MonthRow[] = fyMonths(fyStart).map(({ month, year }) => {
          const monthSubs = subs.filter(s => Number(s.month) === month && Number(s.year) === year);
          const values: Record<string, number> = {};
          SUBSCRIPTION_FIELDS.forEach(f => {
            const key = String(f.key);
            values[key] = monthSubs.reduce((sum, s) => sum + (Number(s[key]) || 0), 0);
          });
          const total = Object.values(values).reduce((a, b) => a + b, 0);
          return { month, year, values, total };
        });

        if (!cancelled) setRows(result);
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || 'Failed to load the report.'); setRows([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [tab, fyStart, churchId, isSuperAdmin]);

  const colTotal = (key: string) => rows.reduce((s, r) => s + (r.values[key] || 0), 0);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const buildingFund = colTotal('kattida_nidhi');
  const maxTotal = Math.max(...rows.map(r => r.total), 1);

  function summaryTable() {
    const headers = ['Month', ...SUBSCRIPTION_FIELDS.map(f => String(f.label)), 'Total'];
    const body: (string | number)[][] = rows.map(r => [
      `${MONTHS[r.month - 1]} ${r.year}`,
      ...SUBSCRIPTION_FIELDS.map(f => r.values[String(f.key)] || 0),
      r.total,
    ]);
    body.push(['TOTAL', ...SUBSCRIPTION_FIELDS.map(f => colTotal(String(f.key))), grandTotal]);
    return { headers, body };
  }

  function download(format: 'csv' | 'pdf') {
    const { headers, body } = summaryTable();
    const fileName = [cleanPart(churchName || 'All-Churches'), 'Contribution-Summary', `FY-${fyLabel(fyStart)}`].join('_');
    if (format === 'csv') downloadCsv(fileName, headers, body);
    else downloadPdf(fileName, `${churchName || 'All Churches'} - Contribution Summary FY ${fyLabel(fyStart)}`, headers, body);
  }

  const tabClass = (active: boolean) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  const needChurch = (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-sm">
      {isSuperAdmin ? 'Please choose a church above to use this tab.' : 'Your account is not linked to a church yet.'}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contribution Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {churchName || (isSuperAdmin ? 'All churches combined' : 'Your church')} · Financial year {fyLabel(fyStart)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <select
              value={churchId}
              onChange={e => setChurchId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Church"
            >
              <option value="">All churches</option>
              {churches.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setFyStart(y => y - 1)} className="p-1.5 rounded hover:bg-white" title="Previous financial year">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-bold text-slate-700 px-2">FY {fyLabel(fyStart)}</span>
            <button onClick={() => setFyStart(y => y + 1)} className="p-1.5 rounded hover:bg-white" title="Next financial year">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTab('summary')} className={tabClass(tab === 'summary')}>
          <BarChart3 className="w-4 h-4" /> Monthly Summary
        </button>
        <button onClick={() => setTab('entry')} className={tabClass(tab === 'entry')}>
          <ClipboardList className="w-4 h-4" /> Weekly Entry
        </button>
        <button onClick={() => setTab('datewise')} className={tabClass(tab === 'datewise')}>
          <CalendarDays className="w-4 h-4" /> Date-wise Report
        </button>
      </div>

      {tab === 'entry' &&
        (churchId ? <WeeklyTab churchId={churchId} churchName={churchName} /> : needChurch)}

      {tab === 'datewise' &&
        (churchId ? <DateWiseReport churchId={churchId} churchName={churchName} fyStart={fyStart} /> : needChurch)}

      {tab === 'summary' && (
        <>
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={() => download('csv')}
              disabled={loading || rows.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium border border-green-200 disabled:opacity-40"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={() => download('pdf')}
              disabled={loading || rows.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium border border-orange-200 disabled:opacity-40"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Grand Total</p>
              <p className="text-2xl font-bold text-teal-700 mt-1">₹{grandTotal.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Building Fund</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">₹{buildingFund.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Active Months</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{rows.filter(r => r.total > 0).length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-800">Monthly Contribution Chart (April to March)</h2>
            </div>
            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                {rows.map((r, i) => {
                  const height = maxTotal > 0 ? Math.max((r.total / maxTotal) * 100, r.total > 0 ? 4 : 0) : 0;
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-[32px] gap-1">
                      <div className="relative group w-full flex justify-center">
                        {r.total > 0 && (
                          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                            ₹{r.total.toLocaleString('en-IN')}
                          </div>
                        )}
                        <div
                          className="w-full bg-teal-500 hover:bg-teal-600 rounded-t transition-all cursor-default"
                          style={{ height: `${height}%`, minHeight: r.total > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{MONTHS[r.month - 1].slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <h2 className="font-bold text-slate-800">Monthly Breakdown Table</h2>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-slate-800">Month</th>
                      {SUBSCRIPTION_FIELDS.map(f => (
                        <th key={String(f.key)} className="px-2 py-3 text-right font-semibold whitespace-nowrap">{f.label}</th>
                      ))}
                      <th className="px-4 py-3 text-right font-semibold bg-teal-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={`${row.year}-${row.month}`} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}>
                        <td className={`px-4 py-2.5 font-medium text-slate-700 sticky left-0 whitespace-nowrap ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-r border-slate-200`}>
                          {MONTHS[row.month - 1]} <span className="text-slate-400">{row.year}</span>
                        </td>
                        {SUBSCRIPTION_FIELDS.map(f => {
                          const v = row.values[String(f.key)] || 0;
                          return (
                            <td key={String(f.key)} className="px-2 py-2.5 text-right text-slate-600">
                              {v > 0 ? v.toLocaleString('en-IN') : '—'}
                            </td>
                          );
                        })}
                        <td className={`px-4 py-2.5 text-right font-bold ${row.total > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                          {row.total > 0 ? row.total.toLocaleString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white">
                      <td className="px-4 py-3 font-bold text-yellow-300 sticky left-0 bg-slate-800">TOTAL</td>
                      {SUBSCRIPTION_FIELDS.map(f => {
                        const t = colTotal(String(f.key));
                        return (
                          <td key={String(f.key)} className="px-2 py-3 text-right text-yellow-200">
                            {t > 0 ? t.toLocaleString('en-IN') : '—'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-bold text-yellow-300 bg-teal-900">
                        {grandTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}