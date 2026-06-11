import type { InstituceTyp, ProduktKategorie } from "./types";

export type SekceKategoriiId = "uvery" | "sporeni" | "pojisteni";

export interface KategoriiDef {
  id: ProduktKategorie;
  nazev: string;
  popis?: string;
  /** Typy institucí, které se nabízí v dropdownu */
  relevantni_typy: InstituceTyp[];
  /** Co znamená "měsíční částka" pro tuto kategorii */
  castka_label: string;
  /** Zobrazit volitelné pole "Aktuálně naspořeno" */
  ma_zustatek?: boolean;
}

export interface SekceDef {
  id: SekceKategoriiId;
  nazev: string;
  popis: string;
  kategorie: KategoriiDef[];
}

const BANKY: InstituceTyp[] = ["banka_velka", "banka_mensi"];
const POJ: InstituceTyp[] = ["pojistovna"];

export const SEKCE: SekceDef[] = [
  {
    id: "uvery",
    nazev: "Úvěry a závazky",
    popis: "Splátky úvěrů, leasingu a kreditních karet.",
    kategorie: [
      {
        id: "hypoteka_jina",
        nazev: "Jiná hypotéka",
        popis: "Hypotéka na jinou nemovitost, než kterou nyní řešíte.",
        relevantni_typy: BANKY,
        castka_label: "Měsíční splátka (CZK)",
      },
      {
        id: "spotrebitelsky_uver",
        nazev: "Spotřebitelský úvěr",
        relevantni_typy: BANKY,
        castka_label: "Měsíční splátka (CZK)",
      },
      {
        id: "leasing",
        nazev: "Leasing",
        relevantni_typy: BANKY,
        castka_label: "Měsíční splátka (CZK)",
      },
      {
        id: "kreditni_karta",
        nazev: "Kreditní karta",
        popis: "Pravidelná splátka kreditní karty.",
        relevantni_typy: BANKY,
        castka_label: "Měsíční splátka (CZK)",
      },
    ],
  },
  {
    id: "sporeni",
    nazev: "Spoření a investice",
    popis: "Pravidelné vklady, kterými si tvoříte rezervu nebo budoucí příjem.",
    kategorie: [
      {
        id: "stavebni_sporeni",
        nazev: "Stavební spoření",
        relevantni_typy: ["stavebni_sporitelna"],
        castka_label: "Měsíční vklad (CZK)",
        ma_zustatek: true,
      },
      {
        id: "dps",
        nazev: "Doplňkové penzijní spoření (III. pilíř)",
        relevantni_typy: ["penzijni_spolecnost"],
        castka_label: "Měsíční vlastní vklad (CZK)",
        ma_zustatek: true,
      },
      {
        id: "dip",
        nazev: "DIP (dlouhodobý investiční produkt)",
        relevantni_typy: [
          "penzijni_spolecnost",
          "banka_velka",
          "banka_mensi",
          "investicni_platforma",
        ],
        castka_label: "Měsíční vklad (CZK)",
        ma_zustatek: true,
      },
      {
        id: "investice",
        nazev: "Investice (fondy, ETF, akcie, nemovitostní platformy)",
        popis: "Portu, Investown, eToro, XTB, podílové fondy bank…",
        relevantni_typy: [...BANKY, "investicni_platforma"],
        castka_label: "Měsíční vklad (CZK)",
        ma_zustatek: true,
      },
      {
        id: "sporici_ucet",
        nazev: "Spořicí účet / termínovaný vklad",
        popis: "Pokud na něj posíláte pravidelnou částku nebo tam máte rezervu.",
        relevantni_typy: BANKY,
        castka_label: "Měsíční vklad (CZK)",
        ma_zustatek: true,
      },
    ],
  },
  {
    id: "pojisteni",
    nazev: "Pojištění",
    popis:
      "Pojistné u životního, úrazového, majetkového a odpovědnostního pojištění.",
    kategorie: [
      {
        id: "zp_rizikove",
        nazev: "Rizikové životní pojištění",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "zp_investicni",
        nazev: "Investiční životní pojištění (IŽP)",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "zp_kapitalove",
        nazev: "Kapitálové životní pojištění",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "urazove",
        nazev: "Úrazové pojištění",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "schopnost_splacet",
        nazev: "Pojištění schopnosti splácet",
        popis: "Vázané k úvěru.",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "poj_nemovitosti",
        nazev: "Pojištění nemovitosti",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "poj_domacnosti",
        nazev: "Pojištění domácnosti",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
      {
        id: "poj_odpovednosti",
        nazev: "Pojištění odpovědnosti za škodu",
        relevantni_typy: POJ,
        castka_label: "Měsíční pojistné (CZK)",
      },
    ],
  },
];

export const VSECHNY_KATEGORIE: KategoriiDef[] = SEKCE.flatMap(
  (s) => s.kategorie,
);

export function najdiKategorii(id: ProduktKategorie): KategoriiDef | undefined {
  return VSECHNY_KATEGORIE.find((k) => k.id === id);
}
