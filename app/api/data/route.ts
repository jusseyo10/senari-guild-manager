import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { guildState } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(guildState).where(eq(guildState.id, 1)).limit(1);
    const row = rows[0];
    if (!row) return NextResponse.json({ data: null });
    return NextResponse.json({ data: JSON.parse(row.data) });
  } catch (error) {
    console.error("Guild data read failed", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const encoded = JSON.stringify(payload);
    if (encoded.length > 2_000_000 || !isGuildData(payload)) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const db = getDb();
    await db
      .insert(guildState)
      .values({ id: 1, ownerUserId: "local", data: encoded })
      .onConflictDoUpdate({
        target: guildState.id,
        set: { data: encoded, updatedAt: new Date().toISOString() },
      });

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Guild data save failed", error);
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
}

function isGuildData(value: unknown): value is {
  members: unknown[];
  records: unknown[];
  season: { id: string; number: number; start: string; end: string };
} {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.members) || !Array.isArray(data.records)) return false;
  if (!data.season || typeof data.season !== "object") return false;
  const season = data.season as Record<string, unknown>;
  return (
    typeof season.id === "string" &&
    typeof season.number === "number" &&
    typeof season.start === "string" &&
    typeof season.end === "string"
  );
}
