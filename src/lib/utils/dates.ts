import { parseISO, isValid } from "date-fns";

const etDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

export function formatGameDate(date: Date | string | null): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "TBD";
  return etDateFormatter.format(d);
}

const edtTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
  hour12: true,
});

export function formatGameTime(date: Date | string | null): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "TBD";
  return edtTimeFormatter.format(d);
}

export function formatGameDateTime(date: Date | string | null): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "TBD";
  return `${formatGameDate(date)} · ${edtTimeFormatter.format(d)}`;
}

// Eastern offset (in ms) at a given instant: (ET wall clock − UTC). EDT = −4h, EST = −5h.
function etOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = parseInt(part.value, 10);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUTC - instant.getTime();
}

/**
 * Convert a bare wall-clock value from an <input type="datetime-local">
 * (e.g. "2026-08-20T19:30", no offset) into the correct absolute UTC Date,
 * interpreting it as Eastern (the venue time zone) — NOT the server's UTC.
 * Values that already carry a Z/offset are trusted as-is.
 */
export function etDateTimeLocalToUTC(local: string): Date | null {
  if (!local) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(local)) {
    const d = new Date(local);
    return isValid(d) ? d : null;
  }
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const naive = new Date(`${withSeconds}Z`);
  if (!isValid(naive)) return null;
  // Evaluate the offset at the wall time (fine for evening game times, which never
  // straddle the 2 AM DST boundary), then shift to the true UTC instant.
  return new Date(naive.getTime() - etOffsetMs(naive));
}

/**
 * Format an absolute Date as an Eastern wall-clock "YYYY-MM-DDTHH:mm" string
 * suitable for pre-filling an <input type="datetime-local">.
 */
export function utcToEtDateTimeLocal(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

export function isUpcoming(date: Date | string | null): boolean {
  if (!date) return true;
  const d = typeof date === "string" ? parseISO(date) : date;
  return d > new Date();
}

export function getScheduledGamePillStatus(
  scheduledAt: Date | string | null
): "upcoming" | "active" | null {
  if (!scheduledAt) return "upcoming";
  const d = typeof scheduledAt === "string" ? parseISO(scheduledAt) : scheduledAt;
  if (!isValid(d)) return "upcoming";
  const now = new Date();
  if (now < d) return "upcoming";
  if (now.getTime() - d.getTime() < 60 * 60 * 1000) return "active";
  return null;
}
