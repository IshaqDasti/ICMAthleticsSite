"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ScheduleRefresher({ hasLiveGames }: { hasLiveGames: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!hasLiveGames) return;
    const interval = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(interval);
  }, [hasLiveGames, router]);

  return null;
}
