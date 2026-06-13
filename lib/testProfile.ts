import type { CustomerProfile, ExistingProduct } from "./types";

/** Tovarna na testovaci profil — prepis jen to, co test potrebuje. */
export function makeProfile(
  over: Partial<CustomerProfile> = {},
): CustomerProfile {
  return {
    cisty_prijem_mesicne: 45000,
    typ_prijmu: "zamestnanec",
    vek: 30,
    pocet_osob_domacnost: 2,
    pocet_deti: 0,
    stavajici_splatky_mesicne: 0,
    ucel: "vlastni_bydleni",
    hodnota_nemovitosti: 4000000,
    vlastni_zdroje: 800000,
    splatnost_roky: 25,
    fixace_roky: 5,
    existujici_produkty: [],
    osvc_obor: null,
    osvc_rocni_obrat_czk: null,
    typ_pozadavku: "koupe",
    zbyvajici_dluh_nemovitost_czk: null,
    pozadovana_castka_czk: null,
    ...over,
  };
}

export function produkt(over: Partial<ExistingProduct> = {}): ExistingProduct {
  return {
    kategorie: "spotrebitelsky_uver",
    instituce_id: null,
    nazev_produktu: null,
    mesicni_castka_czk: 1000,
    zahrnuje_kategorie: null,
    zustatek_czk: null,
    ...over,
  };
}
