import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronLeft, ChevronRight, Download, FileText, Users, ChevronDown } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { BuildingConstructionFund, MONTHS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';
import { sortMembersByFamily } from '../../utils/familyUtils';
import { memberFileName, allMembersFileName } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';

interface BuildingConstructionFundTableProps {
  memberId: string;
  churchId: string;
  memberName: string;
  sandhaNo?: string;
  churchName?: string;
}

type RowData = Partial<BuildingConstructionFund> & {
  month: number;
  year: number;
};

type MonthChange = {
  month: number;
  monthName: string;
  oldValue: number;
  newValue: number;
};

interface MemberLite {
  id: string;
  church_id: string;
  family_number: string;
  title: string | null;
  member_name: string;
}

interface FundLite {
  member_id: string;
  month: number;
  amount: number | null;
}

// Supabase returns at most 1,000 rows per request, so read everything in pages
async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export default function BuildingConstructionFundTable({
  memberId,
  churchId,
  memberName,
  sandhaNo,
  churchName,
}: BuildingConstructionFundTableProps) {
  const { profile } = useAuth();

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [allMenuOpen, setAllMenuOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  /* =========================================================
     BUILD EMPTY MONTHS
  ========================================================= */

  const buildEmptyRows = useCallback(
    (): RowData[] =>
      MONTHS.map((_, i) => ({
        month: i + 1,
        year,
        member_id: memberId,
        church_id: churchId,
        amount: 0,
      })),
    [memberId, churchId, year]
  );

  /* =========================================================
     FETCH BUILDING FUND
  ========================================================= */

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('building_construction_fund')
          .select('*')
          .eq('member_id', memberId)
          .eq('church_id', churchId)
          .eq('year', year)
          .order('month', { ascending: true });

        if (error) {
          console.error('Failed to fetch building construction fund:', error);
          setRows(buildEmptyRows());
          return;
        }

        const base = buildEmptyRows();

        if (data) {
          data.forEach(row => {
            const idx = Number(row.month) - 1;

            if (idx >= 0 && idx < 12) {
              base[idx] = { ...base[idx], ...row };
            }
          });
        }

        setRows(base);
      } catch (error) {
        console.error('Unexpected error while fetching building fund:', error);
        setRows(buildEmptyRows());
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [memberId, churchId, year, buildEmptyRows]);

  /* =========================================================
     UPDATE CELL
  ========================================================= */

  function updateCell(monthIdx: number, value: string) {
    const num = value === '' ? 0 : Math.max(0, parseFloat(value) || 0);

    setRows(previous =>
      previous.map((row, index) => (index === monthIdx ? { ...row, amount: num } : row))
    );

    setSaved(false);
  }

  /* =========================================================
     GRAND TOTAL
  ========================================================= */

  const grandTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  /* =========================================================
     SAVE CHANGES

     Only changed months are saved, and exactly ONE
     activity log is created per Save.
  ========================================================= */

  async function handleSave() {
    if (saving) {
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      /* 1. Current database values */
      const { data: existingData, error: existingError } = await supabase
        .from('building_construction_fund')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .eq('year', year);

      if (existingError) {
        throw existingError;
      }

      /* 2. Map existing records by month */
      const existingByMonth = new Map<number, any>();

      (existingData || []).forEach(record => {
        existingByMonth.set(Number(record.month), record);
      });

      /* 3. Find only changed months */
      const monthChanges: MonthChange[] = [];
      const rowsToSave: any[] = [];

      for (const row of rows) {
        const monthNumber = Number(row.month);
        const existing = existingByMonth.get(monthNumber);

        const oldValue = Number(existing?.amount || 0);
        const newValue = Number(row.amount || 0);

        if (oldValue !== newValue) {
          monthChanges.push({
            month: monthNumber,
            monthName: MONTHS[monthNumber - 1],
            oldValue,
            newValue,
          });

          rowsToSave.push({
            id: row.id,
            member_id: memberId,
            church_id: churchId,
            year,
            month: monthNumber,
            amount: newValue,
          });
        }
      }

      /* 4. Nothing changed */
      if (monthChanges.length === 0) {
        setSaved(true);

        setTimeout(() => {
          setSaved(false);
        }, 2000);

        return;
      }

      /* 5. Remove id for new records */
      const cleanRows = rowsToSave.map(row => {
        if (!row.id) {
          const { id: _id, ...withoutId } = row;
          void _id;
          return withoutId;
        }

        return row;
      });

      /* 6. Save changed months */
      const { error: saveError } = await supabase
        .from('building_construction_fund')
        .upsert(cleanRows, { onConflict: 'member_id,year,month' });

      if (saveError) {
        throw saveError;
      }

      /* 7. One activity log */
      if (profile?.id) {
        const changedAt = new Date().toISOString();

        await logActivity(
          profile.id,
          churchId,
          'update',
          'building_construction_fund',
          memberId,
          `${memberName} edited Building Construction Fund for ${year}`,
          {
            operation: 'UPDATE',
            table: 'building_construction_fund',
            memberId,
            memberName,
            year,
            monthChanges,
            changedMonths: monthChanges.map(item => item.monthName),
            changedMonthNumbers: monthChanges.map(item => item.month),
            changedFieldCount: monthChanges.length,
            grandTotal,
            changedAt,
          }
        );
      } else {
        console.warn(
          'Building fund saved, but activity log was not created because profile.id is missing.'
        );
      }

      /* 8. Refresh data */
      const { data: refreshedData } = await supabase
        .from('building_construction_fund')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .eq('year', year)
        .order('month', { ascending: true });

      const refreshedRows = buildEmptyRows();

      (refreshedData || []).forEach(row => {
        const idx = Number(row.month) - 1;

        if (idx >= 0 && idx < 12) {
          refreshedRows[idx] = { ...refreshedRows[idx], ...row };
        }
      });

      setRows(refreshedRows);

      /* 9. Success */
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error: any) {
      console.error('Failed to save building construction fund:', error);

      alert(`Failed to save building construction fund: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     DOWNLOADS: ONE MEMBER (Excel + PDF)
     File name: Sandha-No-<no>_<member name>_<church name>_Building-Fund-<year>
  ========================================================= */

  const memberExportName = memberFileName({
    sandhaNo: sandhaNo || '',
    memberName,
    churchName,
    report: `Building-Fund-${year}`,
  });

  const memberExportTitle = [
    churchName,
    memberName,
    sandhaNo ? `Sandha No ${sandhaNo}` : '',
    `Building Construction Fund ${year}`,
  ]
    .filter(Boolean)
    .join(' - ');

  function memberExportData() {
    const headers = ['Month', 'Amount (Rs.)'];

    const body: (string | number)[][] = rows.map((row, idx) => [
      MONTHS[idx],
      Number(row.amount) || 0,
    ]);

    body.push(['TOTAL', grandTotal]);

    return { headers, body };
  }

  function handleDownloadExcel() {
    const { headers, body } = memberExportData();
    downloadCsv(memberExportName, headers, body);
  }

  function handleDownloadPdf() {
    const { headers, body } = memberExportData();
    downloadPdf(memberExportName, memberExportTitle, headers, body);
  }

  /* =========================================================
     DOWNLOADS: ALL MEMBERS OF THE CHURCH (Excel + PDF)
     File name: <church name>_All-Members_Building-Fund-<year>
  ========================================================= */

  async function buildAllMembersData() {
    const [members, funds] = await Promise.all([
      fetchAllPages<MemberLite>((from, to) =>
        supabase
          .from('members')
          .select('id, church_id, family_number, title, member_name')
          .eq('church_id', churchId)
          .order('id')
          .range(from, to)
      ),
      fetchAllPages<FundLite>((from, to) =>
        supabase
          .from('building_construction_fund')
          .select('member_id, month, amount')
          .eq('church_id', churchId)
          .eq('year', year)
          .order('id')
          .range(from, to)
      ),
    ]);

    // member id -> 12 monthly amounts
    const byMember = new Map<string, number[]>();

    funds.forEach(f => {
      const idx = Number(f.month) - 1;
      if (idx < 0 || idx > 11) return;
      if (!byMember.has(f.member_id)) byMember.set(f.member_id, Array(12).fill(0));
      byMember.get(f.member_id)![idx] += Number(f.amount) || 0;
    });

    const headers = ['Sandha No', 'Title', 'Member Name', ...MONTHS, 'Total'];
    const monthTotals: number[] = Array(12).fill(0);
    let everyoneTotal = 0;

    const body: (string | number)[][] = sortMembersByFamily(members).map(m => {
      const amounts = byMember.get(m.id) || Array(12).fill(0);
      const total = amounts.reduce((sum, v) => sum + v, 0);

      amounts.forEach((v, i) => {
        monthTotals[i] += v;
      });
      everyoneTotal += total;

      return [m.family_number, m.title || '', m.member_name, ...amounts, total];
    });

    body.push(['', '', 'TOTAL', ...monthTotals, everyoneTotal]);

    return { headers, body, count: members.length };
  }

  async function handleDownloadAll(kind: 'csv' | 'pdf') {
    if (exportingAll) return;

    setExportingAll(true);
    setAllMenuOpen(false);

    try {
      const { headers, body } = await buildAllMembersData();
      const fileName = allMembersFileName(churchName, `Building-Fund-${year}`);

      if (kind === 'csv') {
        downloadCsv(fileName, headers, body);
      } else {
        const title = [churchName, `All Members - Building Construction Fund ${year}`]
          .filter(Boolean)
          .join(' - ');
        downloadPdf(fileName, title, headers, body);
      }
    } catch (error: any) {
      console.error('Failed to download all members building fund:', error);
      alert(`Failed to download: ${error?.message || 'Unknown error'}`);
    } finally {
      setExportingAll(false);
    }
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-slate-800">Building Construction Fund</h3>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setYear(current => current - 1)}
              className="p-1 rounded hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            <span className="text-sm font-bold text-slate-700 px-2">{year}</span>

            <button
              onClick={() => setYear(current => current + 1)}
              className="p-1 rounded hover:bg-white transition-colors"
            >
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
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>

          {/* All members' building construction fund */}
          <div className="relative">
            <button
              onClick={() => setAllMenuOpen(open => !open)}
              disabled={exportingAll}
              className="flex items-center gap-2 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 text-amber-700 text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Users className="w-4 h-4" />
              {exportingAll ? 'Preparing...' : 'All members'}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {allMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAllMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                  <p className="px-3 py-1.5 text-xs text-slate-500">
                    All members' Building Fund, {year}
                  </p>
                  <button
                    onClick={() => handleDownloadAll('csv')}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="w-4 h-4" />
                    Download Excel
                  </button>
                  <button
                    onClick={() => handleDownloadAll('pdf')}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-100 text-green-700'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
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
                <tr
                  key={row.month}
                  className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}
                >
                  <td
                    className={`px-4 py-2.5 font-medium text-slate-700 ${
                      isEven ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    {MONTHS[idx]}
                  </td>

                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.amount || ''}
                      onChange={event => updateCell(idx, event.target.value)}
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
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
            Total Building Construction Fund
          </p>

          <p className="text-2xl font-bold text-amber-700">Rs. {grandTotal.toLocaleString('en-IN')}</p>

          <p className="text-xs text-amber-600 mt-0.5">For {year}</p>
        </div>
      </div>
    </div>
  );
}