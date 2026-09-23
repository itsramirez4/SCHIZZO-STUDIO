/**
 * A small ring buffer of what went wrong recently, for the feedback dialog — so a tester's report
 * carries the actual error instead of "no sé, se rompió algo". Purely in-memory (cleared on
 * restart) and local: nothing here is sent anywhere on its own, it's just assembled into the text
 * the person chooses to copy, save or email.
 */
export interface DiagnosticEntry {
  time: string;
  /** Which ErrorBoundary caught it ("Capas", "Filtros"...), or "window" for an uncaught error. */
  source: string;
  message: string;
}

const MAX_ENTRIES = 30;
const entries: DiagnosticEntry[] = [];

export function recordError(source: string, message: string) {
  entries.push({ time: new Date().toISOString(), source, message: message.slice(0, 500) });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getRecentErrors(): DiagnosticEntry[] {
  return [...entries];
}

let installed = false;

/** Catches errors an ErrorBoundary never sees (outside React's render, or before one mounts). */
export function installGlobalErrorCapture() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => recordError('window', e.message));
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    recordError('promise', reason instanceof Error ? reason.message : String(reason));
  });
}
