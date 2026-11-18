import { useState } from 'react';
import WeeklyReport from './WeeklyReport';
import WeeklyEntry from './WeeklyEntry';

interface Props {
  churchId: string;
  churchName: string;
}

export default function WeeklyTab({ churchId, churchName }: Props) {
  const [mode, setMode] = useState<'edited' | 'enter'>('edited');

  const toggle = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setMode('edited')} className={toggle(mode === 'edited')}>
            Edited this week
          </button>
          <button onClick={() => setMode('enter')} className={toggle(mode === 'enter')}>
            Enter amounts
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {mode === 'edited'
            ? 'Members whose Subscription / Building Fund was edited in a Sunday to Saturday week.'
            : 'Enter a Sunday collection for all members at once.'}
        </p>
      </div>

      {mode === 'edited' ? (
        <WeeklyReport churchId={churchId} churchName={churchName} />
      ) : (
        <WeeklyEntry churchId={churchId} churchName={churchName} />
      )}
    </div>
  );
}