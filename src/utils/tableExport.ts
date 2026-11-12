import { generatePDF } from './export';

type Cell = string | number | null | undefined;

const escapeCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function downloadCsv(fileName: string, headers: string[], rows: Cell[][]) {
  const csv = [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPdf(fileName: string, title: string, headers: string[], rows: Cell[][]) {
  const table = `
    <table style="width:100%; border-collapse: collapse;">
      <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
  generatePDF(escapeHtml(title), table, fileName);
}