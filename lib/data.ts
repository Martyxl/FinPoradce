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

export function loadBanks(): BanksData {
  return loadJson<BanksData>("banks.json");
}

export function loadCnbRules(): CnbRules {
  return loadJson<CnbRules>("cnb_rules.json");
}

export function loadInstituce(): InstituceData {
  return loadJson<InstituceData>("instituce.json");
}
