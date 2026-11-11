import { Member } from '../types';

export function exportToCSV(filename: string, data: any[], columns: { key: string; label: string }[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = columns.map(c => esc(c.label)).join(',');
  const rows = data.map(row => columns.map(col => esc(row[col.key])).join(','));
  const csv = '\uFEFF' + [headers, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportMembersToExcel(members: Member[], churchName: string) {
  try {
    const columns = [
      { key: 'family_number', label: 'Sandha No' },
      { key: 'title', label: 'Title' },
      { key: 'member_name', label: 'Member Name' },
      { key: 'gender', label: 'Gender' },
      { key: 'address', label: 'Address' },
      { key: 'email', label: 'Email' },
      { key: 'mobile', label: 'Mobile' },
    ];
    exportToCSV(`members-${churchName}-${new Date().toISOString().split('T')[0]}`, members, columns);
  } catch (err) {
    console.error('Export failed:', err);
    throw new Error('Failed to export members');
  }
}

export function generatePDF(title: string, content: string, filename: string) {
  const printWindow = window.open('', '', 'width=1000,height=700');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${filename}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
          h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background-color: #007bff; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .footer { margin-top: 30px; font-size: 10px; color: #666; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${content}
        <div class="footer"><p>Generated on ${new Date().toLocaleString('en-IN')}</p></div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}