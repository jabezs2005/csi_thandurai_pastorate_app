import { supabase } from '../lib/supabase';
import { SUBSCRIPTION_FIELDS, MONTHS } from '../types';
import { fetchAllPages } from './fetchAll';
import { compareFamilyNumbers } from './familyUtils';
import { cleanPart } from './fileNames';
import { downloadCsv, downloadPdf } from './tableExport';
import { formatDisplayDate, formatDayShort, istDate, istDayStartISO, istDayEndISO } from './dates';

export type EntryKind = 'subscription' | 'building_fund';
export type RowType = 'row' | 'subtotal' | 'grand';

// 'saved' = the day the admin pressed Save, 'entry' = the Entry date typed in the form
export type Basis = 'saved' | 'entry';

export interface MemberLite {
  id: string;
  family_number: string;
  title: string | null;
  member_name: string;
}

export interface EntryRow {
  member_id: string;
  entry_date: string;
  created_at: string;
  year: number;
  month: number;
  field_key: string;
  amount: number | null;
  day: string; // the date this line is grouped under
}

type RawEntry = Omit<EntryRow, 'day'>;

export interface DateWiseData {
  members: Map<string, MemberLite>;
  entries: EntryRow[];
}

export interface DateWiseTable {
  headers: string[];
  body: (string | number)[][];
  rowTypes: RowType[];
  count: number;
}

export const kindLabel = (kind: EntryKind) =>
  kind === 'subscription' ? 'Subscription' : 'Building Construction Fund';

export const kindFile = (kind: EntryKind) => (kind === 'subscription' ? 'Subscription' : 'Building-Fund');

