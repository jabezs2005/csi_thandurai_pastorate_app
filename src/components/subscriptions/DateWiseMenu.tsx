import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, Download, FileText } from 'lucide-react';
import { downloadDateWise, EntryKind } from '../../utils/dateWiseExport';

interface Props {
  kind: EntryKind;
  churchId: string;
  churchName?: string;
  memberId?: string;
  year: number;
}

export default function DateWiseMenu({ kind, churchId, churchName, memberId, year }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFrom(`${year}-01-01`);
    setTo(`${year}-12-31`);
  }, [year]);

  async function run(format: 'csv' | 'pdf') {
    if (busy) return;
    if (!from || !to || from > to) {
      alert('Please choose a valid From and To date.');
      return;
    }
    setBusy(true);
    setOpen(false);
    try {
      await downloadDateWise({
        kind,
        church: { id: churchId, name: churchName || 'church' },
        from,
        to,
        format,
        memberId,
      });
    } catch (error: any) {
      console.error('Date-wise download failed:', error);
      alert(`Failed to download: ${error?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 text-sm font-medium disabled:opacity-60"
      >
        <CalendarDays className="w-4 h-4" />
        {busy ? 'Preparing...' : 'Date-wise'}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Download by date</p>
            <label className="block text-xs text-slate-500">
              From
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <label className="block text-xs text-slate-500">
              To
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => run('csv')}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
              <button
                onClick={() => run('pdf')}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border border-orange-200 bg-orange-50 text-orange-700 rounded-lg text-sm hover:bg-orange-100"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}