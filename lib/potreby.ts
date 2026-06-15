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
  /**
   * ZDROJ PRAVDY pro relaci potreba -> data. Seznam JSON souboru z /data,
   * ktere dana potreba pouziva pri AI analyze. Route handler (analyza-potreby)
   * z toho cte kontext, takze relace zije na jednom miste (ne natvrdo
   * v handleru). Dokumentacni mapa docs/datova-mapa.md z toho vychazi.
   * U bydleni jsou data nactena dedikovanymi loadery v /api/calculate
   * a /api/scenare — uvedeno zde pro uplnost mapy.
   */
  dataZdroje: string[];
  /** Produktove kategorie (z lib/categories.ts), kterych se potreba tyka. */
  kategorieProduktu: string[];
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
    dataZdroje: [
      "banks.json",
      "cnb_rules.json",
      "instituce.json",
      "scoring_pravidla.json",
      "zivotni_situace.json",
      "produkty_pojisteni.json",
      "produkty_penze.json",
      "produkty_stavebni_sporeni.json",
      "produkty_vlajkove.json",
    ],
    kategorieProduktu: [
      "hypoteka_jina",
      "spotrebitelsky_uver",
      "zp_rizikove",
      "poj_nemovitosti",
      "poj_domacnosti",
      "poj_odpovednosti",
    ],
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
    dataZdroje: [
      "instituce.json",
      "produkty_pojisteni.json",
      "zivotni_situace.json",
      "scoring_pravidla.json",
      "produkty_vlajkove.json",
    ],
    kategorieProduktu: [
      "zp_rizikove",
      "zp_investicni",
      "zp_kapitalove",
      "urazove",
      "schopnost_splacet",
      "poj_nemovitosti",
      "poj_domacnosti",
      "poj_odpovednosti",
    ],
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
    dataZdroje: [
      "instituce.json",
      "produkty_sporeni.json",
      "produkty_penze.json",
      "produkty_stavebni_sporeni.json",
      "trzni_ocekavani.json",
      "zivotni_situace.json",
    ],
    kategorieProduktu: [
      "sporici_ucet",
      "stavebni_sporeni",
      "dps",
      "dip",
      "investice",
    ],
  },
];

export function najdiPotrebu(id: string): PotrebaDef | undefined {
  return POTREBY.find((p) => p.id === id);
}
