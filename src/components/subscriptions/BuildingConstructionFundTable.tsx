import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import {
  BuildingConstructionFund,
  MONTHS,
} from '../../types';

import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

interface BuildingConstructionFundTableProps {
  memberId: string;
  churchId: string;
  memberName: string;
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

export default function BuildingConstructionFundTable({
  memberId,
  churchId,
  memberName,
}: BuildingConstructionFundTableProps) {
  const { profile } = useAuth();

  const [year, setYear] = useState(
    new Date().getFullYear()
  );

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /*
   * =========================================================
   * BUILD EMPTY MONTHS
   * =========================================================
   */

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

  /*
   * =========================================================
   * FETCH BUILDING FUND
   * =========================================================
   */

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      try {
        const {
          data,
          error,
        } = await supabase
          .from(
            'building_construction_fund'
          )
          .select('*')
          .eq(
            'member_id',
            memberId
          )
          .eq(
            'church_id',
            churchId
          )
          .eq(
            'year',
            year
          )
          .order('month', {
            ascending: true,
          });

        if (error) {
          console.error(
            'Failed to fetch building construction fund:',
            error
          );

          setRows(
            buildEmptyRows()
          );

          return;
        }

        const base =
          buildEmptyRows();

        if (data) {
          data.forEach((row) => {
            const idx =
              Number(row.month) - 1;

            if (
              idx >= 0 &&
              idx < 12
            ) {
              base[idx] = {
                ...base[idx],
                ...row,
              };
            }
          });
        }

        setRows(base);
      } catch (error) {
        console.error(
          'Unexpected error while fetching building fund:',
          error
        );

        setRows(
          buildEmptyRows()
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [
    memberId,
    churchId,
    year,
    buildEmptyRows,
  ]);

  /*
   * =========================================================
   * UPDATE CELL
   * =========================================================
   */

  function updateCell(
    monthIdx: number,
    value: string
  ) {
    const num =
      value === ''
        ? 0
        : Math.max(
            0,
            parseFloat(value) || 0
          );

    setRows((previous) =>
      previous.map(
        (row, index) =>
          index === monthIdx
            ? {
                ...row,
                amount: num,
              }
            : row
      )
    );

    setSaved(false);
  }

  /*
   * =========================================================
   * GRAND TOTAL
   * =========================================================
   */

  const grandTotal =
    rows.reduce(
      (sum, row) =>
        sum +
        (Number(
          row.amount
        ) || 0),
      0
    );

  /*
   * =========================================================
   * SAVE CHANGES
   *
   * IMPORTANT:
   *
   * Only changed months are saved.
   *
   * Exactly ONE activity log is created
   * for one Save operation.
   * =========================================================
   */

  async function handleSave() {
    if (saving) {
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      /*
       * -------------------------------------------------------
       * 1. FETCH CURRENT DATABASE VALUES
       * -------------------------------------------------------
       */

      const {
        data: existingData,
        error: existingError,
      } = await supabase
        .from(
          'building_construction_fund'
        )
        .select('*')
        .eq(
          'member_id',
          memberId
        )
        .eq(
          'church_id',
          churchId
        )
        .eq(
          'year',
          year
        );

      if (existingError) {
        throw existingError;
      }

      /*
       * -------------------------------------------------------
       * 2. MAP EXISTING RECORDS BY MONTH
       * -------------------------------------------------------
       */

      const existingByMonth =
        new Map<number, any>();

      (
        existingData || []
      ).forEach((record) => {
        existingByMonth.set(
          Number(record.month),
          record
        );
      });

      /*
       * -------------------------------------------------------
       * 3. FIND ONLY CHANGED MONTHS
       * -------------------------------------------------------
       */

      const monthChanges: MonthChange[] =
        [];

      const rowsToSave: any[] = [];

      for (const row of rows) {
        const monthNumber =
          Number(row.month);

        const existing =
          existingByMonth.get(
            monthNumber
          );

        const oldValue =
          Number(
            existing?.amount || 0
          );

        const newValue =
          Number(
            row.amount || 0
          );

        /*
         * Only record a month if
         * the amount changed.
         */

        if (
          oldValue !==
          newValue
        ) {
          monthChanges.push({
            month:
              monthNumber,

            monthName:
              MONTHS[
                monthNumber - 1
              ],

            oldValue,

            newValue,
          });

          rowsToSave.push({
            id: row.id,

            member_id:
              memberId,

            church_id:
              churchId,

            year,

            month:
              monthNumber,

            amount:
              newValue,
          });
        }
      }

      /*
       * -------------------------------------------------------
       * 4. NOTHING CHANGED
       * -------------------------------------------------------
       */

      if (
        monthChanges.length === 0
      ) {
        setSaved(true);

        setTimeout(() => {
          setSaved(false);
        }, 2000);

        return;
      }

      /*
       * -------------------------------------------------------
       * 5. REMOVE ID FOR NEW RECORDS
       * -------------------------------------------------------
       */

      const cleanRows =
        rowsToSave.map(
          (row) => {
            if (!row.id) {
              const {
                id: _id,
                ...withoutId
              } = row;

              void _id;

              return withoutId;
            }

            return row;
          }
        );

      /*
       * -------------------------------------------------------
       * 6. SAVE CHANGED MONTHS
       * -------------------------------------------------------
       */

      const {
        error: saveError,
      } = await supabase
        .from(
          'building_construction_fund'
        )
        .upsert(
          cleanRows,
          {
            onConflict:
              'member_id,year,month',
          }
        );

      if (saveError) {
        throw saveError;
      }

      /*
       * -------------------------------------------------------
       * 7. CREATE EXACTLY ONE ACTIVITY LOG
       * -------------------------------------------------------
       */

      if (profile?.id) {
        const changedAt =
          new Date().toISOString();

        await logActivity(
          profile.id,

          churchId,

          'update',

          'building_construction_fund',

          memberId,

          `${memberName} edited Building Construction Fund for ${year}`,

          {
            operation:
              'UPDATE',

            table:
              'building_construction_fund',

            memberId:
              memberId,

            memberName:
              memberName,

            year,

            monthChanges,

            changedMonths:
              monthChanges.map(
                (item) =>
                  item.monthName
              ),

            changedMonthNumbers:
              monthChanges.map(
                (item) =>
                  item.month
              ),

            changedFieldCount:
              monthChanges.length,

            grandTotal,

            changedAt,
          }
        );
      } else {
        console.warn(
          'Building fund saved, but activity log was not created because profile.id is missing.'
        );
      }

      /*
       * -------------------------------------------------------
       * 8. REFRESH DATA
       * -------------------------------------------------------
       */

      const {
        data: refreshedData,
      } = await supabase
        .from(
          'building_construction_fund'
        )
        .select('*')
        .eq(
          'member_id',
          memberId
        )
        .eq(
          'church_id',
          churchId
        )
        .eq(
          'year',
          year
        )
        .order('month', {
          ascending: true,
        });

      const refreshedRows =
        buildEmptyRows();

      (
        refreshedData || []
      ).forEach((row) => {
        const idx =
          Number(row.month) - 1;

        if (
          idx >= 0 &&
          idx < 12
        ) {
          refreshedRows[idx] = {
            ...refreshedRows[idx],
            ...row,
          };
        }
      });

      setRows(
        refreshedRows
      );

      /*
       * -------------------------------------------------------
       * 9. SUCCESS
       * -------------------------------------------------------
       */

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error: any) {
      console.error(
        'Failed to save building construction fund:',
        error
      );

      alert(
        `Failed to save building construction fund: ${
          error?.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * =========================================================
   * DOWNLOAD CSV
   * =========================================================
   */

  function handleDownloadExcel() {
    const headers = [
      'Month',
      'Amount (Rs.)',
    ];

    const csvRows = [
      headers.join(','),

      ...rows.map(
        (row, idx) => {
          const amount =
            Number(
              row.amount
            ) || 0;

          return `${MONTHS[idx]},${amount}`;
        }
      ),

      `TOTAL,${grandTotal}`,
    ];

    const csv =
      csvRows.join('\n');

    const blob =
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8;',
        }
      );

    const link =
      document.createElement(
        'a'
      );

    const url =
      URL.createObjectURL(
        blob
      );

    link.setAttribute(
      'href',
      url
    );

    link.setAttribute(
      'download',
      `building-construction-fund-${memberName}-${year}.csv`
    );

    link.style.visibility =
      'hidden';

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div className="mt-6">

      <div className="flex items-center justify-between mb-4">

        <h3 className="text-lg font-bold text-slate-800">
          Building Construction Fund
        </h3>

        <div className="flex items-center gap-3">

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">

            <button
              onClick={() =>
                setYear(
                  (current) =>
                    current - 1
                )
              }
              className="p-1 rounded hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            <span className="text-sm font-bold text-slate-700 px-2">
              {year}
            </span>

            <button
              onClick={() =>
                setYear(
                  (current) =>
                    current + 1
                )
              }
              className="p-1 rounded hover:bg-white transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

          </div>

          <button
            onClick={
              handleDownloadExcel
            }
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>

          <button
            onClick={
              handleSave
            }
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-100 text-green-700'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
            }`}
          >

            <Save className="w-4 h-4" />

            {saving
              ? 'Saving...'
              : saved
              ? 'Saved!'
              : 'Save Changes'}

          </button>

        </div>

      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">

        <table className="w-full text-sm border-collapse">

          <thead>

            <tr className="bg-slate-800 text-white">

              <th className="px-4 py-3 text-left font-semibold w-40">
                Month
              </th>

              <th className="px-4 py-3 text-right font-semibold w-48">
                Amount (Rs.)
              </th>

            </tr>

          </thead>

          <tbody>

            {rows.map(
              (row, idx) => {

                const isEven =
                  idx % 2 ===
                  0;

                return (
                  <tr
                    key={
                      row.month
                    }
                    className={`${
                      isEven
                        ? 'bg-white'
                        : 'bg-slate-50'
                    } hover:bg-teal-50 transition-colors`}
                  >

                    <td
                      className={`px-4 py-2.5 font-medium text-slate-700 ${
                        isEven
                          ? 'bg-white'
                          : 'bg-slate-50'
                      }`}
                    >
                      {
                        MONTHS[
                          idx
                        ]
                      }
                    </td>

                    <td className="px-2 py-2 text-right">

                      <input
                        type="number"
                        min="0"
                        value={
                          row.amount ||
                          ''
                        }
                        onChange={(
                          event
                        ) =>
                          updateCell(
                            idx,
                            event
                              .target
                              .value
                          )
                        }
                        className="w-full px-3 py-1.5 text-right border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white transition-colors text-slate-700"
                        placeholder="0"
                      />

                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

          <tfoot>

            <tr className="bg-slate-800 text-white font-bold text-sm">

              <td className="px-4 py-3 font-bold text-yellow-300">
                TOTAL
              </td>

              <td className="px-4 py-3 text-right text-yellow-300 bg-teal-900">

                {grandTotal >
                0
                  ? `Rs. ${grandTotal.toLocaleString(
                      'en-IN'
                    )}`
                  : '—'}

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

          <p className="text-2xl font-bold text-amber-700">
            Rs.{' '}
            {grandTotal.toLocaleString(
              'en-IN'
            )}
          </p>

          <p className="text-xs text-amber-600 mt-0.5">
            For {year}
          </p>

        </div>

      </div>

    </div>
  );
}