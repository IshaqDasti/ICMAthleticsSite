import { cn } from "@/lib/utils";

interface Props {
  isLive: boolean;
  quarter?: number;
}

export function LiveScoreBadge({ isLive, quarter }: Props) {
  if (!isLive) return null;

  return (
    <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
      <span className="live-dot w-1.5 h-1.5 rounded-full bg-white" />
      LIVE {quarter ? `· Q${quarter}` : ""}
    </div>
  );
}
