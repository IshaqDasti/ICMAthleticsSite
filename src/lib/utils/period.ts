// Period numbering on Game.currentQuarter:
//   1 = 1st half, 2 = 2nd half, 3+ = overtime (3 = OT, 4 = 2OT, 5 = 3OT, ...).
// Overtime is entered manually from the scorekeeper board when regulation ends tied.

export function periodLabel(quarter: number): string {
  if (quarter <= 1) return "1st Half";
  if (quarter === 2) return "2nd Half";
  const ot = quarter - 2;
  return ot === 1 ? "OT" : `${ot}OT`;
}

// Compact form for the public LIVE badge (e.g. "H1", "H2", "OT", "2OT").
export function periodLabelShort(quarter: number): string {
  if (quarter <= 2) return `H${quarter}`;
  const ot = quarter - 2;
  return ot === 1 ? "OT" : `${ot}OT`;
}
