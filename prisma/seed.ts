import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, "-").replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}

// Summer 2026 schedule extracted from DOCX
const SCHEDULE: Array<{
  week: number;
  date: string;  // ISO date string
  time: string;  // e.g. "7:00 PM"
  home: string;
  away: string;
  gameType?: string;
  notes?: string;
}> = [
  // Week 1 — May 18, 2026
  { week: 1, date: "2026-05-18", time: "19:00", home: "Wednesday Hoops", away: "The Halal Buoys" },
  { week: 1, date: "2026-05-18", time: "20:00", home: "Al-Rijaal", away: "Lowkey Hoopers" },
  { week: 1, date: "2026-05-18", time: "21:00", home: "ICM United", away: "Redeem Team" },
  { week: 1, date: "2026-05-18", time: "22:00", home: "The Wire", away: "Gathering of Old Men" },
  // Week 2 — June 1, 2026
  { week: 2, date: "2026-06-01", time: "19:00", home: "Redeem Team", away: "Green Bean" },
  { week: 2, date: "2026-06-01", time: "20:00", home: "Five Pillars", away: "Wednesday Hoops" },
  { week: 2, date: "2026-06-01", time: "21:00", home: "Gathering of Old Men", away: "ICM United" },
  { week: 2, date: "2026-06-01", time: "22:00", home: "Lowkey Hoopers", away: "The Halal Buoys" },
  // Week 3 — June 8, 2026
  { week: 3, date: "2026-06-08", time: "19:00", home: "Five Pillars", away: "Gathering of Old Men" },
  { week: 3, date: "2026-06-08", time: "20:00", home: "Redeem Team", away: "The Wire" },
  { week: 3, date: "2026-06-08", time: "21:00", home: "Wednesday Hoops", away: "Lowkey Hoopers" },
  { week: 3, date: "2026-06-08", time: "22:00", home: "Green Bean", away: "Al-Rijaal" },
  // Week 4 — June 15, 2026
  { week: 4, date: "2026-06-15", time: "19:00", home: "Redeem Team", away: "Wednesday Hoops" },
  { week: 4, date: "2026-06-15", time: "20:00", home: "ICM United", away: "The Halal Buoys" },
  { week: 4, date: "2026-06-15", time: "21:00", home: "The Wire", away: "Green Bean" },
  { week: 4, date: "2026-06-15", time: "22:00", home: "Al-Rijaal", away: "Gathering of Old Men" },
  // Week 5 — June 22, 2026
  { week: 5, date: "2026-06-22", time: "19:00", home: "Al-Rijaal", away: "ICM United" },
  { week: 5, date: "2026-06-22", time: "20:00", home: "Green Bean", away: "Lowkey Hoopers" },
  { week: 5, date: "2026-06-22", time: "21:00", home: "The Wire", away: "The Halal Buoys" },
  { week: 5, date: "2026-06-22", time: "22:00", home: "Redeem Team", away: "Five Pillars" },
  // Week 6 — June 29, 2026
  { week: 6, date: "2026-06-29", time: "19:00", home: "Lowkey Hoopers", away: "The Wire" },
  { week: 6, date: "2026-06-29", time: "20:00", home: "Gathering of Old Men", away: "Redeem Team" },
  { week: 6, date: "2026-06-29", time: "21:00", home: "Five Pillars", away: "Al-Rijaal" },
  { week: 6, date: "2026-06-29", time: "22:00", home: "Wednesday Hoops", away: "Green Bean" },
  // Week 7 — July 6, 2026
  { week: 7, date: "2026-07-06", time: "19:00", home: "Gathering of Old Men", away: "Wednesday Hoops" },
  { week: 7, date: "2026-07-06", time: "20:00", home: "Al-Rijaal", away: "The Wire" },
  { week: 7, date: "2026-07-06", time: "21:00", home: "The Halal Buoys", away: "Green Bean" },
  { week: 7, date: "2026-07-06", time: "22:00", home: "ICM United", away: "Five Pillars" },
  // Week 8 — July 13, 2026
  { week: 8, date: "2026-07-13", time: "19:00", home: "ICM United", away: "Lowkey Hoopers" },
  { week: 8, date: "2026-07-13", time: "20:00", home: "The Halal Buoys", away: "Five Pillars" },
  { week: 8, date: "2026-07-13", time: "21:00", home: "Al-Rijaal", away: "Redeem Team" },
  { week: 8, date: "2026-07-13", time: "22:00", home: "Wednesday Hoops", away: "The Wire" },
  // Week 9 — July 20, 2026
  { week: 9, date: "2026-07-20", time: "19:00", home: "Lowkey Hoopers", away: "Five Pillars" },
  { week: 9, date: "2026-07-20", time: "20:00", home: "Gathering of Old Men", away: "The Halal Buoys" },
  { week: 9, date: "2026-07-20", time: "21:00", home: "Al-Rijaal", away: "Wednesday Hoops" },
  { week: 9, date: "2026-07-20", time: "22:00", home: "Green Bean", away: "ICM United" },
  // Week 10 — July 27, 2026
  { week: 10, date: "2026-07-27", time: "19:00", home: "ICM United", away: "The Wire" },
  { week: 10, date: "2026-07-27", time: "20:00", home: "Five Pillars", away: "Green Bean" },
  { week: 10, date: "2026-07-27", time: "21:00", home: "Lowkey Hoopers", away: "Gathering of Old Men" },
  { week: 10, date: "2026-07-27", time: "22:00", home: "The Halal Buoys", away: "Redeem Team" },
  // Week 11 — Aug 3, 2026
  { week: 11, date: "2026-08-03", time: "19:00", home: "The Halal Buoys", away: "Al-Rijaal" },
  { week: 11, date: "2026-08-03", time: "20:00", home: "Wednesday Hoops", away: "ICM United" },
  { week: 11, date: "2026-08-03", time: "21:00", home: "The Wire", away: "Five Pillars" },
  { week: 11, date: "2026-08-03", time: "22:00", home: "Redeem Team", away: "Lowkey Hoopers" },
  // Week 12 — Aug 10, 2026 (regular season finale + All-Star)
  { week: 12, date: "2026-08-10", time: "19:00", home: "Green Bean", away: "Gathering of Old Men" },
  { week: 12, date: "2026-08-10", time: "20:30", home: "TBD", away: "TBD", gameType: "ALLSTAR", notes: "All-Star Game" },
  // Playoffs
  { week: 13, date: "2026-08-17", time: "19:00", home: "TBD", away: "TBD", gameType: "QUARTERFINAL", notes: "Seed #1 vs #8" },
  { week: 13, date: "2026-08-17", time: "20:00", home: "TBD", away: "TBD", gameType: "QUARTERFINAL", notes: "Seed #4 vs #5" },
  { week: 13, date: "2026-08-17", time: "21:00", home: "TBD", away: "TBD", gameType: "QUARTERFINAL", notes: "Seed #3 vs #6" },
  { week: 13, date: "2026-08-17", time: "22:00", home: "TBD", away: "TBD", gameType: "QUARTERFINAL", notes: "Seed #2 vs #7" },
  { week: 14, date: "2026-08-24", time: "19:00", home: "TBD", away: "TBD", gameType: "SEMIFINAL", notes: "Winner (#1/#8) vs Winner (#4/#5)" },
  { week: 14, date: "2026-08-24", time: "20:00", home: "TBD", away: "TBD", gameType: "SEMIFINAL", notes: "Winner (#2/#7) vs Winner (#3/#6)" },
  { week: 15, date: "2026-08-31", time: "20:30", home: "TBD", away: "TBD", gameType: "FINAL", notes: "Championship" },
];

