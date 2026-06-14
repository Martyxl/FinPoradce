/**
 * Rozcestnik financnich potreb. Klient nezacina hypotekou — nejdriv si
 * vybere, co resi:
 *   - bydleni   -> hypotecni tok (/kalkulacka, plny BonitaCalculator)
 *   - zajisteni -> AI analyza rizik (/potreba/zajisteni)
 *   - sporeni   -> AI analyza sporeni a investic (/potreba/sporeni)
 *
 * Bydleni ma vlastni dedikovany tok; zajisteni a sporeni sdileji lehky
 * formular (RychlyAnalyza) + AI endpoint /api/analyza-potreby.
 */
export type PotrebaTyp = "bydleni" | "zajisteni" | "sporeni";

export interface PotrebaDef {
  id: PotrebaTyp;
  ikona: string;
  nazev: string;
  podnadpis: string;
  popis: string;
  /** kam vede po vyberu */
  route: string;
  /** true = AI-vedeny tok pres /potreba/[typ] */
  aiTok: boolean;
}

export const POTREBY: PotrebaDef[] = [
  {
    id: "bydleni",
    ikona: "🏠",
    nazev: "Chci bydlení",
    podnadpis: "Hypotéka · refinancování · úvěr proti nemovitosti",
    popis:
      "Spočítáme, na jakou hypotéku dosáhnete u 10 bank, porovnáme sazby a navrhneme chytré zajištění úvěru.",
    route: "/kalkulacka",
    aiTok: false,
  },
  {
    id: "zajisteni",
    ikona: "🛡️",
    nazev: "Chci zajištění",
    podnadpis: "Životní · majetkové · odpovědnost · příjem",
    popis:
      "AI projde vaše rizika a navrhne, jak ochránit příjem, rodinu a majetek — bez zbytečně drahých produktů.",
    route: "/potreba/zajisteni",
    aiTok: true,
  },
  {
    id: "sporeni",
    ikona: "📈",
    nazev: "Chci si našetřit",
    podnadpis: "Rezerva · investice · penze · cíl",
    popis:
      "AI sestaví plán, jak budovat rezervu a zhodnocovat peníze podle vašeho cíle a horizontu — s využitím státních příspěvků.",
    route: "/potreba/sporeni",
    aiTok: true,
  },
];

export function najdiPotrebu(id: string): PotrebaDef | undefined {
  return POTREBY.find((p) => p.id === id);
}
