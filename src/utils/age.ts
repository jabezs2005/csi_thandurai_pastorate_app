function parseDate(dob?: string | null): Date | null {
  if (!dob) return null;
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Age in whole years (null if there is no valid date of birth)
export function getAge(dob?: string | null): number | null {
  const d = parseDate(dob);
  if (!d) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age < 0 ? null : age;
}

// "34 years", "8 months", "Less than 1 month" or "—"
export function formatAge(dob?: string | null): string {
  const d = parseDate(dob);
  if (!d) return '—';
  const years = getAge(dob);
  if (years === null) return '—';
  if (years >= 1) return `${years} year${years === 1 ? '' : 's'}`;

  const today = new Date();
  let months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  if (today.getDate() < d.getDate()) months--;
  if (months < 1) return 'Less than 1 month';
  return `${months} month${months === 1 ? '' : 's'}`;
}