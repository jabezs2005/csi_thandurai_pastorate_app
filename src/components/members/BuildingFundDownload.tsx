import { useState } from 'react';
import { Building2, ChevronDown, Download, FileText } from 'lucide-react';
import { exportAllBuildingFund } from '../../utils/buildingFundExport';

interface Props {
  churchId?: string;
  churchName?: string;
  filteredMemberIds?: string[]; // pass the ids currently shown after search / filters
  filtersActive?: boolean;
}

export default function BuildingFundDownload({ churchId, churchName, filteredMemberIds, filtersActive }: Props) {
  const thisYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(thisYear);
  const [busy, setBusy] = useState(false);

  const years = Array.from({ length: 8 }, (_, i) => thisYear + 1 - i);

  async function run(kind: 'csv' | 'pdf', onlyFiltered: boolean) {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      await exportAllBuildingFund({
        year,
        kind,
        churchId,
        churchName,
        onlyMemberIds: onlyFiltered ? filteredMemberIds : undefined,
      });
    } catch (error: any) {
      console.error('Building fund download failed:', error);
      alert(`Failed to download: ${error?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  }

  const showFiltered = !!filtersActive && !!filteredMemberIds;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium border border-amber-200 disabled:opacity-60"
      >
        <Building2 className="w-4 h-4" />
        {busy ? 'Preparing...' : 'Building Fund'}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-2">
            <div className="px-3 pb-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Building Construction Fund
              </p>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Year"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <p className="px-3 pt-2 pb-1 text-xs text-slate-500">All members</p>
            <button
              onClick={() => run('csv', false)}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            <button
              onClick={() => run('pdf', false)}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>

            {showFiltered && (
              <>
                <p className="px-3 pt-2 pb-1 text-xs text-slate-500 border-t border-slate-100 mt-1">
                  Filtered members ({filteredMemberIds!.length})
                </p>
                <button
                  onClick={() => run('csv', true)}
                  disabled={filteredMemberIds!.length === 0}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button
                  onClick={() => run('pdf', true)}
                  disabled={filteredMemberIds!.length === 0}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}