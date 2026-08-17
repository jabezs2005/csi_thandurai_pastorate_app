import { useState, useEffect } from 'react';
import { BarChart3, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SUBSCRIPTION_FIELDS, MONTHS } from '../../types';

interface MonthlyTotal {
  month: number;
  sandha: number;
  kattida_nidhi: number;
  aalaya_paraamarippu: number;
  narseidhi_thiruppani: number;
  yezhaiyar_nidhi: number;
  pengal_thiruppani: number;
  aangal_thiruppani: number;
  ilainyar_thiruppani: number;
  siruvar_thiruppani: number;
  girama_nidhi: number;
  kalvi_nidhi: number;
  total: number;
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      let query = supabase.from('subscriptions').select('*').eq('year', year);
      if (!isSuperAdmin && profile?.church_id) {
        query = query.eq('church_id', profile.church_id);
      }
      const { data } = await query;
      const subs = data || [];

      const monthly: MonthlyTotal[] = MONTHS.map((_, i) => {
        const monthSubs = subs.filter(s => s.month === i + 1);
        const row: MonthlyTotal = {
          month: i + 1,
          sandha: 0, kattida_nidhi: 0, aalaya_paraamarippu: 0,
          narseidhi_thiruppani: 0, yezhaiyar_nidhi: 0, pengal_thiruppani: 0,
          aangal_thiruppani: 0, ilainyar_thiruppani: 0, siruvar_thiruppani: 0,
          girama_nidhi: 0, kalvi_nidhi: 0, total: 0,
        };
        monthSubs.forEach(s => {
          SUBSCRIPTION_FIELDS.forEach(f => {
            row[f.key as keyof MonthlyTotal] = (row[f.key as keyof MonthlyTotal] as number) + (s[f.key] || 0);
          });
          row.total += SUBSCRIPTION_FIELDS.reduce((sum, f) => sum + (s[f.key] || 0), 0);
        });
        return row;
      });

      setMonthlyTotals(monthly);
      setLoading(false);
    }
    fetchReport();
  }, [year, isSuperAdmin, profile]);

  const grandTotal = monthlyTotals.reduce((s, r) => s + r.total, 0);
  const buildingFund = monthlyTotals.reduce((s, r) => s + r.kattida_nidhi, 0);
  const maxTotal = Math.max(...monthlyTotals.map(r => r.total), 1);

  function exportCSV() {
    const headers = ['Month', ...SUBSCRIPTION_FIELDS.map(f => f.label), 'Total'];
    const rows = monthlyTotals.map(r => [
      MONTHS[r.month - 1],
      ...SUBSCRIPTION_FIELDS.map(f => String(r[f.key as keyof MonthlyTotal] || 0)),
      String(r.total),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `church-report-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contribution Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">{isSuperAdmin ? 'All churches combined' : 'Your church'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 rounded text-sm hover:bg-white transition-colors text-slate-600">◀</button>
            <span className="text-sm font-bold text-slate-700 px-2">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 rounded text-sm hover:bg-white transition-colors text-slate-600">▶</button>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

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
          <p className="text-2xl font-bold text-slate-700 mt-1">{monthlyTotals.filter(r => r.total > 0).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-teal-600" />
          <h2 className="font-bold text-slate-800">Monthly Contribution Chart</h2>
        </div>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
            {monthlyTotals.map((r, i) => {
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
                  <span className="text-xs text-slate-500">{MONTHS[i].slice(0, 3)}</span>
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
                    <th key={f.key} className="px-2 py-3 text-right font-semibold whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold bg-teal-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTotals.map((row, i) => (
                  <tr key={row.month} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}>
                    <td className={`px-4 py-2.5 font-medium text-slate-700 sticky left-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-r border-slate-200`}>{MONTHS[i]}</td>
                    {SUBSCRIPTION_FIELDS.map(f => (
                      <td key={f.key} className="px-2 py-2.5 text-right text-slate-600">
                        {(row[f.key as keyof MonthlyTotal] as number) > 0 ? (row[f.key as keyof MonthlyTotal] as number).toLocaleString('en-IN') : '—'}
                      </td>
                    ))}
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
                    const t = monthlyTotals.reduce((s, r) => s + (r[f.key as keyof MonthlyTotal] as number), 0);
                    return <td key={f.key} className="px-2 py-3 text-right text-yellow-200">{t > 0 ? t.toLocaleString('en-IN') : '—'}</td>;
                  })}
                  <td className="px-4 py-3 text-right font-bold text-yellow-300 bg-teal-900">{grandTotal.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
