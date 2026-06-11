/**
 * Loadery pro JSON datovou vrstvu. Cteni se deje pres Node fs API
 * na strane serveru (Route Handler). Soubory jsou v /data v gitu.
 *
 * Pri pozdejsim prechodu na PostgreSQL staci nahradit telo techto funkci,
 * BonitaCalculator a RecommendationEngine zustanou beze zmeny.
 */
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

function loadJson<T = unknown>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export interface BanksData {
  banky: BankData[];
  trzni_prumery?: Record<string, unknown>;
}

export interface BankData {
  id: string;
  nazev: string;
  sazby: BankSazba[];
  ltv_max: number;
  ltv_prirazka_nad_80?: number;
  interni_dsti_limit: number;
  interni_dti_limit: number;
  slevy_podminky?: string;
  puvod_interni_limity?: string;
}

export interface BankSazba {
  fixace_roky: number;
  ltv_do: number;
  sazba: number;
  puvod: string;
}

export interface CnbRules {
  ltv: {
    vlastni_bydleni: { max: number; max_do_36_let: number };
    investicni_nemovitost: { max: number };
  };
}

export interface InstituceItem {
  id: string;
  nazev: string;
  typ?: string;
}

export interface InstituceData {
  banky_velke_univerzalni?: InstituceItem[];
  banky_mensi_specializovane?: InstituceItem[];
  stavebni_sporitelny?: InstituceItem[];
  pojistovny?: InstituceItem[];
  penzijni_spolecnosti?: InstituceItem[];
}

export interface ScoringPravidla {
  pomerove_ukazatele: Record<string, unknown>;
  skore_navrh: {
    rozsah: string;
    vahy: Record<string, number>;
    urovne: { od_skore: number; label: string }[];
  };
  pojistne_koeficienty: {
    rocni_pojistne_z_pojistne_castky_base: number;
    vek_nasobky: { vek_do: number; nasobek: number }[];
    obor_pojisteni_nemovitosti: { rocni_pojistne_z_pojistne_castky: number };
    pojisteni_domacnosti: {
      rocni_pojistne_z_pojistne_castky: number;
      typicka_pojistna_castka_czk: [number, number];
    };
    pojisteni_odpovednosti: {
      rocni_pojistne_dle_limitu: { limit_czk: number; rocni_pojistne_czk: number }[];
    };
    urazove_pojisteni: {
      mesicni_pojistne_orientacni_dospely_czk: number;
      mesicni_pojistne_orientacni_dite_czk: number;
    };
    pojisteni_dlouhodobe_pece: {
      mesicni_pojistne_base_40let_czk: number;
      vek_nasobky: { vek_do: number; nasobek: number }[];
    };
    izp_poplatkovost: {
      investicni_slozka_podil_pojistneho: [number, number];
      typicke_rocni_naklady_fondu_procent: number;
      pocatecni_naklady_prvni_2_roky_podil: number;
      uspora_pri_rozdeleni_rzp_plus_dip_procent: [number, number];
    };
  };
  osvc_obory: {
    polozky: {
      id: string;
      label: string;
      koeficient_realnych_nakladu: number;
      pausal_dp_procent: number;
    }[];
  };
  osvc_vetev: {
    metody_hodnoceni_bank: Array<{ id: string; nazev: string; popis: string }>;
  };
}

export function loadBanks(): BanksData {
  return loadJson<BanksData>("banks.json");
}

export function loadCnbRules(): CnbRules {
  return loadJson<CnbRules>("cnb_rules.json");
}

export function loadInstituce(): InstituceData {
  return loadJson<InstituceData>("instituce.json");
}

export function loadScoringPravidla(): ScoringPravidla {
  return loadJson<ScoringPravidla>("scoring_pravidla.json");
}
