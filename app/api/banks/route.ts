import { NextResponse } from "next/server";
import { loadBanks } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  const data = loadBanks();
  return NextResponse.json({
    banky: data.banky.map((b) => ({ id: b.id, nazev: b.nazev })),
  });
}