export function columnsFor(kind: EntryKind): { key: string; label: string }[] {
  return kind === 'subscription'
    ? SUBSCRIPTION_FIELDS.map(f => ({ key: String(f.key), label: String(f.label) }))
    : [{ key: 'amount', label: 'Amount (Rs.)' }];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function loadDateWise(opts: {
  kind: EntryKind;
  churchId: string;
  from: string;
  to: string;
  memberId?: string;
  basis?: Basis;
}): Promise<DateWiseData> {
  const { kind, churchId, from, to, memberId } = opts;
  const basis: Basis = opts.basis || 'entry';

  const raw = await fetchAllPages<RawEntry>((a, b) => {
    let q = supabase
      .from('contribution_entries')
      .select('member_id, entry_date, created_at, year, month, field_key, amount')
      .eq('church_id', churchId)
      .eq('kind', kind);

    q =
      basis === 'saved'
        ? q.gte('created_at', istDayStartISO(from)).lte('created_at', istDayEndISO(to))
        : q.gte('entry_date', from).lte('entry_date', to);

    if (memberId) q = q.eq('member_id', memberId);
    return q.order('id').range(a, b);
  });

  const entries: EntryRow[] = raw.map(r => ({
    ...r,
    day: basis === 'saved' ? istDate(r.created_at) : r.entry_date,
  }));

  const memberRows = await fetchAllPages<MemberLite>((a, b) => {
    let q = supabase
      .from('members')
      .select('id, family_number, title, member_name')
      .eq('church_id', churchId);
    if (memberId) q = q.eq('id', memberId);
    return q.order('id').range(a, b);
  });

  return { members: new Map(memberRows.map(m => [m.id, m])), entries };
}

function monthLabels(keys: Set<string>): string {
  return Array.from(keys)
    .sort()
    .map(k => {
      const [y, m] = k.split('-').map(Number);
      return `${MONTHS[m - 1]} ${y}`;
    })
    .join(', ');
}

interface MemberDay {
  amounts: Record<string, number>;
  months: Set<string>; // "YYYY-MM"
}

// One block per day (oldest first), members in Sandha order, a total after each day.
// "For month" shows which month rows were edited for that member on that day.
export function buildDateWiseTable(data: DateWiseData, kind: EntryKind): DateWiseTable {
  const cols = columnsFor(kind);
  const headers = ['Date', 'Sandha No', 'Member Name', 'For month', ...cols.map(c => c.label), 'Total'];

  const byDate = new Map<string, Map<string, MemberDay>>();
  for (const e of data.entries) {
    const amount = Number(e.amount) || 0;
    if (amount === 0) continue;
    if (!byDate.has(e.day)) byDate.set(e.day, new Map());
    const members = byDate.get(e.day)!;
    if (!members.has(e.member_id)) members.set(e.member_id, { amounts: {}, months: new Set() });
    const day = members.get(e.member_id)!;
    day.amounts[e.field_key] = (day.amounts[e.field_key] || 0) + amount;
    day.months.add(`${Number(e.year)}-${String(Number(e.month)).padStart(2, '0')}`);
  }

  const body: (string | number)[][] = [];
  const rowTypes: RowType[] = [];
  const grandCols: number[] = cols.map(() => 0);
  let grandTotal = 0;
  let count = 0;

  for (const date of Array.from(byDate.keys()).sort()) {
    const label = formatDisplayDate(date);
    const dayCols: number[] = cols.map(() => 0);
    let dayTotal = 0;
    let added = 0;

    const lines = Array.from(byDate.get(date)!.entries())
      .map(([memberId, day]) => ({ member: data.members.get(memberId), day }))
      .sort((a, b) => compareFamilyNumbers(a.member?.family_number || '', b.member?.family_number || ''));

    for (const { member, day } of lines) {
      const amounts = cols.map(c => round2(day.amounts[c.key] || 0));
      if (amounts.every(v => v === 0)) continue;
      const total = round2(amounts.reduce((s, v) => s + v, 0));

      amounts.forEach((v, i) => { dayCols[i] += v; });
      dayTotal += total;
      added++;
      count++;

      body.push([
        label,
        member?.family_number || '',
        `${member?.title ? `${member.title} ` : ''}${member?.member_name || 'Deleted member'}`,
        monthLabels(day.months),
        ...amounts.map(v => (v === 0 ? '' : v)),
        total,
      ]);
      rowTypes.push('row');
    }

    if (added > 0) {
      body.push([label, '', `Total for ${label}`, '', ...dayCols.map(round2), round2(dayTotal)]);
      rowTypes.push('subtotal');
      dayCols.forEach((v, i) => { grandCols[i] += v; });
      grandTotal += dayTotal;
    }
  }

  if (count > 0) {
    body.push(['', '', 'GRAND TOTAL', '', ...grandCols.map(round2), round2(grandTotal)]);
    rowTypes.push('grand');
  }

  return { headers, body, rowTypes, count };
}

interface WeekAgg {
  amounts: Record<string, number>;
  days: Set<string>;
  months: Set<string>;
}

// One row per member who was edited, like the subscription table:
// Sandha No and name instead of the month, then the contribution columns.
export function buildWeeklyTable(data: DateWiseData, kind: EntryKind): DateWiseTable {
  const cols = columnsFor(kind);
  const headers = ['Sandha No', 'Member Name', 'Saved on', 'For month', ...cols.map(c => c.label), 'Total'];

  const byMember = new Map<string, WeekAgg>();
  for (const e of data.entries) {
    const amount = Number(e.amount) || 0;
    if (amount === 0) continue;
    if (!byMember.has(e.member_id)) byMember.set(e.member_id, { amounts: {}, days: new Set(), months: new Set() });
    const agg = byMember.get(e.member_id)!;
    agg.amounts[e.field_key] = (agg.amounts[e.field_key] || 0) + amount;
    agg.days.add(e.day);
    agg.months.add(`${Number(e.year)}-${String(Number(e.month)).padStart(2, '0')}`);
  }

  const lines = Array.from(byMember.entries())
    .map(([id, agg]) => ({ member: data.members.get(id), agg }))
    .sort((a, b) => compareFamilyNumbers(a.member?.family_number || '', b.member?.family_number || ''));

  const body: (string | number)[][] = [];
  const rowTypes: RowType[] = [];
  const colTotals: number[] = cols.map(() => 0);
  let grand = 0;
  let count = 0;

  for (const { member, agg } of lines) {
    const amounts = cols.map(c => round2(agg.amounts[c.key] || 0));
    if (amounts.every(v => v === 0)) continue; // corrections that cancel out

    const total = round2(amounts.reduce((s, v) => s + v, 0));
    amounts.forEach((v, i) => { colTotals[i] += v; });
    grand += total;
    count++;

    body.push([
      member?.family_number || '',
      `${member?.title ? `${member.title} ` : ''}${member?.member_name || 'Deleted member'}`,
      Array.from(agg.days).sort().map(formatDayShort).join(', '),
      monthLabels(agg.months),
      ...amounts.map(v => (v === 0 ? '' : v)),
      total,
    ]);
    rowTypes.push('row');
  }

  if (count > 0) {
    body.push(['', 'TOTAL', '', '', ...colTotals.map(round2), round2(grand)]);
    rowTypes.push('grand');
  }

  return { headers, body, rowTypes, count };
}

export async function downloadDateWise(opts: {
  kind: EntryKind;
  church: { id: string; name: string };
  from: string;
  to: string;
  format: 'csv' | 'pdf';
  memberId?: string;
  basis?: Basis;
}): Promise<number> {
  const data = await loadDateWise({
    kind: opts.kind,
    churchId: opts.church.id,
    from: opts.from,
    to: opts.to,
    memberId: opts.memberId,
    basis: opts.basis,
  });
  const table = buildDateWiseTable(data, opts.kind);

  if (table.count === 0) {
    alert('No date-wise entries found for this period. Dates are recorded each time an update is saved.');
    return 0;
  }

  const member = opts.memberId ? data.members.get(opts.memberId) : undefined;
  const memberPart = member
    ? `Sandha-No-${cleanPart(member.family_number, 12)}_${cleanPart(member.member_name)}`
    : '';

  const fileName = [
    cleanPart(opts.church.name),
    memberPart,
    kindFile(opts.kind),
    'Date-wise',
    `${opts.from}_to_${opts.to}`,
  ]
    .filter(Boolean)
    .join('_');

  const title = [
    opts.church.name,
    member ? `${member.member_name} (Sandha No ${member.family_number})` : '',
    `${kindLabel(opts.kind)} - Date-wise`,
    `${formatDisplayDate(opts.from)} to ${formatDisplayDate(opts.to)}`,
  ]
    .filter(Boolean)
    .join(' - ');

  if (opts.format === 'csv') downloadCsv(fileName, table.headers, table.body);
  else downloadPdf(fileName, title, table.headers, table.body);

  return table.count;
}