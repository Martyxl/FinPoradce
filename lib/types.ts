export type TypPrijmu = "zamestnanec" | "osvc" | "jiny";
export type Ucel = "vlastni_bydleni" | "investicni";
export type TypPozadavku = "koupe" | "uver_proti_nemovitosti";
export type LimitingFactor = "LTV" | "DSTI" | "DTI" | "ZADOST";

export type ProduktKategorie =
  | "hypoteka_jina"
  | "spotrebitelsky_uver"
  | "leasing"
  | "kreditni_karta"
  | "stavebni_sporeni"
  | "dps"
  | "dip"
  | "investice"
  | "sporici_ucet"
  | "zp_rizikove"
  | "zp_investicni"
  | "zp_kapitalove"
  | "urazove"
  | "schopnost_splacet"
  | "poj_nemovitosti"
  | "poj_domacnosti"
  | "poj_odpovednosti";

export type InstituceTyp =
  | "banka_velka"
  | "banka_mensi"
  | "stavebni_sporitelna"
  | "pojistovna"
  | "penzijni_spolecnost"
  | "investicni_platforma";

export interface Instituce {
  id: string;
  nazev: string;
  typ: InstituceTyp;
}

export interface ExistingProduct {
  kategorie: ProduktKategorie;
  instituce_id?: string | null;
  nazev_produktu?: string | null;
  mesicni_castka_czk: number;
  /** Balickove produkty: napr. pojisteni nemovitosti vcetne domacnosti a odpovednosti */
  zahrnuje_kategorie?: ProduktKategorie[] | null;
  /** Aktualni zustatek / nasporena castka (u sporicich a investicnich produktu) */
  zustatek_czk?: number | null;
}

export type OsvcObor =
  | "it_programovani"
  | "marketing_poradenstvi_kreativa"
  | "advokacie_lekar_notarstvi"
  | "obecne_volne_zivnosti"
  | "remeslne_zivnosti"
  | "zemedelska_vyroba";

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
  existujici_produkty: ExistingProduct[];
  // OSVČ-specifické, volitelné
  osvc_obor?: OsvcObor | null;
  osvc_rocni_obrat_czk?: number | null;
  /** koupe (default) = porizeni nemovitosti; uver_proti_nemovitosti = navyseni / americka hypoteka proti stavajici nemovitosti */
  typ_pozadavku?: TypPozadavku | null;
  /** Zbyvajici dluh zajisteny touto nemovitosti (rezim uver_proti_nemovitosti) */
  zbyvajici_dluh_nemovitost_czk?: number | null;
  /** Kolik chce klient pujcit (rezim uver_proti_nemovitosti); prazdne = maximum do LTV */
  pozadovana_castka_czk?: number | null;
}

export interface OsvcAnalyza {
  obor: OsvcObor;
  obor_label: string;
  rocni_obrat_czk: number;
  metody: {
    nazev: "deklarovany_prijem" | "z_danoveho_zakladu_pausal" | "obratova_15_30" | "realisticky_dle_oboru";
    label: string;
    mesicni_prijem_czk: number;
    popis: string;
  }[];
  realisticky_prijem_mesicne_czk: number;
  doporuceni: string;
}

export interface FinancialHealthDimenze {
  klic: string;
  label: string;
  skore_0_100: number;
  vaha: number;
  komentar: string;
}

export interface FinancialHealthScore {
  skore_0_100: number;
  uroven: string;
  dimenze: FinancialHealthDimenze[];
  shrnuti: string;
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

export type DoporuceniKategorie =
  | "CHYBI"
  | "NEOPTIMALNI"
  | "OK"
  | "UPOZORNENI";

export interface NavrhovanaInstituce {
  id: string;
  nazev: string;
  duvod?: string;
}

export interface Doporuceni {
  id: string;
  kategorie: DoporuceniKategorie;
  priorita: number;
  nadpis: string;
  popis: string;
  proc: string[];
  doporucena_akce?: string | null;
  doporucena_castka_czk?: number | null;
  souvisejici_kategorie_produktu: string[];
  navrhovane_instituce?: NavrhovanaInstituce[];
  odhadovane_pojistne_mesicne_czk?: number | null;
  uspora_mesicne_czk?: number | null;
  uspora_popis?: string | null;
}

// ---- AI analyzator (Faze 10): 3 balicky reseni ----
export type ScenarUroven = "nejlevnejsi" | "standard" | "luxus";

export interface ScenarProdukt {
  kategorie: string;
  instituce_id: string;
  nazev: string;
  mesicni_naklad_czk: number;
  proc: string;
}

export interface Scenar {
  uroven: ScenarUroven;
  nadpis: string;
  filozofie: string;
  produkty: ScenarProdukt[];
  mesicni_naklad_celkem_czk: number;
  klady: string[];
  zapory: string[];
  vhodnost_pro_klienta: string;
}

export type ChytraStrategieTyp =
  | "equity_release"
  | "hypoteka_plus_investice"
  | "investicni_nemovitost"
  | "rychlejsi_splaceni"
  | "byznys_roi"
  | "jine";

export interface ChytraStrategie {
  typ: ChytraStrategieTyp;
  nazev: string;
  popis: string;
  cisla: string;
  rizika: string[];
  doporuceni: string;
}

export interface Scenare3 {
  scenare: Scenar[];
  chytre_strategie?: ChytraStrategie[];
  celkovy_komentar: string;
}

export interface CalculationResult {
  max_loan: number;
  max_monthly_payment: number;
  limiting_factor: string;
  per_bank: BankResult[];
  profile_echo: CustomerProfile;
  upozorneni: string[];
  doporuceni: Doporuceni[];
  osvc_analyza?: OsvcAnalyza | null;
  financni_zdravi?: FinancialHealthScore | null;
  prijem_pouzity_czk?: number;
  splatky_pouzite_czk?: number;
}
