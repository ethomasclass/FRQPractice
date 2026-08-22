/**
 * The clock is server-authoritative. The browser only renders what the server
 * says is left, so closing the tab, swapping devices, or editing the page does
 * not buy a student more time.
 */
export function remainingMs(args: {
  startedAt: Date | null;
  timeLimitMinutes: number;
  now?: number;
}): number | null {
  const { startedAt, timeLimitMinutes } = args;
  if (timeLimitMinutes <= 0) return null; // untimed
  if (!startedAt) return timeLimitMinutes * 60_000;
  const elapsed = (args.now ?? Date.now()) - startedAt.getTime();
  return Math.max(0, timeLimitMinutes * 60_000 - elapsed);
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
