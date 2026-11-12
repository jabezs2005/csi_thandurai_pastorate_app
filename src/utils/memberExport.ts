import { Member } from '../types';
import { getAge } from './age';
import { generatePDF } from './export';
import { seriesFileName } from './fileNames';

interface ExportOptions {
  churchName: string;
  label: 'all' | 'filtered';
  getTotal: (memberId: string) => number;
}

const escapeCSV = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const escapeHtml = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0);

const HEAD = [
  'Sandha No', 'Title', 'Member Name', 'Gender', 'Age', 'Confirmation',
  'Address', 'Email', 'Mobile', 'Grand Total Contribution',
];

function nameFor(list: Member[], { churchName, label }: ExportOptions) {
  return seriesFileName(churchName, list, label === 'all' ? 'Members' : 'Filtered-Members');
}

export function exportMembersCsv(list: Member[], options: ExportOptions) {
  try {
    const rows = list.map(m => [
      m.family_number || '',
      m.title || '',
      m.member_name || '',
      m.gender || '',
      getAge(m.date_of_birth) ?? '',
      m.confirmation_status || '',
      m.address || '',
      m.email || '',
      m.mobile || '',
      options.getTotal(m.id).toFixed(2),
    ]);

    const csv = [HEAD, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', `${nameFor(list, options)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export CSV. Please try again.');
  }
}

export function exportMembersPdf(list: Member[], options: ExportOptions) {
  const rows = list
    .map(
      m => `
        <tr>
          <td>${escapeHtml(m.family_number)}</td>
          <td>${escapeHtml(m.title)}</td>
          <td>${escapeHtml(m.member_name)}</td>
          <td>${escapeHtml(m.gender)}</td>
          <td>${escapeHtml(getAge(m.date_of_birth) ?? '')}</td>
          <td>${escapeHtml(m.confirmation_status)}</td>
          <td>${escapeHtml(m.address)}</td>
          <td>${escapeHtml(m.email)}</td>
          <td>${escapeHtml(m.mobile)}</td>
          <td>${escapeHtml(money(options.getTotal(m.id)))}</td>
        </tr>`
    )
    .join('');

  const table = `
    <table style="width:100%; border-collapse: collapse;">
      <thead><tr>${HEAD.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  const scope = options.label === 'all' ? 'All Members' : 'Filtered Members';
  generatePDF(escapeHtml(`${scope} - ${options.churchName}`), table, nameFor(list, options));
}