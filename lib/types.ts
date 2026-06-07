export type TypPrijmu = "zamestnanec" | "osvc" | "jiny";
export type Ucel = "vlastni_bydleni" | "investicni";
export type LimitingFactor = "LTV" | "DSTI" | "DTI" | "ZADOST";

export interface CustomerProfile {
  cisty_prijem_mesicne: number;
  typ_prijmu: TypPrijmu;
  vek: number;
  pocet_osob_domacnost: number;
  pocet_deti: number;
  stavajici_splatky_mesicne: number;
  ucel: Ucel;
  hodnota_nemovitosti: number;
  vlastni_zdroje: number;
  splatnost_roky: number;
  fixace_roky: number;
}

export interface BankResult {
  bank_id: string;
  bank_nazev: string;
  max_loan: number;
  max_monthly_payment: number;
  sazba: number;
  sazba_puvod: string;
  limiting_factor: LimitingFactor;
  is_estimate: boolean;
  ltv_pouzite: number;
  pozadovany_uver: number;
  podminky_slev: string;
  poznamky: string[];
}

export interface CalculationResult {
  max_loan: number;
  max_monthly_payment: number;
  limiting_factor: string;
  per_bank: BankResult[];
  profile_echo: CustomerProfile;
  upozorneni: string[];
}
