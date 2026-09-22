/**
 * Remembers which roles this browser has already applied for.
 *
 * WHAT THIS CAN AND CANNOT KNOW. Applications are submitted on a Google Form we
 * do not own and cannot read, so the only event available here is "this person
 * opened the form". That is what gets recorded. It is a reminder to the reader
 * of what they have already done, not a record of who applied — the real list
 * of applicants is in the form's responses, and nothing here should be treated
 * as authoritative about it.
 *
 * Kept in localStorage rather than on the server for the same reason: there is
 * no account on this page to attach it to, and asking a stranger to identify
 * themselves before they can see a button would be a worse trade than a note
 * that lives in their own browser.
 */

const KEY = 'spllit.careers.applied';

/** Same-tab writes do not fire `storage`, so subscribers are notified by hand. */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeApplied(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab applying should update this one too.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The raw stored string, not a parsed array.
 *
 * useSyncExternalStore compares snapshots by identity, and a fresh array every
 * call would re-render forever. A string compares by value, so this is stable
 * as long as nothing has actually changed.
 */
export function getAppliedSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    // Private mode, or storage disabled. Nothing is remembered; the page still
    // works, it just always offers to apply.
    return '';
  }
}

/** The server has no browser storage, so it renders the un-applied state. */
export function getAppliedServerSnapshot(): string {
  return '';
}

export function parseApplied(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function markApplied(roleId: string): void {
  try {
    const ids = parseApplied(getAppliedSnapshot());
    if (ids.includes(roleId)) return;
    localStorage.setItem(KEY, JSON.stringify([...ids, roleId]));
  } catch {
    // Storage refused the write. The click still opens the form — only the
    // memory of it is lost, which is the part that can afford to fail.
  }
  emit();
}

export function clearApplied(roleId: string): void {
  try {
    const ids = parseApplied(getAppliedSnapshot()).filter((id) => id !== roleId);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* see markApplied */
  }
  emit();
}
