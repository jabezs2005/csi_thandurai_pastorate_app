import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import {
  Subscription,
  SUBSCRIPTION_FIELDS,
  MONTHS,
} from '../../types';

import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/activityLogger';

/* =========================================================
   TYPES
========================================================= */

interface SubscriptionTableProps {
  memberId: string;
  churchId: string;
}

type RowData = Partial<Subscription> & {
  month: number;
  year: number;
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

  /* IMPORTANT:
     ActivityLogsPage expects fieldChanges */
  fieldChanges: FieldChange[];
};

/* =========================================================
   COMPONENT
========================================================= */

export default function SubscriptionTable({
  memberId,
  churchId,
}: SubscriptionTableProps) {
  const { profile } = useAuth();

  const [year, setYear] = useState(
    new Date().getFullYear()
  );

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* =========================================================
     BUILD EMPTY ROWS
  ========================================================= */

  const buildEmptyRows = useCallback(
    (): RowData[] =>
      MONTHS.map((_, index) => ({
        month: index + 1,
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
      })),
    [
      memberId,
      churchId,
      year,
    ]
  );

  /* =========================================================
     FETCH SUBSCRIPTIONS
  ========================================================= */

  useEffect(() => {
    async function fetchSubscriptions() {
      setLoading(true);

      try {
        const {
          data,
          error,
        } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('member_id', memberId)
          .eq('church_id', churchId)
          .eq('year', year)
          .order('month', {
            ascending: true,
          });

        if (error) {
          console.error(
            'Failed to fetch subscriptions:',
            error
          );

          setRows(buildEmptyRows());
          return;
        }

        const base =
          buildEmptyRows();

        (data || []).forEach(sub => {
          const index =
            Number(sub.month) - 1;

          if (
            index >= 0 &&
            index < 12
          ) {
            base[index] = {
              ...base[index],
              ...sub,
            };
          }
        });

        setRows(base);
      } catch (error) {
        console.error(
          'Unexpected error while fetching subscriptions:',
          error
        );

        setRows(buildEmptyRows());
      } finally {
        setLoading(false);
      }
    }

    fetchSubscriptions();
  }, [
    memberId,
    churchId,
    year,
    buildEmptyRows,
  ]);

  /* =========================================================
     UPDATE CELL
  ========================================================= */

  function updateCell(
    monthIndex: number,
    field: string,
    value: string
  ) {
    const numberValue =
      value === ''
        ? 0
        : Math.max(
            0,
            Number(value) || 0
          );

    setRows(previous =>
      previous.map(
        (row, index) =>
          index === monthIndex
            ? {
                ...row,
                [field]: numberValue,
              }
            : row
      )
    );

    setSaved(false);
  }

  /* =========================================================
     ROW TOTAL
  ========================================================= */

  function rowTotal(
    row: RowData
  ): number {
    return SUBSCRIPTION_FIELDS.reduce(
      (sum, field) =>
        sum +
        (Number(
          row[field.key]
        ) || 0),
      0
    );
  }

  /* =========================================================
     COLUMN TOTAL
  ========================================================= */

  function colTotal(
    key: string
  ): number {
    return rows.reduce(
      (sum, row) =>
        sum +
        (Number(
          row[
            key as keyof RowData
          ]
        ) || 0),
      0
    );
  }

  /* =========================================================
     GRAND TOTAL
  ========================================================= */

  const grandTotal =
    rows.reduce(
      (sum, row) =>
        sum + rowTotal(row),
      0
    );

  /* =========================================================
     GET CLEAN CONTRIBUTION DATA

     This creates the exact old/new values that will
     be stored in the activity log.
  ========================================================= */

  function getContributionData(
    source: any
  ): Record<string, number> {
    const result: Record<
      string,
      number
    > = {};

    SUBSCRIPTION_FIELDS.forEach(
      field => {
        result[field.key] =
          Number(
            source?.[field.key]
          ) || 0;
      }
    );

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
      /* -----------------------------------------------------
         1. FETCH CURRENT DATABASE VALUES

         These are the TRUE OLD VALUES.
      ----------------------------------------------------- */

      const {
        data: existingData,
        error: existingError,
      } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .eq('year', year);

      if (existingError) {
        throw existingError;
      }

      /* -----------------------------------------------------
         2. MAP DATABASE RECORDS BY MONTH
      ----------------------------------------------------- */

      const existingByMonth =
        new Map<number, any>();

      (existingData || []).forEach(
        record => {
          existingByMonth.set(
            Number(record.month),
            record
          );
        }
      );

      /* -----------------------------------------------------
         3. PREPARE MONTH CHANGES
      ----------------------------------------------------- */

      const monthChanges: MonthChange[] =
        [];

      const rowsToSave: any[] = [];

      let hasNewRecord = false;
      let hasUpdatedRecord = false;

      for (const row of rows) {
        const monthNumber =
          Number(row.month);

        const existing =
          existingByMonth.get(
            monthNumber
          );

        /*
         * Exact data BEFORE save
         */

        const oldData =
          getContributionData(existing);

        /*
         * Exact data AFTER save
         */

        const newData =
          getContributionData(row);

        /*
         * Compare every field
         */

        const fieldChanges: FieldChange[] =
          [];

        SUBSCRIPTION_FIELDS.forEach(
          field => {
            const oldValue =
              oldData[field.key] || 0;

            const newValue =
              newData[field.key] || 0;

            if (
              oldValue !== newValue
            ) {
              fieldChanges.push({
                key: field.key,
                label: field.label,
                oldValue,
                newValue,
              });
            }
          }
        );

        /*
         * Nothing changed in this month
         */

        if (
          fieldChanges.length === 0
        ) {
          continue;
        }

        /*
         * Calculate totals
         */

        const oldTotal =
          Object.values(
            oldData
          ).reduce(
            (sum, value) =>
              sum + Number(value || 0),
            0
          );

        const newTotal =
          Object.values(
            newData
          ).reduce(
            (sum, value) =>
              sum + Number(value || 0),
            0
          );

        /*
         * IMPORTANT:
         * Save complete change information.
        */

        monthChanges.push({
          month: monthNumber,
          year,
          monthName:
            MONTHS[
              monthNumber - 1
            ],

          oldTotal,
          newTotal,

          oldData,
          newData,

          fieldChanges,
        });

        /*
         * Detect CREATE or UPDATE
         */

        if (existing) {
          hasUpdatedRecord = true;
        } else {
          hasNewRecord = true;
        }

        /*
         * Prepare database row
         */

        rowsToSave.push({
          id:
            existing?.id ||
            row.id,

          member_id:
            memberId,

          church_id:
            churchId,

          year,
          month:
            monthNumber,

          ...newData,
        });
      }

      /* -----------------------------------------------------
         4. NOTHING CHANGED
      ----------------------------------------------------- */

      if (
        monthChanges.length === 0
      ) {
        setSaved(true);

        setTimeout(() => {
          setSaved(false);
        }, 2000);

        return;
      }

      /* -----------------------------------------------------
         5. REMOVE EMPTY ID

         New rows must not contain id: undefined.
      ----------------------------------------------------- */

      const cleanRows =
        rowsToSave.map(row => {
          if (!row.id) {
            const {
              id: _id,
              ...dataWithoutId
            } = row;

            void _id;

            return dataWithoutId;
          }

          return row;
        });

      /* -----------------------------------------------------
         6. SAVE TO DATABASE
      ----------------------------------------------------- */

      const {
        error: saveError,
      } = await supabase
        .from('subscriptions')
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

      /* -----------------------------------------------------
         7. FETCH MEMBER DETAILS
      ----------------------------------------------------- */

      const {
        data: memberData,
        error: memberError,
      } = await supabase
        .from('members')
        .select(
          'id, member_name, family_number'
        )
        .eq('id', memberId)
        .maybeSingle();

      if (memberError) {
        console.warn(
          'Could not fetch member details:',
          memberError
        );
      }

      const memberName =
        memberData?.member_name ||
        'Unknown Member';

      /* -----------------------------------------------------
         8. DETERMINE ACTIVITY ACTION
      ----------------------------------------------------- */

      let activityAction =
        'update';

      if (
        hasNewRecord &&
        !hasUpdatedRecord
      ) {
        activityAction =
          'create';
      }

      /*
       * If one save contains both new and edited months,
       * use update because it represents the whole save.
       */

      /* -----------------------------------------------------
         9. CREATE ACTIVITY LOG

         THIS IS THE IMPORTANT FIX.

         fieldChanges, oldData and newData are now
         permanently stored in activity_logs.
      ----------------------------------------------------- */

      if (profile?.id) {
        const changedAt =
          new Date().toISOString();

        await logActivity(
          profile.id,
          churchId,
          activityAction,
          'subscription',
          memberId,
          `${memberName} ${
            activityAction === 'create'
              ? 'created'
              : 'edited'
          } Contributions for ${year}`,
          {
            operation:
              activityAction.toUpperCase(),

            table:
              'subscriptions',

            memberId,

            member_id:
              memberId,

            memberName,

            member_name:
              memberName,

            familyNumber:
              memberData?.family_number ||
              null,

            year,

            /*
             * COMPLETE MONTH-BY-MONTH HISTORY
             */

            monthChanges,

            /*
             * Convenience values for the Activity Logs page
             */

            changedMonths:
              monthChanges.map(
                item =>
                  item.monthName
              ),

            changedMonthNumbers:
              monthChanges.map(
                item =>
                  item.month
              ),

            changedFieldCount:
              monthChanges.reduce(
                (total, item) =>
                  total +
                  item.fieldChanges.length,
                0
              ),

            /*
             * Also store the first month values at top level.
             * This provides compatibility with ActivityLogsPage.
             */

            month:
              monthChanges.length === 1
                ? monthChanges[0].month
                : undefined,

            monthName:
              monthChanges.length === 1
                ? monthChanges[0].monthName
                : undefined,

            oldData:
              monthChanges.length === 1
                ? monthChanges[0].oldData
                : undefined,

            newData:
              monthChanges.length === 1
                ? monthChanges[0].newData
                : undefined,

            fieldChanges:
              monthChanges.length === 1
                ? monthChanges[0].fieldChanges
                : undefined,

            grandTotal,

            changedAt,
          }
        );
      } else {
        console.warn(
          'Subscription saved, but activity log was not created because profile.id is missing.'
        );
      }

      /* -----------------------------------------------------
         10. REFRESH DATA
      ----------------------------------------------------- */

      const {
        data: refreshedData,
        error: refreshError,
      } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .eq('church_id', churchId)
        .eq('year', year)
        .order('month', {
          ascending: true,
        });

      if (refreshError) {
        console.error(
          'Failed to refresh subscriptions:',
          refreshError
        );
      }

      const refreshedRows =
        buildEmptyRows();

      (refreshedData || []).forEach(
        sub => {
          const index =
            Number(sub.month) - 1;

          if (
            index >= 0 &&
            index < 12
          ) {
            refreshedRows[index] = {
              ...refreshedRows[index],
              ...sub,
            };
          }
        }
      );

      setRows(refreshedRows);

      /* -----------------------------------------------------
         11. SUCCESS
      ----------------------------------------------------- */

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);
    } catch (error: any) {
      console.error(
        'Failed to save contributions:',
        error
      );

      alert(
        `Failed to save contributions: ${
          error?.message ||
          'Unknown error'
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     DOWNLOAD CSV
  ========================================================= */

  function handleDownloadExcel() {
    const headers = [
      'Month',
      ...SUBSCRIPTION_FIELDS.map(
        field => field.label
      ),
      'Total',
    ];

    const csvRows = [
      headers.join(','),

      ...rows.map(
        (row, index) => {
          const total =
            rowTotal(row);

          const values =
            SUBSCRIPTION_FIELDS.map(
              field =>
                Number(
                  row[field.key]
                ) || 0
            );

          return [
            MONTHS[index],
            ...values,
            total,
          ].join(',');
        }
      ),

      [
        'TOTAL',
        ...SUBSCRIPTION_FIELDS.map(
          field =>
            colTotal(field.key)
        ),
        grandTotal,
      ].join(','),
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
      document.createElement('a');

    const url =
      URL.createObjectURL(blob);

    link.setAttribute(
      'href',
      url
    );

    link.setAttribute(
      'download',
      `contributions-${year}.csv`
    );

    link.style.visibility =
      'hidden';

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
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

      <div className="flex items-center justify-between mb-4">

        <h3 className="text-lg font-bold text-slate-800">
          Subscription / Contributions
        </h3>

        <div className="flex items-center gap-3">

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">

            <button
              onClick={() =>
                setYear(
                  current =>
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
                  current =>
                    current + 1
                )
              }
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
            onClick={handleSave}
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

        <table className="w-full text-xs border-collapse min-w-[1200px]">

          <thead>
            <tr className="bg-slate-800 text-white">

              <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-slate-800 z-10 w-28">
                Maatham
              </th>

              {SUBSCRIPTION_FIELDS.map(
                field => (
                  <th
                    key={field.key}
                    className="px-2 py-3 text-center font-semibold whitespace-nowrap"
                  >
                    {field.label}
                  </th>
                )
              )}

              <th className="px-3 py-3 text-right font-semibold bg-teal-700 whitespace-nowrap">
                Total
              </th>

            </tr>
          </thead>

          <tbody>

            {rows.map(
              (row, index) => {
                const total =
                  rowTotal(row);

                const isEven =
                  index % 2 === 0;

                return (
                  <tr
                    key={row.month}
                    className={`${
                      isEven
                        ? 'bg-white'
                        : 'bg-slate-50'
                    } hover:bg-teal-50 transition-colors`}
                  >

                    <td
                      className={`px-3 py-2 font-medium text-slate-700 sticky left-0 z-10 ${
                        isEven
                          ? 'bg-white'
                          : 'bg-slate-50'
                      } border-r border-slate-200`}
                    >
                      {MONTHS[index]}
                    </td>

                    {SUBSCRIPTION_FIELDS.map(
                      field => (
                        <td
                          key={field.key}
                          className="px-1 py-1.5 text-center"
                        >
                          <input
                            type="number"
                            min="0"
                            value={
                              row[field.key] || ''
                            }
                            onChange={event =>
                              updateCell(
                                index,
                                field.key,
                                event.target.value
                              )
                            }
                            className="w-full px-1.5 py-1 text-center border border-transparent rounded focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none bg-transparent hover:bg-white focus:bg-white transition-colors text-slate-700"
                            placeholder="0"
                          />
                        </td>
                      )
                    )}

                    <td
                      className={`px-3 py-2 text-right font-bold text-teal-700 ${
                        total > 0
                          ? 'bg-teal-50'
                          : ''
                      }`}
                    >
                      {total > 0
                        ? total.toLocaleString(
                            'en-IN'
                          )
                        : '—'}
                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

          <tfoot>

            <tr className="bg-slate-800 text-white font-bold text-xs">

              <td className="px-3 py-3 sticky left-0 bg-slate-800 z-10 font-bold text-yellow-300">
                TOTAL
              </td>

              {SUBSCRIPTION_FIELDS.map(
                field => {
                  const total =
                    colTotal(field.key);

                  return (
                    <td
                      key={field.key}
                      className="px-2 py-3 text-center text-yellow-200"
                    >
                      {total > 0
                        ? total.toLocaleString(
                            'en-IN'
                          )
                        : '—'}
                    </td>
                  );
                }
              )}

              <td className="px-3 py-3 text-right text-yellow-300 bg-teal-900">
                {grandTotal.toLocaleString(
                  'en-IN'
                )}
              </td>

            </tr>

          </tfoot>

        </table>

      </div>

      <div className="mt-4">

        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">

          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-1">
            Grand Total — All Contributions
          </p>

          <p className="text-2xl font-bold text-teal-700">
            ₹
            {grandTotal.toLocaleString(
              'en-IN'
            )}
          </p>

          <p className="text-xs text-teal-600 mt-0.5">
            For {year}
          </p>

        </div>

      </div>

    </div>
  );
}