/**
 * OSVČ analýza — modeluje 4 metody, kterými banky hodnotí příjem OSVČ.
 *
 * Klíčový problém z research dokumentu:
 *   Banky vidí pouze daňový základ (po odečtení paušálu). IT živnostník
 *   na 60% paušálu vykazuje jen 40 % obratu, ač reálné náklady jsou nízké.
 *
 * 4 metody (dle scoring_pravidla.osvc_vetev.metody_hodnoceni_bank):
 *   1. Z daňového základu (paušál × 1 - pausal_procent)
 *   2. Obratová hypotéka (15–30 % obratu, používáme 20 % jako střed)
 *   3. Interní úprava paušálu (banka snižuje paušál o pár p.b.)
 *   4. Realisticky dle oboru (obrat × (1 - koeficient_realnych_nakladu_oboru))
 *
 * Vstup pro výpočet bonity = realistický příjem (metoda 4), pokud klient
 * zadal obor a obrat. Bance ukážeme i ostatní metody jako alternativy.
 */
import type { CustomerProfile, OsvcAnalyza, OsvcObor } from "./types";
import type { ScoringPravidla } from "./data";

export function osvcKoeficient(
  obor: OsvcObor,
  scoring: ScoringPravidla,
): { koeficient_realnych_nakladu: number; pausal_dp_procent: number; label: string } | null {
  const item = scoring.osvc_obory.polozky.find((o) => o.id === obor);
  if (!item) return null;
  return {
    koeficient_realnych_nakladu: item.koeficient_realnych_nakladu,
    pausal_dp_procent: item.pausal_dp_procent,
    label: item.label,
  };
}

/**
 * Vraci OsvcAnalyza, pokud je profil OSVČ a vyplnil obor + obrat.
 * Modeluje 4 metody hodnoceni a doporuci klientovi realisticky pohled.
 */
export function osvcAnalyzaProfilu(
  profile: CustomerProfile,
  scoring: ScoringPravidla,
): OsvcAnalyza | null {
  if (profile.typ_prijmu !== "osvc") return null;
  if (!profile.osvc_obor || !profile.osvc_rocni_obrat_czk) return null;
  if (profile.osvc_rocni_obrat_czk <= 0) return null;

  const def = osvcKoeficient(profile.osvc_obor, scoring);
  if (!def) return null;

  const obrat = profile.osvc_rocni_obrat_czk;
  const pausalProcent = def.pausal_dp_procent / 100;

  // 1. Z daňového základu (paušál):
  //    daňový základ = obrat × (1 - paušál). Po dani+odvodech ~ 0.85 × základ → /12
  const danovyZaklad = obrat * (1 - pausalProcent);
  const dpMesicne = (danovyZaklad * 0.85) / 12;

  // 2. Obratová hypotéka — 20 % obratu (střed pásma 15–30 %)
  const obratovaMesicne = (obrat * 0.2) / 12;

  // 3. Interní úprava paušálu — banka snižuje paušál o 10 p.b.
  const upravenyPausal = Math.max(0, pausalProcent - 0.1);
  const upravenyZaklad = obrat * (1 - upravenyPausal);
  const upravenyMesicne = (upravenyZaklad * 0.85) / 12;

  // 4. Realisticky dle oboru — to, co reálně klientovi zbývá
  const realistickyMesicne = (obrat * (1 - def.koeficient_realnych_nakladu)) / 12;

  // Klient v formuláři zadal "cisty_prijem_mesicne" — to je deklarovaný take-home.
  // Pro bonitu použijeme MAX(deklarovaný, realistický), protože nižší by byl pesimismus
  // a deklarovaný klient zná lépe (např. zaměstnanec u jiné firmy).
  const realistickyPouzity = Math.max(profile.cisty_prijem_mesicne, realistickyMesicne);

  const metody: OsvcAnalyza["metody"] = [
    ...(profile.cisty_prijem_mesicne > 0
      ? [
          {
            nazev: "deklarovany_prijem" as const,
            label: "Váš zadaný čistý příjem",
            mesicni_prijem_czk: Math.round(profile.cisty_prijem_mesicne),
            popis:
              "Co reálně berete domů (zadali jste v 1. kroku). Banky toto akceptují, pokud doložíte výpisy z účtu / daňové přiznání.",
          },
        ]
      : []),
    {
      nazev: "z_danoveho_zakladu_pausal",
      label: `Z daňového přiznání (${def.pausal_dp_procent}% paušál)`,
      mesicni_prijem_czk: Math.round(dpMesicne),
      popis:
        "Standardní metoda, kterou akceptují všechny banky. U paušálistů často výrazně nižší než reálný příjem.",
    },
    {
      nazev: "obratova_15_30",
      label: "Obratová hypotéka (~20 % obratu)",
      mesicni_prijem_czk: Math.round(obratovaMesicne),
      popis:
        "Nabízí jen některé banky (typicky KB, ČSOB, RB). Vyžadují min. 24 měsíců podnikání bez ztráty, max ~80 % LTV.",
    },
    {
      nazev: "realisticky_dle_oboru",
      label: `Realisticky pro obor "${def.label}"`,
      mesicni_prijem_czk: Math.round(realistickyMesicne),
      popis: `Odhad reálných nákladů ${Math.round(def.koeficient_realnych_nakladu * 100)} % obratu. Tento příjem používáme pro hlavní výpočet, protože nejlépe odráží vaši situaci.`,
    },
  ];

  const nejlepsi = metody.reduce((a, b) => (b.mesicni_prijem_czk > a.mesicni_prijem_czk ? b : a));
  const nejhorsi = metody.reduce((a, b) => (b.mesicni_prijem_czk < a.mesicni_prijem_czk ? b : a));

  const doporuceni =
    nejlepsi.nazev === nejhorsi.nazev
      ? "Rozdíl mezi metodami je minimální — vaše bonita je dobře doložitelná všemi způsoby."
      : `Mezi metodami je rozdíl ${Math.round((nejlepsi.mesicni_prijem_czk - nejhorsi.mesicni_prijem_czk) / 1000)} tis. Kč/měs. Pokud vám standardní metoda (z daňového přiznání) nestačí na hypotéku, zkuste banku, která podporuje obratovou metodu nebo interní úpravu paušálu — typicky KB, ČSOB nebo Raiffeisenbank.`;

  return {
    obor: profile.osvc_obor,
    obor_label: def.label,
    rocni_obrat_czk: Math.round(obrat),
    metody,
    realisticky_prijem_mesicne_czk: Math.round(realistickyPouzity),
    doporuceni,
  };
}
