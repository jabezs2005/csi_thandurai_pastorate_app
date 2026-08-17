import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Subscription, SUBSCRIPTION_FIELDS, MONTHS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

interface SubscriptionTableProps {
  memberId: string;
  churchId: string;
}

type RowData = Partial<Subscription> & { month: number; year: number };

export default function SubscriptionTable({ memberId, churchId }: SubscriptionTableProps) {
  const { profile } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const buildEmptyRows = useCallback((): RowData[] =>
    MONTHS.map((_, i) => ({
      month: i + 1,
      year,
      member_id: memberId,
      church_id: churchId,
      sandha: 0,
      kattida_nidhi: 0,
      aalaya_paraamarippu: 0,
      narseidhi_thiruppani: 0,
      yezhaiyar_nidhi: 0,
      pengal_thiruppani: 0,
      aangal_thiruppani: 0,
      ilainyar_thiruppani: 0,
      siruvar_thiruppani: 0,
      girama_nidhi: 0,
      kalvi_nidhi: 0,
    })), [memberId, churchId, year]);

  useEffect(() => {
    async function fetchSubscriptions() {
      setLoading(true);
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .eq('year', year);

      const base = buildEmptyRows();
      if (data) {
        data.forEach(sub => {
          const idx = sub.month - 1;
          if (idx >= 0 && idx < 12) base[idx] = { ...base[idx], ...sub };
        });
      }
      setRows(base);
      setLoading(false);
    }
    fetchSubscriptions();
  }, [memberId, year, buildEmptyRows]);

  function updateCell(monthIdx: number, field: string, value: string) {
    const num = parseFloat(value) || 0;
    setRows(prev => prev.map((r, i) => i === monthIdx ? { ...r, [field]: num } : r));
    setSaved(false);
  }

  function rowTotal(row: RowData): number {
    return SUBSCRIPTION_FIELDS.reduce((sum, f) => sum + (Number(row[f.key]) || 0), 0);
  }

  function colTotal(key: string): number {
    return rows.reduce((sum, r) => sum + (Number(r[key as keyof RowData]) || 0), 0);
  }

  const grandTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);

  async function handleSave() {
    setSaving(true);
    const upserts = rows.map(r => ({
      id: r.id,
      member_id: memberId,
      church_id: churchId,
      year,
      month: r.month,
      sandha: r.sandha || 0,
      kattida_nidhi: r.kattida_nidhi || 0,
      aalaya_paraamarippu: r.aalaya_paraamarippu || 0,
      narseidhi_thiruppani: r.narseidhi_thiruppani || 0,
      yezhaiyar_nidhi: r.yezhaiyar_nidhi || 0,
      pengal_thiruppani: r.pengal_thiruppani || 0,
      aangal_thiruppani: r.aangal_thiruppani || 0,
      ilainyar_thiruppani: r.ilainyar_thiruppani || 0,
      siruvar_thiruppani: r.siruvar_thiruppani || 0,
      girama_nidhi: r.girama_nidhi || 0,
      kalvi_nidhi: r.kalvi_nidhi || 0,
    })).map(r => {
      if (!r.id) { const { id: _id, ...rest } = r; void _id; return rest; }
      return r;
    });

    await supabase.from('subscriptions').upsert(upserts, { onConflict: 'member_id,year,month' });

    if (profile) {
      logActivity(
        profile.id,
        churchId,
        'update',
        'subscription',
        memberId,
        `Updated contributions for ${year} — Grand Total: ₹${grandTotal.toLocaleString('en-IN')}`,
        { year, grandTotal }
      );
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDownloadExcel() {
    const headers = ['Month', ...SUBSCRIPTION_FIELDS.map(f => f.label), 'Total'];
    const csvRows = [
      headers.join(','),
      ...rows.map((row, idx) => {
        const total = rowTotal(row);
        const values = SUBSCRIPTION_FIELDS.map(f => Number(row[f.key]) || 0);
        return [MONTHS[idx], ...values, total].join(',');
      }),
      ['TOTAL', ...SUBSCRIPTION_FIELDS.map(f => colTotal(f.key)), grandTotal].join(','),
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contributions-${year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">Subscription / Contributions</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setYear(y => y - 1)} className="p-1 rounded hover:bg-white transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-bold text-slate-700 px-2">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1 rounded hover:bg-white transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              saved ? 'bg-green-100 text-green-700' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
            }`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-slate-800 z-10 w-28">Maatham</th>
              {SUBSCRIPTION_FIELDS.map(f => (
                <th key={f.key} className="px-2 py-3 text-center font-semibold whitespace-nowrap">{f.label}</th>
              ))}
              <th className="px-3 py-3 text-right font-semibold bg-teal-700 whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const total = rowTotal(row);
              const isEven = idx % 2 === 0;
              return (
                <tr key={row.month} className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}>
                  <td className={`px-3 py-2 font-medium text-slate-700 sticky left-0 z-10 ${isEven ? 'bg-white' : 'bg-slate-50'} border-r border-slate-200`}>
                    {MONTHS[idx]}
                  </td>
                  {SUBSCRIPTION_FIELDS.map(f => (
                    <td key={f.key} className="px-1 py-1.5 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row[f.key] || ''}
                        onChange={e => updateCell(idx, f.key, e.target.value)}
                        className="w-full px-1.5 py-1 text-center border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white transition-colors text-slate-700"
                        placeholder="0"
                      />
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right font-bold text-teal-700 ${total > 0 ? 'bg-teal-50' : ''}`}>
                    {total > 0 ? total.toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white font-bold text-xs">
              <td className="px-3 py-3 sticky left-0 bg-slate-800 z-10 font-bold text-yellow-300">TOTAL</td>
              {SUBSCRIPTION_FIELDS.map(f => (
                <td key={f.key} className="px-2 py-3 text-center text-yellow-200">
                  {colTotal(f.key) > 0 ? colTotal(f.key).toLocaleString('en-IN') : '—'}
                </td>
              ))}
              <td className="px-3 py-3 text-right text-yellow-300 bg-teal-900">
                {grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">Grand Total — All Contributions</p>
          <p className="text-2xl font-bold text-teal-700">₹{grandTotal.toLocaleString('en-IN')}</p>
          <p className="text-xs text-teal-600 mt-0.5">For {year}</p>
        </div>
      </div>
    </div>
  );
}
