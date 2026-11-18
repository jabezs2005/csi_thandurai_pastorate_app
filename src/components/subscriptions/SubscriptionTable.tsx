import { useState, useEffect, useCallback } from 'react';
import { Save, ChevronLeft, ChevronRight, Download, FileText, Plus, X } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { Subscription, SUBSCRIPTION_FIELDS, MONTHS } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';
import { memberFileName } from '../../utils/fileNames';
import { downloadCsv, downloadPdf } from '../../utils/tableExport';
import { recordEntries } from '../../utils/contributionEntries';
import { lastSunday, isSunday, todayISO } from '../../utils/dates';
import { currentFyStart, fyLabel, fyMonths } from '../../utils/financialYear';
import DateWiseMenu from './DateWiseMenu';

/* =========================================================
   TYPES
========================================================= */

interface SubscriptionTableProps {
  memberId: string;
  churchId: string;
  memberName?: string;
  sandhaNo?: string;
  churchName?: string;
}

type RowData = Partial<Subscription> & {
  month: number;
  year: number;
  custom?: boolean; // a month added with "Add row"
};

type FieldChange = {
  key: string;
  label: string;
  oldValue: number;
  newValue: number;
};

type MonthChange = {
  month: number;
  year: number;
  monthName: string;
  oldTotal: number;
  newTotal: number;
  oldData: Record<string, number>;
  newData: Record<string, number>;
  /* ActivityLogsPage expects fieldChanges */
  fieldChanges: FieldChange[];
};

const rowKey = (r: { year: number | string; month: number | string }) =>
  `${Number(r.year)}-${Number(r.month)}`;

// Hides the increase / decrease arrows of a number box (Tailwind classes only)
const NO_ARROWS =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

/* =========================================================
   COMPONENT
========================================================= */

