import { useState, useEffect, useCallback } from 'react';
import {
  Save, ChevronLeft, ChevronRight, Download, FileText, Users, ChevronDown, Plus, X,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { BuildingConstructionFund, MONTHS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';
import { sortMembersByFamily } from '../../utils/familyUtils';
import { memberFileName, allMembersFileName } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';
import { fetchAllPages } from '../../utils/fetchAll';
import { recordEntries } from '../../utils/contributionEntries';
import { lastSunday, isSunday, todayISO } from '../../utils/dates';
import { currentFyStart, fyLabel, fyMonths } from '../../utils/financialYear';
import DateWiseMenu from './DateWiseMenu';

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
  custom?: boolean; // a month added with "Add row"
};

type MonthChange = {
  month: number;
  year: number;
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
  year: number;
  month: number;
  amount: number | null;
}

const rowKey = (r: { year: number | string; month: number | string }) =>
  `${Number(r.year)}-${Number(r.month)}`;

// Hides the increase / decrease arrows of a number box (Tailwind classes only)
const NO_ARROWS =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

export default function BuildingConstructionFundTable({
  memberId,
  churchId,
  memberName,
  sandhaNo,
  churchName,
}: BuildingConstructionFundTableProps) {
  const { profile } = useAuth();

  const [fyStart, setFyStart] = useState(currentFyStart());
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [allMenuOpen, setAllMenuOpen] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [entryDate, setEntryDate] = useState(lastSunday());

  // "Add row" (custom month)
  const [showAdd, setShowAdd] = useState(false);
  const [addMonth, setAddMonth] = useState(1);
  const [addYear, setAddYear] = useState(currentFyStart());
  const [addMessage, setAddMessage] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  /* =========================================================
     BUILD ROWS
  ========================================================= */

  const makeRow = useCallback(
    (month: number, year: number, custom = false): RowData => ({
      month,
      year,
      custom,
      member_id: memberId,
      church_id: churchId,
      amount: 0,
    }),
    [memberId, churchId]
  );

  // April ... March of the selected financial year
  const buildEmptyRows = useCallback(
    (): RowData[] => fyMonths(fyStart).map(m => makeRow(m.month, m.year)),
    [fyStart, makeRow]
  );

  /* =========================================================
     LOAD ROWS (financial year + any custom months)
  ========================================================= */

  const loadRows = useCallback(
    async (extras: { year: number; month: number }[] = []): Promise<RowData[]> => {
      const base = buildEmptyRows();
      extras.forEach(e => base.push(makeRow(e.month, e.year, true)));

      const years = Array.from(new Set(base.map(r => Number(r.year))));

      const { data, error } = await supabase
        .from('building_construction_fund')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .in('year', years);

      if (error) {
        console.error('Failed to fetch building construction fund:', error);
        return base;
      }

      const index = new Map<string, number>(
        base.map((r, i) => [rowKey(r), i] as [string, number])
      );

      (data || []).forEach(record => {
        const i = index.get(rowKey(record));
        if (i !== undefined) {
          base[i] = { ...base[i], ...record, custom: base[i].custom };
        }
      });

      return base;
    },
    [memberId, churchId, buildEmptyRows, makeRow]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);

      try {
        const result = await loadRows();
        if (!cancelled) setRows(result);
      } catch (error) {
        console.error('Unexpected error while fetching building fund:', error);
        if (!cancelled) setRows(buildEmptyRows());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [loadRows, buildEmptyRows]);

  /* =========================================================
     UPDATE CELL
  ========================================================= */

  function updateCell(rowIndex: number, value: string) {
    const num = value === '' ? 0 : Math.max(0, parseFloat(value) || 0);

    setRows(previous =>
      previous.map((row, index) => (index === rowIndex ? { ...row, amount: num } : row))
    );

    setSaved(false);
  }

  /* =========================================================
     ADD / REMOVE A CUSTOM MONTH ROW
  ========================================================= */

  async function handleAddRow() {
    const key = `${addYear}-${addMonth}`;

    if (rows.some(r => rowKey(r) === key)) {
      setAddMessage('That month is already in the table.');
      return;
    }

    setAddBusy(true);
    setAddMessage('');

    try {
      const fresh = makeRow(addMonth, addYear, true);

      // Load anything already saved for that month, so it is not overwritten with zero
      const { data } = await supabase
        .from('building_construction_fund')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .eq('year', addYear)
        .eq('month', addMonth)
        .maybeSingle();

      const newRow: RowData = data ? { ...fresh, ...data, custom: true } : fresh;

      setRows(previous => {
        const normal = previous.filter(r => !r.custom);
        const extra = [...previous.filter(r => r.custom), newRow].sort(
          (a, b) => Number(a.year) - Number(b.year) || Number(a.month) - Number(b.month)
        );
        return [...normal, ...extra];
      });

      setShowAdd(false);
      setSaved(false);
    } finally {
      setAddBusy(false);
    }
  }

  function removeRow(rowIndex: number) {
    setRows(previous => previous.filter((_, index) => index !== rowIndex));
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
      const years = Array.from(new Set(rows.map(r => Number(r.year))));

      const { data: existingData, error: existingError } = await supabase
        .from('building_construction_fund')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .in('year', years);

      if (existingError) {
        throw existingError;
      }

      /* 2. Map existing records by year + month */
      const existingByKey = new Map<string, any>();

      (existingData || []).forEach(record => {
        existingByKey.set(rowKey(record), record);
      });

      /* 3. Find only changed months */
      const monthChanges: MonthChange[] = [];
      const rowsToSave: any[] = [];

      for (const row of rows) {
        const monthNumber = Number(row.month);
        const rowYear = Number(row.year);
        const existing = existingByKey.get(rowKey(row));

        const oldValue = Number(existing?.amount || 0);
        const newValue = Number(row.amount || 0);

        if (oldValue !== newValue) {
          monthChanges.push({
            month: monthNumber,
            year: rowYear,
            monthName: MONTHS[monthNumber - 1],
            oldValue,
            newValue,
          });

          rowsToSave.push({
            id: existing?.id || row.id,
            member_id: memberId,
            church_id: churchId,
            year: rowYear,
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

      /* 6b. Record the dated entry (for date-wise reports) */
      const entryDay = entryDate || lastSunday();
      const entryError = await recordEntries(
        monthChanges.map(change => ({
          church_id: churchId,
          member_id: memberId,
          kind: 'building_fund' as const,
          entry_date: entryDay,
          year: change.year,
          month: change.month,
          field_key: 'amount',
          amount: change.newValue - change.oldValue,
          created_by: profile?.id ?? null,
        }))
      );
      if (entryError) {
        alert(`Saved, but the date-wise record could not be stored: ${entryError}`);
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
          `${memberName} edited Building Construction Fund for FY ${fyLabel(fyStart)}`,
          {
            operation: 'UPDATE',
            table: 'building_construction_fund',
            memberId,
            memberName,
            year: monthChanges.length === 1 ? monthChanges[0].year : fyStart,
            financialYear: fyLabel(fyStart),
            entryDate: entryDay,
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

      /* 8. Refresh data (keep the custom rows that are on screen) */
      const extras = rows
        .filter(r => r.custom)
        .map(r => ({ year: Number(r.year), month: Number(r.month) }));

      setRows(await loadRows(extras));

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
     File name: Sandha-No-<no>_<member name>_<church name>_Building-Fund-FY-<2026-27>
  ========================================================= */

  const memberExportName = memberFileName({
    sandhaNo: sandhaNo || '',
    memberName,
    churchName,
    report: `Building-Fund-FY-${fyLabel(fyStart)}`,
  });

  const memberExportTitle = [
    churchName,
    memberName,
    sandhaNo ? `Sandha No ${sandhaNo}` : '',
    `Building Construction Fund FY ${fyLabel(fyStart)}`,
  ]
    .filter(Boolean)
    .join(' - ');

  function memberExportData() {
    const headers = ['Month', 'Amount (Rs.)'];

    const body: (string | number)[][] = rows.map(row => [
      `${MONTHS[Number(row.month) - 1]} ${row.year}`,
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
     Columns run April ... March of the selected financial year
  ========================================================= */

  async function buildAllMembersData() {
    const months = fyMonths(fyStart);

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
          .select('member_id, year, month, amount')
          .eq('church_id', churchId)
          .in('year', [fyStart, fyStart + 1])
          .order('id')
          .range(from, to)
      ),
    ]);

    // year-month -> column position (0 = April ... 11 = March)
    const slot = new Map<string, number>(
      months.map((m, i) => [`${m.year}-${m.month}`, i] as [string, number])
    );

    // member id -> 12 monthly amounts
    const byMember = new Map<string, number[]>();

    funds.forEach(f => {
      const idx = slot.get(rowKey(f));
      if (idx === undefined) return;
      if (!byMember.has(f.member_id)) byMember.set(f.member_id, Array(12).fill(0));
      byMember.get(f.member_id)![idx] += Number(f.amount) || 0;
    });

    const headers = [
      'Sandha No',
      'Title',
      'Member Name',
      ...months.map(m => `${MONTHS[m.month - 1]} ${m.year}`),
      'Total',
    ];

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

    return { headers, body };
  }

  async function handleDownloadAll(kind: 'csv' | 'pdf') {
    if (exportingAll) return;

    setExportingAll(true);
    setAllMenuOpen(false);

    try {
      const { headers, body } = await buildAllMembersData();
      const fileName = allMembersFileName(churchName, `Building-Fund-FY-${fyLabel(fyStart)}`);

      if (kind === 'csv') {
        downloadCsv(fileName, headers, body);
      } else {
        const title = [churchName, `All Members - Building Construction Fund FY ${fyLabel(fyStart)}`]
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

  const addYears = Array.from({ length: 11 }, (_, i) => fyStart - 5 + i);

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Building Construction Fund</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Financial year {fyLabel(fyStart)} (April {fyStart} to March {fyStart + 1})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setFyStart(current => current - 1)}
              className="p-1 rounded hover:bg-white transition-colors"
              title="Previous financial year"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            <span className="text-sm font-bold text-slate-700 px-2">FY {fyLabel(fyStart)}</span>

            <button
              onClick={() => setFyStart(current => current + 1)}
              className="p-1 rounded hover:bg-white transition-colors"
              title="Next financial year"
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
                    All members' Building Fund, FY {fyLabel(fyStart)}
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

          <DateWiseMenu
            kind="building_fund"
            churchId={churchId}
            churchName={churchName}
            memberId={memberId}
            fyStart={fyStart}
          />

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Entry date</label>
            <input
              type="date"
              value={entryDate}
              max={todayISO()}
              onChange={e => setEntryDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
            />
            {entryDate && !isSunday(entryDate) && <span className="text-xs text-amber-600">not a Sunday</span>}
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
              <th className="px-4 py-3 text-left font-semibold w-56">Month</th>
              <th className="px-4 py-3 text-right font-semibold w-48">Amount (Rs.)</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const isEven = idx % 2 === 0;

              return (
                <tr
                  key={rowKey(row)}
                  className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}
                >
                  <td
                    className={`px-4 py-2.5 font-medium text-slate-700 ${
                      isEven ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{MONTHS[Number(row.month) - 1]}</span>
                      <span className="text-xs text-slate-400">{row.year}</span>

                      {row.custom && (
                        <>
                          <span className="text-[10px] px-1.5 rounded bg-amber-100 text-amber-700">custom</span>
                          <button
                            onClick={() => removeRow(idx)}
                            title="Remove this row from the table"
                            className="p-0.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-2 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.amount || ''}
                      onChange={event => updateCell(idx, event.target.value)}
                      onWheel={event => event.currentTarget.blur()}
                      className={`${NO_ARROWS} w-full px-3 py-1.5 text-right border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white transition-colors text-slate-700`}
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

      {/* Add a custom month row */}
      <div className="mt-3">
        {!showAdd ? (
          <button
            onClick={() => {
              setAddYear(fyStart);
              setAddMessage('');
              setShowAdd(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-teal-400"
          >
            <Plus className="w-4 h-4" />
            Add row (custom month)
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <select
              value={addMonth}
              onChange={e => setAddMonth(Number(e.target.value))}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Month"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={addYear}
              onChange={e => setAddYear(Number(e.target.value))}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Year"
            >
              {addYears.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={handleAddRow}
              disabled={addBusy}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {addBusy ? 'Adding...' : 'Add'}
            </button>

            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white"
            >
              Cancel
            </button>

            {addMessage && <span className="text-xs text-red-600">{addMessage}</span>}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
            Total Building Construction Fund
          </p>

          <p className="text-2xl font-bold text-amber-700">Rs. {grandTotal.toLocaleString('en-IN')}</p>

          <p className="text-xs text-amber-600 mt-0.5">For FY {fyLabel(fyStart)}</p>
        </div>
      </div>
    </div>
  );
}