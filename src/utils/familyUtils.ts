export function parseFamilyNumber(value: string) {
  const v = (value || '').trim().toUpperCase();
  const m = v.match(/^(\d+)\s*([A-Z]*)$/);
  if (!m) return { num: Number.MAX_SAFE_INTEGER, suffix: v, base: v };
  const num = parseInt(m[1], 10);
  return { num, suffix: m[2], base: String(num) };
}

// Order: 1, 1A, 1B, 2, 2A, 10, 10A ...
export function compareFamilyNumbers(a: string, b: string) {
  const x = parseFamilyNumber(a);
  const y = parseFamilyNumber(b);
  if (x.num !== y.num) return x.num - y.num;
  if (x.suffix.length !== y.suffix.length) return x.suffix.length - y.suffix.length;
  return x.suffix.localeCompare(y.suffix);
}

export function sortMembersByFamily<T extends { family_number: string; church_id?: string; member_name?: string }>(
  members: T[]
): T[] {
  return [...members].sort((a, b) => {
    const church = (a.church_id || '').localeCompare(b.church_id || '');
    if (church !== 0) return church;
    const fam = compareFamilyNumbers(a.family_number, b.family_number);
    if (fam !== 0) return fam;
    return (a.member_name || '').localeCompare(b.member_name || '');
  });
}

// 1, 1A and 1B all go into ONE group "1" (per church)
export function groupMembersByFamily<T extends { family_number: string; church_id?: string; member_name?: string }>(
  members: T[]
) {
  const map = new Map<string, { key: string; base: string; members: T[] }>();
  for (const m of sortMembersByFamily(members)) {
    const base = parseFamilyNumber(m.family_number).base;
    const key = `${m.church_id ?? ''}|${base}`;
    if (!map.has(key)) map.set(key, { key, base, members: [] });
    map.get(key)!.members.push(m);
  }
  return Array.from(map.values());
}

export function countFamilies<T extends { family_number: string; church_id?: string }>(members: T[]) {
  return groupMembersByFamily(members).length;
}