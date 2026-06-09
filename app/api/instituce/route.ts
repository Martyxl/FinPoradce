import { NextResponse } from "next/server";
import { loadInstituce, type InstituceItem } from "@/lib/data";

export const runtime = "nodejs";

interface FlatItem {
  id: string;
  nazev: string;
  typ: string;
}

export async function GET() {
  try {
    const data = loadInstituce();
    const flat: FlatItem[] = [];

    const skupiny: Array<[
      keyof typeof data,
      string,
    ]> = [
      ["banky_velke_univerzalni", "banka_velka"],
      ["banky_mensi_specializovane", "banka_mensi"],
      ["stavebni_sporitelny", "stavebni_sporitelna"],
      ["pojistovny", "pojistovna"],
      ["penzijni_spolecnosti", "penzijni_spolecnost"],
    ];

    for (const [klic, defaultTyp] of skupiny) {
      const items = (data[klic] as InstituceItem[] | undefined) ?? [];
      for (const inst of items) {
        flat.push({
          id: inst.id,
          nazev: inst.nazev,
          typ: inst.typ ?? defaultTyp,
        });
      }
    }

    return NextResponse.json({ instituce: flat });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interní chyba";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
