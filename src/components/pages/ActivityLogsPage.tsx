import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Edit3,
  Activity,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

/* =========================================================
   TYPES
========================================================= */

interface MemberRecord {
  id: string;
  member_name?: string;
  full_name?: string;
  name?: string;
  first_name?: string;
  firstname?: string;
  last_name?: string;
  lastname?: string;
  [key: string]: any;
}

interface FieldChange {
  key: string;
  label: string;
  oldValue: any;
  newValue: any;
  [key: string]: any;
}

interface MonthChange {
  month?: number;
  year?: number;
  monthName?: string;

  oldValue?: any;
  newValue?: any;

  oldData?: Record<string, any>;
  newData?: Record<string, any>;

  old_data?: Record<string, any>;
  new_data?: Record<string, any>;

  fieldChanges?: FieldChange[];
  changedFields?: FieldChange[];

  [key: string]: any;
}

interface ActivityChanges {
  table?: string;
  operation?: string;

  memberId?: string;
  member_id?: string;

  memberName?: string;
  member_name?: string;

  year?: number | string;
  month?: number | string;

  monthName?: string;
  month_name?: string;

  grandTotal?: number | string;
  grand_total?: number | string;

  oldData?: Record<string, any>;
  newData?: Record<string, any>;

  old_data?: Record<string, any>;
  new_data?: Record<string, any>;

  old_value?: any;
  new_value?: any;

  oldValue?: any;
  newValue?: any;

  fieldChanges?: FieldChange[];
  changedFields?: FieldChange[];

  monthChanges?: MonthChange[];
  month_changes?: MonthChange[];

  changedMonths?: string[];
  changedMonthNumbers?: number[];

  changed_months?: string[];
  changed_month_numbers?: number[];

  changedFieldCount?: number;
  changed_field_count?: number;

  [key: string]: any;
}

interface ActivityLog {
  id: string;

  admin_id?: string | null;
  church_id?: string | null;

  action_type: string;
  target_type: string;
  target_id?: string | null;

  description?: string | null;

  changes?: ActivityChanges | string | null;

  created_at: string;

  admin?: {
    full_name?: string;
    email?: string;
  };

  church?: {
    name?: string;
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const CONTRIBUTION_FIELDS = [
  { key: 'sandha', label: 'Sandha' },
  { key: 'kattida_nidhi', label: 'Kattida Nidhi' },
  { key: 'aalaya_paraamarippu', label: 'Aalaya Paraamarippu' },
  { key: 'narseidhi_thiruppani', label: 'Narseidhi Thiruppani' },
  { key: 'yezhaiyar_nidhi', label: 'Yezhaiyar Nidhi' },
  { key: 'pengal_thiruppani', label: 'Pengal Thiruppani' },
  { key: 'aangal_thiruppani', label: 'Aangal Thiruppani' },
  { key: 'ilainyar_thiruppani', label: 'Ilainyar Thiruppani' },
  { key: 'siruvar_thiruppani', label: 'Siruvar Thiruppani' },
  { key: 'girama_nidhi', label: 'Girama Nidhi' },
  { key: 'kalvi_nidhi', label: 'Kalvi Nidhi' },
];

const BUILDING_FUND_FIELDS = [
  {
    key: 'amount',
    label: 'Amount',
  },
];

const TARGET_LABELS: Record<string, string> = {
  subscription: 'Contributions',
  subscriptions: 'Contributions',
  contribution: 'Contributions',
  contributions: 'Contributions',

  building_construction_fund: 'Building Fund',
  building_fund: 'Building Fund',

  member: 'Member',
  members: 'Member',

  admin_approval: 'Account Approval',
  account_approval: 'Account Approval',

  circular: 'Circular',
  circulars: 'Circular',

  church: 'Church',
  churches: 'Church',
};

/* =========================================================
   HELPERS
========================================================= */

function getTargetLabel(targetType?: string) {
  if (!targetType) {
    return '—';
  }

  return TARGET_LABELS[String(targetType).toLowerCase()] || targetType;
}

function normalizeAction(action?: string) {
  if (!action) {
    return 'action';
  }

  const value = String(action).toLowerCase();

  if (value === 'insert') {
    return 'create';
  }

  if (value === 'update') {
    return 'update';
  }

  if (value === 'delete') {
    return 'delete';
  }

  return value;
}

function parseChanges(
  changes: ActivityChanges | string | null | undefined
): ActivityChanges {
  if (!changes) {
    return {};
  }

  if (typeof changes === 'object') {
    return changes;
  }

  if (typeof changes === 'string') {
    try {
      const parsed = JSON.parse(changes);

      if (
        parsed &&
        typeof parsed === 'object'
      ) {
        return parsed as ActivityChanges;
      }
    } catch (error) {
      console.error(
        'Could not parse activity log changes:',
        changes
      );
    }
  }

  return {};
}

function getAction(log: ActivityLog) {
  const changes = parseChanges(log.changes);

  return normalizeAction(
    changes.operation || log.action_type
  );
}

function numericValue(value: any) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const cleanedValue = String(value)
    .replace(/[₹,\s]/g, '');

  const number = Number(cleanedValue);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatAmount(value: any) {
  return `₹${numericValue(value).toLocaleString('en-IN')}`;
}

function getMonthName(month?: number | string) {
  const monthNumber = Number(month);

  if (
    !Number.isFinite(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return 'Unknown Month';
  }

  return MONTHS[monthNumber - 1];
}

function getMemberName(member?: MemberRecord) {
  if (!member) {
    return 'Unknown Member';
  }

  const directName =
    member.member_name ||
    member.full_name ||
    member.name;

  if (directName) {
    return String(directName);
  }

  const firstName =
    member.first_name ||
    member.firstname ||
    '';

  const lastName =
    member.last_name ||
    member.lastname ||
    '';

  const combined =
    `${firstName} ${lastName}`.trim();

  return combined || 'Unknown Member';
}

function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestamp));
}