export default function SubscriptionTable({
  memberId,
  churchId,
  memberName,
  sandhaNo,
  churchName,
}: SubscriptionTableProps) {
  const { profile } = useAuth();

  const [fyStart, setFyStart] = useState(currentFyStart());
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .in('year', years);

      if (error) {
        console.error('Failed to fetch subscriptions:', error);
        return base;
      }

      const index = new Map<string, number>(
        base.map((r, i) => [rowKey(r), i] as [string, number])
      );

      (data || []).forEach(sub => {
        const i = index.get(rowKey(sub));
        if (i !== undefined) {
          base[i] = { ...base[i], ...sub, custom: base[i].custom };
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
        console.error('Unexpected error while fetching subscriptions:', error);
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

  function updateCell(rowIndex: number, field: string, value: string) {
    const numberValue = value === '' ? 0 : Math.max(0, Number(value) || 0);

    setRows(previous =>
      previous.map((row, index) =>
        index === rowIndex ? { ...row, [field]: numberValue } : row
      )
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

      // Load anything already saved for that month, so it is not overwritten with zeros
      const { data } = await supabase
        .from('subscriptions')
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
     TOTALS
  ========================================================= */

  function rowTotal(row: RowData): number {
    return SUBSCRIPTION_FIELDS.reduce(
      (sum, field) => sum + (Number(row[field.key]) || 0),
      0
    );
  }

  function colTotal(key: string): number {
    return rows.reduce(
      (sum, row) => sum + (Number(row[key as keyof RowData]) || 0),
      0
    );
  }

  const grandTotal = rows.reduce((sum, row) => sum + rowTotal(row), 0);

  /* =========================================================
     CLEAN CONTRIBUTION DATA (stored in the activity log)
  ========================================================= */

  function getContributionData(source: any): Record<string, number> {
    const result: Record<string, number> = {};

    SUBSCRIPTION_FIELDS.forEach(field => {
      result[field.key] = Number(source?.[field.key]) || 0;
    });

    return result;
  }

  /* =========================================================
     SAVE CHANGES
  ========================================================= */

  async function handleSave() {
    if (saving) {
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      /* 1. Current database values (the true old values) */
      const years = Array.from(new Set(rows.map(r => Number(r.year))));

      const { data: existingData, error: existingError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .in('year', years);

      if (existingError) {
        throw existingError;
      }

      /* 2. Map database records by year + month */
      const existingByKey = new Map<string, any>();

      (existingData || []).forEach(record => {
        existingByKey.set(rowKey(record), record);
      });

      /* 3. Prepare month changes */
      const monthChanges: MonthChange[] = [];
      const rowsToSave: any[] = [];

      let hasNewRecord = false;
      let hasUpdatedRecord = false;

      for (const row of rows) {
        const monthNumber = Number(row.month);
        const rowYear = Number(row.year);
        const existing = existingByKey.get(rowKey(row));

        const oldData = getContributionData(existing);
        const newData = getContributionData(row);

        const fieldChanges: FieldChange[] = [];

        SUBSCRIPTION_FIELDS.forEach(field => {
          const oldValue = oldData[field.key] || 0;
          const newValue = newData[field.key] || 0;

          if (oldValue !== newValue) {
            fieldChanges.push({
              key: field.key,
              label: field.label,
              oldValue,
              newValue,
            });
          }
        });

        /* Nothing changed in this month */
        if (fieldChanges.length === 0) {
          continue;
        }

        const oldTotal = Object.values(oldData).reduce(
          (sum, value) => sum + Number(value || 0),
          0
        );

        const newTotal = Object.values(newData).reduce(
          (sum, value) => sum + Number(value || 0),
          0
        );

        monthChanges.push({
          month: monthNumber,
          year: rowYear,
          monthName: MONTHS[monthNumber - 1],
          oldTotal,
          newTotal,
          oldData,
          newData,
          fieldChanges,
        });

        if (existing) {
          hasUpdatedRecord = true;
        } else {
          hasNewRecord = true;
        }

        rowsToSave.push({
          id: existing?.id || row.id,
          member_id: memberId,
          church_id: churchId,
          year: rowYear,
          month: monthNumber,
          ...newData,
        });
      }

      /* 4. Nothing changed */
      if (monthChanges.length === 0) {
        setSaved(true);

        setTimeout(() => {
          setSaved(false);
        }, 2000);

        return;
      }

      /* 5. New rows must not contain id: undefined */
      const cleanRows = rowsToSave.map(row => {
        if (!row.id) {
          const { id: _id, ...dataWithoutId } = row;
          void _id;
          return dataWithoutId;
        }

        return row;
      });

      /* 6. Save to database */
      const { error: saveError } = await supabase
        .from('subscriptions')
        .upsert(cleanRows, { onConflict: 'member_id,year,month' });

      if (saveError) {
        throw saveError;
      }

      /* 6b. Record the dated entry (for date-wise reports) */
      const entryDay = entryDate || lastSunday();
      const entryError = await recordEntries(
        monthChanges.flatMap(change =>
          change.fieldChanges.map(field => ({
            church_id: churchId,
            member_id: memberId,
            kind: 'subscription' as const,
            entry_date: entryDay,
            year: change.year,
            month: change.month,
            field_key: field.key,
            amount: field.newValue - field.oldValue,
            created_by: profile?.id ?? null,
          }))
        )
      );
      if (entryError) {
        alert(`Saved, but the date-wise record could not be stored: ${entryError}`);
      }

      /* 7. Member details for the log */
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('id, member_name, family_number')
        .eq('id', memberId)
        .maybeSingle();

      if (memberError) {
        console.warn('Could not fetch member details:', memberError);
      }

      const loggedMemberName = memberData?.member_name || 'Unknown Member';

      /* 8. Activity action */
      let activityAction = 'update';

      if (hasNewRecord && !hasUpdatedRecord) {
        activityAction = 'create';
      }

      /* 9. Activity log */
      if (profile?.id) {
        const changedAt = new Date().toISOString();

        await logActivity(
          profile.id,
          churchId,
          activityAction,
          'subscription',
          memberId,
          `${loggedMemberName} ${
            activityAction === 'create' ? 'created' : 'edited'
          } Contributions for FY ${fyLabel(fyStart)}`,
          {
            operation: activityAction.toUpperCase(),
            table: 'subscriptions',
            memberId,
            member_id: memberId,
            memberName: loggedMemberName,
            member_name: loggedMemberName,
            familyNumber: memberData?.family_number || null,
            year: monthChanges.length === 1 ? monthChanges[0].year : fyStart,
            financialYear: fyLabel(fyStart),
            entryDate: entryDay,

            /* Complete month-by-month history */
            monthChanges,

            changedMonths: monthChanges.map(item => item.monthName),
            changedMonthNumbers: monthChanges.map(item => item.month),
            changedFieldCount: monthChanges.reduce(
              (total, item) => total + item.fieldChanges.length,
              0
            ),

            /* Top-level values for ActivityLogsPage compatibility */
            month: monthChanges.length === 1 ? monthChanges[0].month : undefined,
            monthName: monthChanges.length === 1 ? monthChanges[0].monthName : undefined,
            oldData: monthChanges.length === 1 ? monthChanges[0].oldData : undefined,
            newData: monthChanges.length === 1 ? monthChanges[0].newData : undefined,
            fieldChanges: monthChanges.length === 1 ? monthChanges[0].fieldChanges : undefined,

            grandTotal,
            changedAt,
          }
        );
      } else {
        console.warn(
          'Subscription saved, but activity log was not created because profile.id is missing.'
        );
      }

      /* 10. Refresh data (keep the custom rows that are on screen) */
      const extras = rows
        .filter(r => r.custom)
        .map(r => ({ year: Number(r.year), month: Number(r.month) }));

      setRows(await loadRows(extras));

      /* 11. Success */
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error: any) {
      console.error('Failed to save contributions:', error);

      alert(`Failed to save contributions: ${error?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     DOWNLOADS (Excel + PDF)
     File name: Sandha-No-<no>_<member name>_<church name>_Contributions-FY-<2026-27>
  ========================================================= */

  function buildExportData() {
    const headers = ['Month', ...SUBSCRIPTION_FIELDS.map(f => f.label), 'Total'];

    const body: (string | number)[][] = rows.map(row => [
      `${MONTHS[Number(row.month) - 1]} ${row.year}`,
      ...SUBSCRIPTION_FIELDS.map(f => Number(row[f.key]) || 0),
      rowTotal(row),
    ]);

    body.push(['TOTAL', ...SUBSCRIPTION_FIELDS.map(f => colTotal(f.key)), grandTotal]);

    return { headers, body };
  }

  const exportFileName = memberFileName({
    sandhaNo: sandhaNo || '',
    memberName: memberName || '',
    churchName,
    report: `Contributions-FY-${fyLabel(fyStart)}`,
  });

  const exportTitle = [
    churchName,
    memberName,
    sandhaNo ? `Sandha No ${sandhaNo}` : '',
    `Contributions FY ${fyLabel(fyStart)}`,
  ]
    .filter(Boolean)
    .join(' - ');

  function handleDownloadExcel() {
    const { headers, body } = buildExportData();
    downloadCsv(exportFileName, headers, body);
  }

  function handleDownloadPdf() {
    const { headers, body } = buildExportData();
    downloadPdf(exportFileName, exportTitle, headers, body);
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
          <h3 className="text-lg font-bold text-slate-800">Subscription / Contributions</h3>
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

          <DateWiseMenu
            kind="subscription"
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
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-slate-800 z-10 w-40">
                Maatham
              </th>

              {SUBSCRIPTION_FIELDS.map(field => (
                <th key={field.key} className="px-2 py-3 text-center font-semibold whitespace-nowrap">
                  {field.label}
                </th>
              ))}

              <th className="px-3 py-3 text-right font-semibold bg-teal-700 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const total = rowTotal(row);
              const isEven = index % 2 === 0;

              return (
                <tr
                  key={rowKey(row)}
                  className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-teal-50 transition-colors`}
                >
                  <td
                    className={`px-3 py-2 font-medium text-slate-700 sticky left-0 z-10 ${
                      isEven ? 'bg-white' : 'bg-slate-50'
                    } border-r border-slate-200`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{MONTHS[Number(row.month) - 1]}</span>
                      <span className="text-[10px] text-slate-400">{row.year}</span>

                      {row.custom && (
                        <>
                          <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-700">custom</span>
                          <button
                            onClick={() => removeRow(index)}
                            title="Remove this row from the table"
                            className="p-0.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                  {SUBSCRIPTION_FIELDS.map(field => (
                    <td key={field.key} className="px-1 py-1.5 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row[field.key] || ''}
                        onChange={event => updateCell(index, field.key, event.target.value)}
                        onWheel={event => event.currentTarget.blur()}
                        className={`${NO_ARROWS} w-full px-1.5 py-1 text-center border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white transition-colors text-slate-700`}
                        placeholder="0"
                      />
                    </td>
                  ))}

                  <td
                    className={`px-3 py-2 text-right font-bold text-teal-700 ${
                      total > 0 ? 'bg-teal-50' : ''
                    }`}
                  >
                    {total > 0 ? total.toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-slate-800 text-white font-bold text-xs">
              <td className="px-3 py-3 sticky left-0 bg-slate-800 z-10 font-bold text-yellow-300">
                TOTAL
              </td>

              {SUBSCRIPTION_FIELDS.map(field => {
                const total = colTotal(field.key);

                return (
                  <td key={field.key} className="px-2 py-3 text-center text-yellow-200">
                    {total > 0 ? total.toLocaleString('en-IN') : '—'}
                  </td>
                );
              })}

              <td className="px-3 py-3 text-right text-yellow-300 bg-teal-900">
                {grandTotal.toLocaleString('en-IN')}
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
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
            Grand Total — All Contributions
          </p>

          <p className="text-2xl font-bold text-teal-700">₹{grandTotal.toLocaleString('en-IN')}</p>

          <p className="text-xs text-teal-600 mt-0.5">For FY {fyLabel(fyStart)}</p>
        </div>
      </div>
    </div>
  );
}