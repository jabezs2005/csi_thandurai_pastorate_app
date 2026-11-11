import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour of inactivity
const WARNING_MS = 60 * 1000;         // warn during the last minute
const STORAGE_KEY = 'csi_last_activity';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart', 'click'];

function readLastActivity(): number {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return value > 0 ? value : Date.now();
  } catch {
    return Date.now();
  }
}

function writeLastActivity(time: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(time));
  } catch {
    /* ignore */
  }
}

export default function IdleLogout() {
  const { signOut } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const signingOut = useRef(false);

  useEffect(() => {
    function logout() {
      if (signingOut.current) return;
      signingOut.current = true;
      void signOut();
    }

    // Any activity (in any open tab) resets the timer
    function markActivity() {
      const now = Date.now();
      if (now - lastWrite.current < 2000) return; // throttle writes
      lastWrite.current = now;
      writeLastActivity(now);
      setSecondsLeft(null);
    }

    function check() {
      const idle = Date.now() - readLastActivity();
      if (idle >= IDLE_LIMIT_MS) {
        logout();
        return;
      }
      const left = IDLE_LIMIT_MS - idle;
      setSecondsLeft(left <= WARNING_MS ? Math.ceil(left / 1000) : null);
    }

    // On load: if the browser was closed and reopened after the limit, sign out now
    if (!localStorage.getItem(STORAGE_KEY)) writeLastActivity(Date.now());
    check();

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActivity, { passive: true }));
    const interval = window.setInterval(check, 5000);

    // Re-check right away when the tab wakes up (laptop sleep, tab in the background)
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActivity));
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      // The user is signed out (or the page is leaving the app), so start fresh next time
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    };
  }, [signOut]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-80 bg-white border border-amber-300 rounded-xl shadow-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">Still there?</p>
          <p className="text-xs text-slate-600 mt-0.5">
            You will be signed out in {secondsLeft} second{secondsLeft !== 1 ? 's' : ''} because of inactivity.
          </p>
          <button
            onClick={() => { writeLastActivity(Date.now()); setSecondsLeft(null); }}
            className="mt-3 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}