function valuesAreDifferent(
  first: any,
  second: any
) {
  if (
    first === undefined &&
    second === undefined
  ) {
    return false;
  }

  return numericValue(first) !== numericValue(second);
}

function getValueFromObject(
  data: Record<string, any> | undefined,
  key: string
) {
  if (!data) {
    return undefined;
  }

  if (data[key] !== undefined) {
    return data[key];
  }

  const matchingKey = Object.keys(data).find(
    objectKey =>
      objectKey.toLowerCase() ===
      key.toLowerCase()
  );

  if (matchingKey) {
    return data[matchingKey];
  }

  return undefined;
}

function getOldData(changes: ActivityChanges) {
  return (
    changes.oldData ||
    changes.old_data ||
    {}
  );
}

function getNewData(changes: ActivityChanges) {
  return (
    changes.newData ||
    changes.new_data ||
    {}
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ActivityLogsPage() {
  const { profile } = useAuth();

  const isSuperAdmin =
    profile?.role === 'super_admin';

  const [logs, setLogs] =
    useState<ActivityLog[]>([]);

  const [members, setMembers] =
    useState<MemberRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [filterType, setFilterType] =
    useState('all');

  const [filterTargetType, setFilterTargetType] =
    useState('all');

  const [expandedLogId, setExpandedLogId] =
    useState<string | null>(null);

  /* =========================================================
     FETCH LOGS
  ========================================================= */

  async function fetchLogs() {
    setLoading(true);

    try {
      let query = supabase
        .from('activity_logs')
        .select(`
          *,
          admin:profiles!fk_activity_logs_admin_id(
            full_name,
            email
          ),
          church:churches!activity_logs_church_id_fkey(
            name
          )
        `)
        .order('created_at', {
          ascending: false,
        });

      if (
        !isSuperAdmin &&
        profile?.church_id
      ) {
        query = query.eq(
          'church_id',
          profile.church_id
        );
      }

      const { data, error } =
        await query;

      if (error) {
        console.error(
          'Failed to fetch activity logs:',
          error
        );

        setLogs([]);
        return;
      }

      console.log(
        'ACTIVITY LOGS:',
        data
      );

      setLogs(
        (data || []) as ActivityLog[]
      );
    } catch (error) {
      console.error(
        'Unexpected error while fetching logs:',
        error
      );

      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     FETCH MEMBERS
  ========================================================= */

  async function fetchMembers() {
    try {
      let query = supabase
        .from('members')
        .select('*');

      if (
        !isSuperAdmin &&
        profile?.church_id
      ) {
        query = query.eq(
          'church_id',
          profile.church_id
        );
      }

      const { data, error } =
        await query;

      if (error) {
        console.error(
          'Failed to fetch members:',
          error
        );

        setMembers([]);
        return;
      }

      setMembers(
        (data || []) as MemberRecord[]
      );
    } catch (error) {
      console.error(
        'Unexpected error while fetching members:',
        error
      );

      setMembers([]);
    }
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchLogs();
    fetchMembers();
  }, [
    isSuperAdmin,
    profile?.church_id,
  ]);

  /* =========================================================
     MEMBER MAP
  ========================================================= */

  const memberMap = useMemo(() => {
    const map =
      new Map<string, MemberRecord>();

    members.forEach(member => {
      if (member.id) {
        map.set(
          String(member.id),
          member
        );
      }
    });

    return map;
  }, [members]);

  /* =========================================================
     GET MEMBER ID
  ========================================================= */

  function getLogMemberId(log: ActivityLog) {
    const changes =
      parseChanges(log.changes);

    const directMemberId =
      changes.memberId ||
      changes.member_id;

    if (directMemberId) {
      return String(directMemberId);
    }

    const oldData =
      getOldData(changes);

    const newData =
      getNewData(changes);

    const dataMemberId =
      newData.member_id ||
      newData.memberId ||
      oldData.member_id ||
      oldData.memberId;

    if (dataMemberId) {
      return String(dataMemberId);
    }

    return null;
  }

  /* =========================================================
     GET MEMBER NAME
  ========================================================= */

  function getLogMemberName(log: ActivityLog) {
    const changes =
      parseChanges(log.changes);

    const storedName =
      changes.memberName ||
      changes.member_name;

    if (
      storedName !== undefined &&
      storedName !== null &&
      String(storedName).trim() !== ''
    ) {
      return String(storedName);
    }

    const newData =
      getNewData(changes);

    const oldData =
      getOldData(changes);

    const dataName =
      newData.member_name ||
      newData.full_name ||
      newData.name ||
      oldData.member_name ||
      oldData.full_name ||
      oldData.name;

    if (dataName) {
      return String(dataName);
    }

    const memberId =
      getLogMemberId(log);

    if (!memberId) {
      return 'Unknown Member';
    }

    return getMemberName(
      memberMap.get(memberId)
    );
  }

  /* =========================================================
     GET YEAR
  ========================================================= */

  function getLogYear(log: ActivityLog) {
    const changes =
      parseChanges(log.changes);

    const oldData =
      getOldData(changes);

    const newData =
      getNewData(changes);

    const possibleYear =
      changes.year ??
      newData.year ??
      oldData.year;

    if (
      possibleYear !== undefined &&
      possibleYear !== null &&
      possibleYear !== ''
    ) {
      return possibleYear;
    }

    return new Date(
      log.created_at
    ).getFullYear();
  }

  /* =========================================================
     GET MONTH
  ========================================================= */

  function getLogMonth(log: ActivityLog) {
    const changes =
      parseChanges(log.changes);

    const directMonth =
      changes.month;

    if (
      directMonth !== undefined &&
      directMonth !== null &&
      directMonth !== ''
    ) {
      return Number(directMonth);
    }

    const changedMonthNumbers =
      changes.changedMonthNumbers ||
      changes.changed_month_numbers;

    if (
      Array.isArray(changedMonthNumbers) &&
      changedMonthNumbers.length > 0
    ) {
      return Number(
        changedMonthNumbers[0]
      );
    }

    const monthChanges =
      changes.monthChanges ||
      changes.month_changes;

    if (
      Array.isArray(monthChanges) &&
      monthChanges.length > 0 &&
      monthChanges[0]?.month
    ) {
      return Number(
        monthChanges[0].month
      );
    }

    const newData =
      getNewData(changes);

    const oldData =
      getOldData(changes);

    const newDataMonth =
      newData.month;

    if (
      newDataMonth !== undefined &&
      newDataMonth !== null &&
      newDataMonth !== ''
    ) {
      return Number(newDataMonth);
    }

    const oldDataMonth =
      oldData.month;

    if (
      oldDataMonth !== undefined &&
      oldDataMonth !== null &&
      oldDataMonth !== ''
    ) {
      return Number(oldDataMonth);
    }

    return undefined;
  }

  /* =========================================================
     GET MONTH NAME
  ========================================================= */

  function getLogMonthName(log: ActivityLog) {
    const changes =
      parseChanges(log.changes);

    const storedMonthName =
      changes.monthName ||
      changes.month_name;

    if (
      storedMonthName !== undefined &&
      storedMonthName !== null &&
      String(storedMonthName).trim() !== ''
    ) {
      return String(storedMonthName);
    }

    const changedMonths =
      changes.changedMonths ||
      changes.changed_months;

    if (
      Array.isArray(changedMonths) &&
      changedMonths.length > 0 &&
      changedMonths[0]
    ) {
      return String(changedMonths[0]);
    }

    const month =
      getLogMonth(log);

    if (month) {
      return getMonthName(month);
    }

    return 'Unknown Month';
  }

  /* =========================================================
     GET FIELDS
  ========================================================= */

  function getFieldsForLog(log: ActivityLog) {
    const target =
      getTargetLabel(log.target_type);

    if (target === 'Contributions') {
      return CONTRIBUTION_FIELDS;
    }

    if (target === 'Building Fund') {
      return BUILDING_FUND_FIELDS;
    }

    return [];
  }

  /* =========================================================
     GET FIELD LABEL
  ========================================================= */

  function getFieldLabel(
    key: string,
    log: ActivityLog
  ) {
    const matchedField =
      getFieldsForLog(log).find(
        field =>
          field.key.toLowerCase() ===
          key.toLowerCase()
      );

    if (matchedField) {
      return matchedField.label;
    }

    return String(key)
      .replace(/_/g, ' ')
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      );
  }

  /* =========================================================
     NORMALIZE STORED FIELD CHANGE
  ========================================================= */

  function normalizeStoredFieldChange(
    change: any,
    log: ActivityLog
  ): FieldChange {
    const key =
      String(
        change?.key ||
        change?.field ||
        change?.column ||
        change?.columnName ||
        change?.column_name ||
        change?.name ||
        ''
      );

    return {
      key,
      label:
        change?.label ||
        change?.fieldName ||
        change?.field_name ||
        change?.columnName ||
        change?.column_name ||
        getFieldLabel(key, log),
      oldValue:
        change?.oldValue ??
        change?.old_value ??
        change?.old ??
        change?.from ??
        change?.previousValue ??
        change?.previous_value ??
        0,
      newValue:
        change?.newValue ??
        change?.new_value ??
        change?.new ??
        change?.to ??
        change?.currentValue ??
        change?.current_value ??
        0,
    };
  }

  /* =========================================================
     GET FIELD CHANGES
  ========================================================= */

  function getFieldChanges(
    log: ActivityLog
  ): FieldChange[] {
    const changes =
      parseChanges(log.changes);

    const fields =
      getFieldsForLog(log);

    const action =
      getAction(log);

    /* -----------------------------------------------
       FORMAT 1:
       fieldChanges
    ------------------------------------------------ */

    if (
      Array.isArray(changes.fieldChanges) &&
      changes.fieldChanges.length > 0
    ) {
      const result =
        changes.fieldChanges
          .map(change =>
            normalizeStoredFieldChange(
              change,
              log
            )
          )
          .filter(
            change =>
              change.key !== ''
          );

      if (result.length > 0) {
        return result;
      }
    }

    /* -----------------------------------------------
       FORMAT 2:
       changedFields
    ------------------------------------------------ */

    if (
      Array.isArray(changes.changedFields) &&
      changes.changedFields.length > 0
    ) {
      const result =
        changes.changedFields
          .map(change =>
            normalizeStoredFieldChange(
              change,
              log
            )
          )
          .filter(
            change =>
              change.key !== ''
          );

      if (result.length > 0) {
        return result;
      }
    }

    /* -----------------------------------------------
       FORMAT 3:
       oldData/newData
       OR old_data/new_data
    ------------------------------------------------ */

    const oldData =
      getOldData(changes);

    const newData =
      getNewData(changes);

    const result: FieldChange[] = [];

    fields.forEach(field => {
      const oldValue =
        getValueFromObject(
          oldData,
          field.key
        );

      const newValue =
        getValueFromObject(
          newData,
          field.key
        );

      const oldExists =
        oldValue !== undefined &&
        oldValue !== null;

      const newExists =
        newValue !== undefined &&
        newValue !== null;

      if (
        oldExists ||
        newExists
      ) {
        if (action === 'update') {
          if (
            valuesAreDifferent(
              oldValue,
              newValue
            )
          ) {
            result.push({
              key: field.key,
              label: field.label,
              oldValue:
                oldValue ?? 0,
              newValue:
                newValue ?? 0,
            });
          }
        } else if (
          action === 'create'
        ) {
          if (
            numericValue(newValue) !== 0
          ) {
            result.push({
              key: field.key,
              label: field.label,
              oldValue: 0,
              newValue:
                newValue ?? 0,
            });
          }
        }
      }
    });

    if (result.length > 0) {
      return result;
    }

    /* -----------------------------------------------
       FORMAT 4:
       Direct field objects

       Example:
       {
         sandha: {
           oldValue: 100,
           newValue: 120
         }
       }
    ------------------------------------------------ */

    const directResult: FieldChange[] =
      [];

    fields.forEach(field => {
      const possibleChange =
        changes[field.key];

      if (
        possibleChange &&
        typeof possibleChange === 'object' &&
        !Array.isArray(possibleChange)
      ) {
        const normalized =
          normalizeStoredFieldChange(
            {
              ...possibleChange,
              key: field.key,
            },
            log
          );

        const hasValues =
          possibleChange.oldValue !== undefined ||
          possibleChange.old_value !== undefined ||
          possibleChange.old !== undefined ||
          possibleChange.from !== undefined ||
          possibleChange.newValue !== undefined ||
          possibleChange.new_value !== undefined ||
          possibleChange.new !== undefined ||
          possibleChange.to !== undefined;

        if (
          hasValues &&
          (
            action !== 'update' ||
            valuesAreDifferent(
              normalized.oldValue,
              normalized.newValue
            )
          )
        ) {
          directResult.push(
            normalized
          );
        }
      }
    });

    if (
      directResult.length > 0
    ) {
      return directResult;
    }

    /* -----------------------------------------------
       FORMAT 5:
       Flat old_value/new_value
    ------------------------------------------------ */

    if (
      fields.length === 1 &&
      (
        changes.old_value !== undefined ||
        changes.new_value !== undefined ||
        changes.oldValue !== undefined ||
        changes.newValue !== undefined
      )
    ) {
      const field =
        fields[0];

      return [
        {
          key: field.key,
          label: field.label,
          oldValue:
            changes.old_value ??
            changes.oldValue ??
            0,
          newValue:
            changes.new_value ??
            changes.newValue ??
            0,
        },
      ];
    }

    return [];
  }

  /* =========================================================
     GET FIELD CHANGES FROM MONTH CHANGE
  ========================================================= */

  function getFieldChangesFromMonthChange(
    monthChange: MonthChange,
    log: ActivityLog
  ): FieldChange[] {
    if (
      Array.isArray(
        monthChange.fieldChanges
      ) &&
      monthChange.fieldChanges.length > 0
    ) {
      return monthChange.fieldChanges
        .map(change =>
          normalizeStoredFieldChange(
            change,
            log
          )
        )
        .filter(
          change =>
            change.key !== ''
        );
    }

    if (
      Array.isArray(
        monthChange.changedFields
      ) &&
      monthChange.changedFields.length > 0
    ) {
      return monthChange.changedFields
        .map(change =>
          normalizeStoredFieldChange(
            change,
            log
          )
        )
        .filter(
          change =>
            change.key !== ''
        );
    }

    const oldData =
      monthChange.oldData ||
      monthChange.old_data ||
      {};

    const newData =
      monthChange.newData ||
      monthChange.new_data ||
      {};

    const fields =
      getFieldsForLog(log);

    const result: FieldChange[] = [];

    fields.forEach(field => {
      const oldValue =
        getValueFromObject(
          oldData,
          field.key
        );

      const newValue =
        getValueFromObject(
          newData,
          field.key
        );

      if (
        oldValue !== undefined ||
        newValue !== undefined
      ) {
        if (
          valuesAreDifferent(
            oldValue,
            newValue
          )
        ) {
          result.push({
            key: field.key,
            label: field.label,
            oldValue:
              oldValue ?? 0,
            newValue:
              newValue ?? 0,
          });
        }
      }
    });

    if (result.length > 0) {
      return result;
    }

    if (
      getTargetLabel(log.target_type) ===
        'Building Fund' &&
      (
        monthChange.oldValue !== undefined ||
        monthChange.newValue !== undefined
      )
    ) {
      return [
        {
          key: 'amount',
          label: 'Amount',
          oldValue:
            monthChange.oldValue ?? 0,
          newValue:
            monthChange.newValue ?? 0,
        },
      ];
    }

    return [];
  }

  /* =========================================================
     GET MONTH CHANGES
  ========================================================= */

  function getMonthChanges(
    log: ActivityLog
  ): MonthChange[] {
    const changes =
      parseChanges(log.changes);

    const storedMonthChanges =
      changes.monthChanges ||
      changes.month_changes;

    const changedMonthNumbers =
      changes.changedMonthNumbers ||
      changes.changed_month_numbers ||
      [];

    if (
      Array.isArray(
        storedMonthChanges
      ) &&
      storedMonthChanges.length > 0
    ) {
      return storedMonthChanges.map(
        (monthChange, index) => {
          const month =
            Number(monthChange.month) ||
            Number(
              changedMonthNumbers[index]
            ) ||
            getLogMonth(log) ||
            1;

          const year =
            Number(monthChange.year) ||
            Number(getLogYear(log));

          return {
            ...monthChange,
            month,
            year,
            monthName:
              monthChange.monthName ||
              getMonthName(month),
            fieldChanges:
              getFieldChangesFromMonthChange(
                monthChange,
                log
              ),
          };
        }
      );
    }

    const fieldChanges =
      getFieldChanges(log);

    if (
      fieldChanges.length === 0
    ) {
      return [];
    }

    const month =
      getLogMonth(log) || 1;

    return [
      {
        month,
        year:
          Number(getLogYear(log)),
        monthName:
          getMonthName(month),
        oldData:
          getOldData(changes),
        newData:
          getNewData(changes),
        fieldChanges,
      },
    ];
  }

  /* =========================================================
     GET GRAND TOTAL
  ========================================================= */

  function getGrandTotal(
    log: ActivityLog
  ) {
    const changes =
      parseChanges(log.changes);

    const storedTotal =
      changes.grandTotal ??
      changes.grand_total;

    if (
      storedTotal !== undefined &&
      storedTotal !== null &&
      storedTotal !== ''
    ) {
      return numericValue(
        storedTotal
      );
    }

    const target =
      getTargetLabel(log.target_type);

    const newData =
      getNewData(changes);

    if (
      target === 'Building Fund'
    ) {
      const changesList =
        getFieldChanges(log);

      if (
        changesList.length > 0
      ) {
        return numericValue(
          changesList[0].newValue
        );
      }

      return numericValue(
        changes.new_value ??
        changes.newValue ??
        newData.amount ??
        0
      );
    }

    if (
      Object.keys(newData).length > 0
    ) {
      return CONTRIBUTION_FIELDS.reduce(
        (total, field) =>
          total +
          numericValue(
            getValueFromObject(
              newData,
              field.key
            )
          ),
        0
      );
    }

    const fieldChanges =
      getFieldChanges(log);

    return fieldChanges.reduce(
      (total, change) =>
        total +
        numericValue(
          change.newValue
        ),
      0
    );
  }

  /* =========================================================
     HAS DETAILS
  ========================================================= */

  function hasDetails(
    log: ActivityLog
  ) {
    const target =
      getTargetLabel(log.target_type);

    if (
      target !== 'Contributions' &&
      target !== 'Building Fund'
    ) {
      return false;
    }

    return (
      getAction(log) === 'create' ||
      getAction(log) === 'update'
    );
  }

  /* =========================================================
     ACTION COLOR
  ========================================================= */

  function getActionColor(
    action: string
  ) {
    switch (action.toLowerCase()) {
      case 'create':
        return 'bg-green-100 text-green-700';

      case 'update':
        return 'bg-blue-100 text-blue-700';

      case 'delete':
        return 'bg-red-100 text-red-700';

      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  /* =========================================================
     FILTERED LOGS
  ========================================================= */

  const filteredLogs =
    logs.filter(log => {
      if (
        filterType !== 'all' &&
        getAction(log) !== filterType
      ) {
        return false;
      }

      if (
        filterTargetType !== 'all' &&
        getTargetLabel(log.target_type) !==
          filterTargetType
      ) {
        return false;
      }

      return true;
    });

  /* =========================================================
     ACTION COUNTS
  ========================================================= */

  const createCount =
    logs.filter(
      log =>
        getAction(log) === 'create'
    ).length;

  const updateCount =
    logs.filter(
      log =>
        getAction(log) === 'update'
    ).length;

  const deleteCount =
    logs.filter(
      log =>
        getAction(log) === 'delete'
    ).length;

  /* =========================================================
     TARGET COUNTS
  ========================================================= */

  const targetCounts =
    logs.reduce(
      (result, log) => {
        const label =
          getTargetLabel(
            log.target_type
          );

        result[label] =
          (result[label] || 0) + 1;

        return result;
      },
      {} as Record<string, number>
    );

  /* =========================================================
     DESCRIPTION
  ========================================================= */

  function renderDescription(
    log: ActivityLog
  ) {
    const action =
      getAction(log);

    const target =
      getTargetLabel(
        log.target_type
      );

    const memberName =
      getLogMemberName(log);

    const year =
      getLogYear(log);

    const monthName =
      getLogMonthName(log);

    if (
      target === 'Contributions'
    ) {
      const actionText =
        action === 'create'
          ? 'created'
          : action === 'delete'
          ? 'deleted'
          : 'edited';

      return (
        <div>
          <p className="text-xs font-semibold text-slate-800">
            {log.admin?.full_name ||
              'Unknown Admin'}{' '}
            {actionText}{' '}
            Contributions for{' '}
            <span className="text-teal-700">
              {memberName}
            </span>
          </p>

          <p className="text-xs text-slate-500 mt-1">
            Year: {year} • {monthName}
          </p>

          {hasDetails(log) && (
            <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide mt-2">
              Click to view field-by-field changes
            </p>
          )}
        </div>
      );
    }

    if (
      target === 'Building Fund'
    ) {
      const actionText =
        action === 'create'
          ? 'created'
          : action === 'delete'
          ? 'deleted'
          : 'edited';

      return (
        <div>
          <p className="text-xs font-semibold text-slate-800">
            {log.admin?.full_name ||
              'Unknown Admin'}{' '}
            {actionText}{' '}
            Building Fund for{' '}
            <span className="text-teal-700">
              {memberName}
            </span>
          </p>

          <p className="text-xs text-slate-500 mt-1">
            Year: {year} • {monthName}
          </p>

          {hasDetails(log) && (
            <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide mt-2">
              Click to view field-by-field changes
            </p>
          )}
        </div>
      );
    }

    return (
      <p className="text-xs text-slate-600">
        {log.description ||
          `${log.admin?.full_name || 'Unknown Admin'} performed ${action} on ${target}`}
      </p>
    );
  }

  /* =========================================================
     RENDER DETAILS
  ========================================================= */

  function renderDetails(
    log: ActivityLog
  ) {
    const target =
      getTargetLabel(
        log.target_type
      );

    const memberName =
      getLogMemberName(log);

    const monthChanges =
      getMonthChanges(log);

    const allFieldChanges =
      monthChanges.flatMap(
        monthChange =>
          monthChange.fieldChanges || []
      );

    const grandTotal =
      getGrandTotal(log);

    return (
      <div className="mt-2 mb-3 rounded-xl border border-slate-200 bg-white overflow-hidden">

        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <p className="text-sm font-bold text-slate-800">
            {memberName}'s {target}
          </p>

          <p className="text-xs text-slate-500 mt-1">
            Year: {getLogYear(log)}
            {' • '}
            {getLogMonthName(log)}
          </p>
        </div>

        <div className="p-4 space-y-4">

          {allFieldChanges.length === 0 ? (

            <div className="px-4 py-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-bold text-amber-800">
                Detailed field history is unavailable for this old activity.
              </p>

              <p className="text-xs text-amber-700 mt-1">
                This activity log was created without old and new
                column values, so the previous field amounts cannot
                be reconstructed from the existing log.
              </p>
            </div>

          ) : (

            monthChanges.map(
              (
                monthChange,
                monthIndex
              ) => {
                const fields =
                  monthChange.fieldChanges || [];

                if (
                  fields.length === 0
                ) {
                  return null;
                }

                return (
                  <div
                    key={`${log.id}-${monthIndex}`}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {monthChange.monthName ||
                            getMonthName(
                              monthChange.month
                            )}
                        </p>

                        <p className="text-xs text-slate-500">
                          Year: {monthChange.year}
                        </p>
                      </div>

                      <span className="text-xs font-semibold text-slate-500">
                        {fields.length}{' '}
                        {fields.length === 1
                          ? 'column changed'
                          : 'columns changed'}
                      </span>
                    </div>

                    {fields.map(
                      (
                        change,
                        fieldIndex
                      ) => (
                        <div
                          key={`${log.id}-${monthIndex}-${change.key}-${fieldIndex}`}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-4 bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <Edit3 className="w-4 h-4 text-blue-600" />
                            </div>

                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {change.label}
                              </p>

                              <p className="text-xs text-slate-500 mt-0.5">
                                Column edited
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="min-w-[85px] text-right">
                              <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">
                                Old Amount
                              </p>

                              <p className="font-bold text-red-600">
                                {formatAmount(
                                  change.oldValue
                                )}
                              </p>
                            </div>

                            <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />

                            <div className="min-w-[85px]">
                              <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">
                                New Amount
                              </p>

                              <p className="font-bold text-green-600">
                                {formatAmount(
                                  change.newValue
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              }
            )

          )}

          <div className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
            <span className="font-semibold text-slate-700">
              Grand Total
            </span>

            <span className="text-lg font-bold text-green-700">
              {formatAmount(grandTotal)}
            </span>
          </div>

        </div>
      </div>
    );
  }

  /* =========================================================
     RETURN
  ========================================================= */

  return (
    <div className="w-full">

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Activity Logs
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            All admin actions and changes
          </p>
        </div>

        <button
          onClick={() => {
            fetchLogs();
            fetchMembers();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              loading
                ? 'animate-spin'
                : ''
            }`}
          />

          Refresh
        </button>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Action Type
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            {
              key: 'all',
              label: 'All',
              count: logs.length,
            },
            {
              key: 'create',
              label: 'Create',
              count: createCount,
            },
            {
              key: 'update',
              label: 'Update',
              count: updateCount,
            },
            {
              key: 'delete',
              label: 'Delete',
              count: deleteCount,
            },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => {
                setFilterType(item.key);
                setExpandedLogId(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                filterType === item.key
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Target Type
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setFilterTargetType('all');
              setExpandedLogId(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              filterTargetType === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Targets ({logs.length})
          </button>

          {Object.entries(targetCounts).map(
            ([label, count]) => (
              <button
                key={label}
                onClick={() => {
                  setFilterTargetType(label);
                  setExpandedLogId(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  filterTargetType === label
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label} ({count})
              </button>
            )
          )}
        </div>
      </div>

      {loading ? (

        <div className="flex items-center justify-center h-56">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>

      ) : filteredLogs.length === 0 ? (

        <div className="flex flex-col items-center justify-center h-56 bg-white border border-slate-200 rounded-xl">
          <Activity className="w-12 h-12 text-slate-300 mb-3" />

          <p className="font-medium text-slate-500">
            No activity logs found
          </p>
        </div>

      ) : (

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1100px]">

              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Date & Time
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Admin
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Church
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Action
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Target
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Description
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredLogs.map(log => {
                  const action =
                    getAction(log);

                  const target =
                    getTargetLabel(
                      log.target_type
                    );

                  const details =
                    hasDetails(log);

                  const expanded =
                    expandedLogId === log.id;

                  return (
                    <Fragment key={log.id}>

                      <tr
                        onClick={() => {
                          if (details) {
                            setExpandedLogId(
                              previous =>
                                previous === log.id
                                  ? null
                                  : log.id
                            );
                          }
                        }}
                        className={`transition-colors ${
                          details
                            ? 'cursor-pointer hover:bg-slate-50'
                            : ''
                        }`}
                      >

                        <td className="px-4 py-4 text-xs text-slate-600">
                          <p>
                            {formatDate(
                              log.created_at
                            )}
                          </p>

                          <p className="text-slate-400 mt-0.5">
                            {formatTime(
                              log.created_at
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold text-slate-800">
                            {log.admin?.full_name ||
                              'Unknown Admin'}
                          </p>

                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {log.admin?.email || '—'}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-xs text-slate-600">
                          {log.church?.name || '—'}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(
                              action
                            )}`}
                          >
                            {action}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-xs font-semibold text-slate-700">
                            {target}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-start justify-between gap-3">

                            <div className="flex-1">
                              {renderDescription(log)}
                            </div>

                            {details && (
                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation();

                                  setExpandedLogId(
                                    previous =>
                                      previous === log.id
                                        ? null
                                        : log.id
                                  );
                                }}
                                className="shrink-0 p-1 rounded hover:bg-slate-100"
                                title={
                                  expanded
                                    ? 'Hide changes'
                                    : 'View changes'
                                }
                              >
                                {expanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )}
                              </button>
                            )}

                          </div>
                        </td>

                      </tr>

                      {expanded &&
                        details && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-3 bg-slate-50"
                            >
                              {renderDetails(log)}
                            </td>
                          </tr>
                        )}

                    </Fragment>
                  );
                })}

              </tbody>

            </table>

          </div>
        </div>
      )}

    </div>
  );
}