import { compareFamilyNumbers } from './familyUtils';

export function cleanPart(value?: string | null, max = 60): string {
  return (value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
    .replace(/[.,]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);
}

// Sandha-No-1A_K-Francis-Devakumar_CSI-Jesus-The-Redeemer-Church_Contributions-2026
export function memberFileName(opts: {
  sandhaNo: string;
  memberName: string;
  churchName?: string | null;
  report: string;
}): string {
  const sandha = cleanPart(opts.sandhaNo, 12);
  return [
    sandha ? `Sandha-No-${sandha}` : '',
    cleanPart(opts.memberName),
    cleanPart(opts.churchName),
    cleanPart(opts.report),
  ]
    .filter(Boolean)
    .join('_');
}

// "Sandha-No-1" or "Sandha-No-1-to-120B"
export function seriesLabel(members: { family_number: string }[]): string {
  if (members.length === 0) return 'Sandha-No-none';
  const nums = members.map(m => m.family_number).sort(compareFamilyNumbers);
  const first = cleanPart(nums[0], 12);
  const last = cleanPart(nums[nums.length - 1], 12);
  return first === last ? `Sandha-No-${first}` : `Sandha-No-${first}-to-${last}`;
}

// CSI-Jesus-The-Redeemer-Church_Sandha-No-1-to-120B_Members
export function seriesFileName(
  churchName: string | null | undefined,
  members: { family_number: string }[],
  report: string
): string {
  return [cleanPart(churchName), seriesLabel(members), cleanPart(report)].filter(Boolean).join('_');
}

// CSI-Jesus-The-Redeemer-Church_All-Members_Building-Fund-2026
export function allMembersFileName(churchName: string | null | undefined, report: string): string {
  return [cleanPart(churchName), 'All-Members', cleanPart(report)].filter(Boolean).join('_');
}