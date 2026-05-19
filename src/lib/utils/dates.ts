import { format, parseISO, isValid } from "date-fns";

export function formatGameDate(date: Date | string | null): string {
  if (!date) return "TBD";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "TBD";
  // Use UTC components to prevent timezone offset from shifting midnight-UTC dates back one day
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return format(local, "MMM d, yyyy");
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
