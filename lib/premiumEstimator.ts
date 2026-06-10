/**
 * Orientacni odhady mesicniho pojistneho.
 *
 * UPOZORNENI: hodnoty jsou ESTIMATE - tabulkove koeficienty pro
 * informativni ucely. Realne pojistne se urcuje individualne podle
 * vstupniho dotazniku pojistovny (zdravotni stav, profese, koureni atd.).
 */
import type { ScoringPravidla } from "./data";

export class PremiumEstimator {
  constructor(private scoring: ScoringPravidla) {}

  private vekNasobek(vek: number): number {
    const tabulka = this.scoring.pojistne_koeficienty.vek_nasobky;
    for (const r of tabulka) {
      if (vek <= r.vek_do) return r.nasobek;
    }
    return tabulka[tabulka.length - 1]?.nasobek ?? 1.0;
  }

  /** RZP s klesajici pojistnou castkou (typicke pro hypoteku) — mesicne v CZK */
  rzpKlesajiciMesicne(vek: number, pojistnaCastka: number): number {
    if (pojistnaCastka <= 0) return 0;
    const base = this.scoring.pojistne_koeficienty.rocni_pojistne_z_pojistne_castky_base;
    const mult = this.vekNasobek(vek);
    // RZP s klesajici castkou je v prumeru cca 70 % ceny RZP s konstantni castkou
    const rocni = pojistnaCastka * base * mult * 0.7;
    return Math.round(rocni / 12);
  }

  /** RZP s konstantni pojistnou castkou — pro porovnani */
  rzpKonstantniMesicne(vek: number, pojistnaCastka: number): number {
    if (pojistnaCastka <= 0) return 0;
    const base = this.scoring.pojistne_koeficienty.rocni_pojistne_z_pojistne_castky_base;
    const mult = this.vekNasobek(vek);
    return Math.round((pojistnaCastka * base * mult) / 12);
  }

  /** Pojisteni nemovitosti — orientacne 0,1 % rocne z hodnoty nemovitosti */
  pojisteniNemovitostiMesicne(hodnotaNemovitosti: number): number {
    if (hodnotaNemovitosti <= 0) return 0;
    const koef =
      this.scoring.pojistne_koeficienty.obor_pojisteni_nemovitosti
        .rocni_pojistne_z_pojistne_castky;
    return Math.round((hodnotaNemovitosti * koef) / 12);
  }

  /**
   * Bankovni pojisteni schopnosti splacet — orientacni odhad.
   * Typicky 0,07-0,12 % z mesicni splatky za kazdych 100 000 Kc PC.
   * Pouzivame stredni hodnotu 0,09 % per 100 000.
   */
  schopnostSplacetMesicne(pojistnaCastka: number): number {
    if (pojistnaCastka <= 0) return 0;
    return Math.round((pojistnaCastka / 100000) * 90);
  }
}
