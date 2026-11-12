import { supabase } from '../lib/supabase';
import { MONTHS } from '../types';
import { sortMembersByFamily } from './familyUtils';
import { allMembersFileName, seriesFileName } from './fileNames';
import { downloadCsv, downloadPdf } from './tableExport';

interface MemberRow {
  id: string;
  church_id: string;
  family_number: string;
  title: string | null;
  member_name: string;
  church?: { name?: string } | { name?: string }[] | null;
}

interface FundRow {
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

interface Options {
  year: number;
  kind: 'csv' | 'pdf';
  churchId?: string;          // omitted = all churches (super admin "All" view)
  churchName?: string;
  onlyMemberIds?: string[];   // omitted = every member
}

export async function exportAllBuildingFund({ year, kind, churchId, churchName, onlyMemberIds }: Options) {
  const [membersRaw, funds] = await Promise.all([
    fetchAllPages<MemberRow>((from, to) => {
      let q = supabase
        .from('members')
        .select('id, church_id, family_number, title, member_name, church:churches(name)')
        .order('id')
        .range(from, to);
      if (churchId) q = q.eq('church_id', churchId);
      return q;
    }),
    fetchAllPages<FundRow>((from, to) => {
      let q = supabase
        .from('building_construction_fund')
        .select('member_id, month, amount')
        .eq('year', year)
        .order('id')
        .range(from, to);
      if (churchId) q = q.eq('church_id', churchId);
      return q;
    }),
  ]);

  const allowed = onlyMemberIds ? new Set(onlyMemberIds) : null;
  const members = sortMembersByFamily(
    allowed ? membersRaw.filter(m => allowed.has(m.id)) : membersRaw
  );

  // member id -> 12 monthly amounts
  const byMember = new Map<string, number[]>();
  funds.forEach(f => {
    const idx = Number(f.month) - 1;
    if (idx < 0 || idx > 11) return;
    if (!byMember.has(f.member_id)) byMember.set(f.member_id, Array(12).fill(0));
    byMember.get(f.member_id)![idx] += Number(f.amount) || 0;
  });

  const showChurchColumn = !churchId;
  const churchOf = (m: MemberRow) => {
    const c = Array.isArray(m.church) ? m.church[0] : m.church;
    return c?.name || '';
  };

  const headers = [
    'Sandha No',
    ...(showChurchColumn ? ['Church'] : []),
    'Title',
    'Member Name',
    ...MONTHS,
    'Total',
  ];

  const monthTotals: number[] = Array(12).fill(0);
  let everyoneTotal = 0;

  const body: (string | number)[][] = members.map(m => {
    const amounts = byMember.get(m.id) || Array(12).fill(0);
    const total = amounts.reduce((sum, v) => sum + v, 0);

    amounts.forEach((v, i) => { monthTotals[i] += v; });
    everyoneTotal += total;

    return [
      m.family_number,
      ...(showChurchColumn ? [churchOf(m)] : []),
      m.title || '',
      m.member_name,
      ...amounts,
      total,
    ];
  });

  body.push([
    '',
    ...(showChurchColumn ? [''] : []),
    '',
    'TOTAL',
    ...monthTotals,
    everyoneTotal,
  ]);

  const nameForFile = churchId ? churchName : 'All-Churches';
  const report = `Building-Fund-${year}`;
  const fileName = onlyMemberIds
    ? seriesFileName(nameForFile, members, report)        // Church_Sandha-No-1-to-40_Building-Fund-2026
    : allMembersFileName(nameForFile, report);            // Church_All-Members_Building-Fund-2026

  if (kind === 'csv') {
    downloadCsv(fileName, headers, body);
  } else {
    const title = [
      nameForFile,
      onlyMemberIds ? 'Filtered Members' : 'All Members',
      `Building Construction Fund ${year}`,
    ]
      .filter(Boolean)
      .join(' - ');
    downloadPdf(fileName, title, headers, body);
  }

  return members.length;
}