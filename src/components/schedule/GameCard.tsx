import Link from "next/link";
import { formatGameDate, formatGameTime, getScheduledGamePillStatus } from "@/lib/utils/dates";
import { MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

interface GameCardProps {
  game: {
    id: string;
    status: string;
    gameType: string;
    weekNumber: number | null;
    scheduledAt: Date | string | null;
    location: string | null;
    homeScore: number;
    awayScore: number;
    isLive: boolean;
    notes: string | null;
    homeTeam: Team;
    awayTeam: Team;
  };
  isUpcomingWeek?: boolean;
}

export function GameCard({ game, isUpcomingWeek = true }: GameCardProps) {
  const isCompleted = game.status === "COMPLETED";
  const isInProgress = game.status === "IN_PROGRESS";
  const isScheduled = game.status === "SCHEDULED";
  const scheduledPillStatus =
    isScheduled && isUpcomingWeek
      ? getScheduledGamePillStatus(game.scheduledAt)
      : null;

  return (
    <Link href={`/games/${game.id}`} className="block">
      <div className="rounded-lg border bg-card hover:bg-muted/30 transition-colors p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {game.weekNumber && (
              <span className="text-xs text-muted-foreground">
                Week {game.weekNumber}
              </span>
            )}
            {game.gameType !== "REGULAR_SEASON" && (
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {game.gameType.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {game.isLive && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
                LIVE
              </span>
            )}
            {(isCompleted || scheduledPillStatus) && (
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  isCompleted
                    ? "bg-muted text-muted-foreground"
                    : scheduledPillStatus === "active"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                {isCompleted
                  ? "Final"
                  : scheduledPillStatus === "active"
                  ? "Active"
                  : "Upcoming"}
              </span>
            )}
            {!isCompleted && !scheduledPillStatus && !isScheduled && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                {game.status}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold truncate">{game.homeTeam.name}</p>
            <p className="text-sm text-muted-foreground truncate">{game.awayTeam.name}</p>
          </div>
          {isCompleted || isInProgress || game.isLive ? (
            <div className="text-right">
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  isCompleted && game.homeScore > game.awayScore && "text-green-600 dark:text-green-400"
                )}
              >
                {game.homeScore}
              </p>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  isCompleted && game.awayScore > game.homeScore && "text-green-600 dark:text-green-400"
                )}
              >
                {game.awayScore}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xl font-bold text-muted-foreground">TBD</p>
            </div>
          )}
        </div>

        {(game.scheduledAt || game.location) && (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatGameDate(game.scheduledAt)}</span>
            {!isCompleted && !game.isLive && game.scheduledAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatGameTime(game.scheduledAt)}
              </span>
            )}
            {game.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {game.location}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