const TEAMS = [
  "Al-Rijaal", "Five Pillars", "Gathering of Old Men", "Green Bean",
  "ICM United", "Lowkey Hoopers", "Redeem Team", "The Halal Buoys",
  "The Wire", "Wednesday Hoops",
];

async function main() {
  console.log("🌱 Seeding ICM Athletics Summer 2026...");

  // 1. Create Season
  const season = await prisma.season.upsert({
    where: { slug: "summer-2026" },
    update: {},
    create: {
      name: "Summer 2026",
      slug: "summer-2026",
      status: "ACTIVE",
      startDate: new Date("2026-05-18"),
      endDate: new Date("2026-08-31"),
    },
  });
  console.log(`✅ Season: ${season.name}`);

  // 2. Create Teams
  const teamMap = new Map<string, string>(); // name -> id
  for (const name of TEAMS) {
    const slug = slugify(name);
    const team = await prisma.team.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    await prisma.teamSeason.upsert({
      where: { teamId_seasonId: { teamId: team.id, seasonId: season.id } },
      update: {},
      create: { teamId: team.id, seasonId: season.id },
    });
    teamMap.set(name.toLowerCase(), team.id);
  }
  console.log(`✅ ${TEAMS.length} teams created`);

  // 3. Import Players from CSV
  const csvPath = path.join(__dirname, "../2026 mens summer league final roster.csv");
  if (fs.existsSync(csvPath)) {
    const csvText = fs.readFileSync(csvPath, "utf-8");
    const { data } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    let playerCount = 0;
    for (const row of data) {
      const firstName = (row["Attendee First Name"] ?? "").trim();
      const lastName = (row["Attendee Last Name"] ?? "").trim();
      const teamName = (row["Team Name Spring 26"] ?? "").trim();
      const displayName = (row["Name on Jersey"] ?? firstName).trim();
      const jerseyNumber = row["Jersey Number"] ? parseInt(row["Jersey Number"]) : null;
      const email = (row["Attendee Email"] ?? "").trim() || null;
      const instagramHandle = (row["Instagram Handle"] ?? "").trim().replace("@", "") || null;
      const dobStr = (row["DOB"] ?? "").trim();

      if (!firstName || !lastName) continue;

      const teamId = teamMap.get(teamName.toLowerCase()) ?? null;
      const baseSlug = slugify(`${firstName}-${lastName}`);
      let slug = baseSlug;
      let attempt = 0;
      while (await prisma.player.findUnique({ where: { slug } })) {
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      await prisma.player.create({
        data: {
          firstName, lastName,
          displayName: displayName || firstName,
          slug,
          jerseyNumber: isNaN(jerseyNumber!) ? null : jerseyNumber,
          teamId,
          email,
          instagramHandle,
          dateOfBirth: dobStr ? new Date(dobStr) : null,
        },
      });
      playerCount++;
    }
    console.log(`✅ ${playerCount} players imported from CSV`);
  } else {
    console.log("⚠️  Roster CSV not found at expected path, skipping players");
    console.log(`   Expected: ${csvPath}`);
  }

  // 4. Create Games
  let gameCount = 0;
  const TBD_TEAMS = ["TBD", "tbd"];

  for (const g of SCHEDULE) {
    const homeId = teamMap.get(g.home.toLowerCase());
    const awayId = teamMap.get(g.away.toLowerCase());

    if (!homeId && !TBD_TEAMS.includes(g.home)) {
      console.warn(`⚠️  Team not found: ${g.home}`);
      continue;
    }
    if (!awayId && !TBD_TEAMS.includes(g.away)) {
      console.warn(`⚠️  Team not found: ${g.away}`);
      continue;
    }

    // Skip TBD playoff games — they'll be updated when seeds are determined
    if (TBD_TEAMS.includes(g.home) || TBD_TEAMS.includes(g.away)) {
      console.log(`  ⏭ Skipping TBD game: ${g.notes ?? g.gameType}`);
      continue;
    }

    const scheduledAt = new Date(`${g.date}T${g.time.padStart(5, "0")}:00.000-04:00`);

    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: homeId!,
        awayTeamId: awayId!,
        weekNumber: g.week,
        gameNumber: gameCount + 1,
        gameType: (g.gameType as any) ?? "REGULAR_SEASON",
        scheduledAt,
        location: "ICM Athletics Court",
        notes: g.notes ?? null,
      },
    });
    gameCount++;
  }
  console.log(`✅ ${gameCount} games created`);

  console.log("\n🎉 Seed complete! Run 'npm run db:studio' to inspect the data.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
