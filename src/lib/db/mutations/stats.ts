import { prisma } from "@/lib/db/client";
import { EventType } from "@prisma/client";

interface ApplyEventInput {
  gameId: string;
  eventType: EventType;
  playerId: string;
  teamId: string;
  isHome: boolean;
  quarter: number;
  value?: number;
  createdBy?: string;
}

export async function applyGameEvent(input: ApplyEventInput) {
  const { gameId, eventType, playerId, teamId, isHome, quarter, value = 1, createdBy } = input;

  const lastEvent = await prisma.gameEvent.findFirst({
    where: { gameId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });

  const sequence = (lastEvent?.sequence ?? 0) + 1;
  const isPoint = eventType === "POINT";
  const isRebound = eventType === "REBOUND";
  const isAssist = eventType === "ASSIST";

  const scoreField = isHome ? "homeScore" : "awayScore";

  return prisma.$transaction([
    prisma.gameEvent.create({
      data: { gameId, eventType, playerId, teamId, value, quarter, sequence, createdBy },
    }),
    prisma.playerGameStats.upsert({
      where: { gameId_playerId: { gameId, playerId } },
      create: {
        gameId,
        playerId,
        teamId,
        points: isPoint ? value : 0,
        rebounds: isRebound ? value : 0,
        assists: isAssist ? value : 0,
        gamePlayed: true,
      },
      update: {
        points: isPoint ? { increment: value } : undefined,
        rebounds: isRebound ? { increment: value } : undefined,
        assists: isAssist ? { increment: value } : undefined,
        gamePlayed: true,
      },
    }),
    prisma.teamGameStats.upsert({
      where: { gameId_teamId: { gameId, teamId } },
      create: { gameId, teamId, isHome, score: isPoint ? value : 0 },
      update: { score: isPoint ? { increment: value } : undefined },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { [scoreField]: isPoint ? { increment: value } : undefined },
    }),
  ]);
}

export async function undoGameEvent(eventId: string) {
  const event = await prisma.gameEvent.findUnique({
    where: { id: eventId },
    include: { game: { select: { homeTeamId: true } } },
  });

  if (!event || event.undone) throw new Error("Event not found or already undone");

  const isHome = event.teamId === event.game.homeTeamId;
  const scoreField = isHome ? "homeScore" : "awayScore";
  const isPoint = event.eventType === "POINT";
  const isRebound = event.eventType === "REBOUND";
  const isAssist = event.eventType === "ASSIST";

  return prisma.$transaction([
    prisma.gameEvent.update({
      where: { id: eventId },
      data: { undone: true, undoneAt: new Date() },
    }),
    ...(event.playerId
      ? [
          prisma.playerGameStats.update({
            where: { gameId_playerId: { gameId: event.gameId, playerId: event.playerId } },
            data: {
              points: isPoint ? { decrement: event.value } : undefined,
              rebounds: isRebound ? { decrement: event.value } : undefined,
              assists: isAssist ? { decrement: event.value } : undefined,
            },
          }),
        ]
      : []),
    ...(event.teamId && isPoint
      ? [
          prisma.teamGameStats.update({
            where: { gameId_teamId: { gameId: event.gameId, teamId: event.teamId } },
            data: { score: { decrement: event.value } },
          }),
          prisma.game.update({
            where: { id: event.gameId },
            data: { [scoreField]: { decrement: event.value } },
          }),
        ]
      : []),
  ]);
}
