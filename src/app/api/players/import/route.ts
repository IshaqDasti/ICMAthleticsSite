export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { prisma } from "@/lib/db/client";
import { slugify } from "@/lib/utils/slugify";
import Papa from "papaparse";

export const POST = withAuth(async (req) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const seasonId = formData.get("seasonId") as string;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const text = await file.text();
  const { data } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const results = { created: 0, skipped: 0, errors: [] as string[] };

  for (const row of data) {
    try {
      const firstName = (row["Attendee First Name"] ?? row["First Name"] ?? "").trim();
      const lastName = (row["Attendee Last Name"] ?? row["Last Name"] ?? "").trim();
      const teamName = (row["Team Name Spring 26"] ?? row["Team"] ?? "").trim();
      const displayName = (row["Name on Jersey"] ?? firstName).trim();
      const jerseyNumber = row["Jersey Number"]?.trim() || null;
      const email = (row["Attendee Email"] ?? "").trim() || null;
      const instagramHandle = (row["Instagram Handle"] ?? "").trim().replace("@", "") || null;

      if (!firstName || !lastName) { results.skipped++; continue; }

      const team = teamName
        ? await prisma.team.findFirst({ where: { name: { equals: teamName, mode: "insensitive" } } })
        : null;

      const baseSlug = slugify(`${firstName}-${lastName}`);
      let slug = baseSlug;
      let attempt = 0;
      while (await prisma.player.findUnique({ where: { slug } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      await prisma.player.create({
        data: {
          firstName,
          lastName,
          displayName: displayName || firstName,
          slug,
          jerseyNumber,
          teamId: team?.id ?? null,
          email,
          instagramHandle,
        },
      });

      if (team && seasonId) {
        await prisma.teamSeason.upsert({
          where: { teamId_seasonId: { teamId: team.id, seasonId } },
          create: { teamId: team.id, seasonId },
          update: {},
        });
      }

      results.created++;
    } catch (e: unknown) {
      results.errors.push(String(e));
    }
  }

  return NextResponse.json(results);
}, "SUPER_ADMIN");
