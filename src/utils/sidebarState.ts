import { useSyncExternalStore } from 'react';

const KEY = 'sidebarCollapsed';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

let collapsed = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleSidebarCollapsed() {
  collapsed = !collapsed;
  try {
    localStorage.setItem(KEY, String(collapsed));
  } catch {
    /* ignore */
  }
  listeners.forEach(l => l());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, () => collapsed, () => false);
}