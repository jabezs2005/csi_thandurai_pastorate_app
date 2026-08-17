import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { BuildingConstructionFund, MONTHS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

interface BuildingConstructionFundTableProps {
  memberId: string;
  churchId: string;
  memberName: string;
}

type RowData = Partial<BuildingConstructionFund> & { month: number; year: number };

export default function BuildingConstructionFundTable({ memberId, churchId, memberName }: BuildingConstructionFundTableProps) {
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
      amount: 0,
    })), [memberId, churchId, year]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data } = await supabase
        .from('building_construction_fund')
        .select('*')
        .eq('member_id', memberId)
        .eq('year', year);

      const base = buildEmptyRows();
      if (data) {
        data.forEach(row => {
          const idx = row.month - 1;
          if (idx >= 0 && idx < 12) base[idx] = { ...base[idx], ...row };
        });
      }
      setRows(base);
      setLoading(false);
    }
    fetchData();
  }, [memberId, year, buildEmptyRows]);

  function updateCell(monthIdx: number, value: string) {
    const num = parseFloat(value) || 0;
    setRows(prev => prev.map((r, i) => i === monthIdx ? { ...r, amount: num } : r));
    setSaved(false);
  }

  const grandTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  async function handleSave() {
    setSaving(true);
    const upserts = rows.map(r => ({
      id: r.id,
      member_id: memberId,
      church_id: churchId,
      year,
      month: r.month,
      amount: r.amount || 0,
    })).map(r => {
      if (!r.id) { const { id: _id, ...rest } = r; void _id; return rest; }
      return r;
    });

    await supabase.from('building_construction_fund').upsert(upserts, { onConflict: 'member_id,year,month' });

    if (profile) {
      logActivity(
        profile.id,
        churchId,
        'update',
        'building_construction_fund',
        memberId,
        `Updated building construction fund for ${memberName} (${year}) — Total: Rs. ${grandTotal.toLocaleString('en-IN')}`,
        { year, grandTotal }
      );
    }

    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDownloadExcel() {
    const headers = ['Month', 'Amount (Rs.)'];
    const csvRows = [
      headers.join(','),
      ...rows.map((row, idx) => {
        const amount = Number(row.amount) || 0;
        return `${MONTHS[idx]},${amount}`;
      }),
      `TOTAL,${grandTotal}`,
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `building-construction-fund-${memberName}-${year}.csv`);
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
        <h3 className="text-lg font-bold text-slate-800">Building Construction Fund</h3>
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
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left font-semibold w-40">Month</th>
              <th className="px-4 py-3 text-right font-semibold w-48">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <tr key={row.month} className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}>
                  <td className={`px-4 py-2.5 font-medium text-slate-700 ${isEven ? 'bg-white' : 'bg-slate-50'}`}>
                    {MONTHS[idx]}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.amount || ''}
                      onChange={e => updateCell(idx, e.target.value)}
                      className="w-full px-3 py-1.5 text-right border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white transition-colors text-slate-700"
                      placeholder="0"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white font-bold text-sm">
              <td className="px-4 py-3 font-bold text-yellow-300">TOTAL</td>
              <td className="px-4 py-3 text-right text-yellow-300 bg-teal-900">
                {grandTotal > 0 ? `Rs. ${grandTotal.toLocaleString('en-IN')}` : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Total Building Construction Fund</p>
          <p className="text-2xl font-bold text-amber-700">Rs. {grandTotal.toLocaleString('en-IN')}</p>
          <p className="text-xs text-amber-600 mt-0.5">For {year}</p>
        </div>
      </div>
    </div>
  );
}
