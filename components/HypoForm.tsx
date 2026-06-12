"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomerProfile,
  ExistingProduct,
  Instituce,
  OsvcObor,
  ProduktKategorie,
  TypPozadavku,
  TypPrijmu,
  Ucel,
} from "@/lib/types";
import { fetchInstituce, vypocitej } from "@/lib/api";
import { SEKCE, VSECHNY_KATEGORIE, type KategoriiDef } from "@/lib/categories";

const OSVC_OBORY: { id: OsvcObor; label: string }[] = [
  { id: "it_programovani", label: "IT, programování, datová analytika" },
  { id: "marketing_poradenstvi_kreativa", label: "Marketing, poradenství, kreativa" },
  { id: "advokacie_lekar_notarstvi", label: "Advokacie, lékaři, notáři, znalci" },
  { id: "obecne_volne_zivnosti", label: "Ostatní volné živnosti (služby)" },
  { id: "remeslne_zivnosti", label: "Řemeslné živnosti" },
  { id: "zemedelska_vyroba", label: "Zemědělství, lesnictví" },
];

type FormState = {
  // Krok 1
  cisty_prijem_mesicne: string;
  typ_prijmu: TypPrijmu;
  vek: string;
  osvc_obor: OsvcObor | "";
  osvc_rocni_obrat_czk: string;
  // Krok 2
  pocet_osob_domacnost: string;
  pocet_deti: string;
  // Krok 4 (Nemovitost)
  typ_pozadavku: TypPozadavku;
  ucel: Ucel;
  hodnota_nemovitosti: string;
  vlastni_zdroje: string;
  zbyvajici_dluh: string;
  pozadovana_castka: string;
  // Krok 5 (Úvěr)
  splatnost_roky: string;
  fixace_roky: string;
};

type Frekvence = "mesicne" | "rocne";

type ProduktStav = {
  aktivni: boolean;
  instituce_id: string;
  nazev_produktu: string;
  mesicni_castka: string;
  frekvence: Frekvence;
  // Jen pro sporici/investicni kategorie (ma_zustatek)
  zustatek: string;
  // Jen pro poj_nemovitosti — balickove kryti
  vcetne_domacnosti: boolean;
  vcetne_odpovednosti: boolean;
};

// Kazda kategorie ma 1..N instanci (vice instanci jen u vice_instanci kategorii)
type ProduktyState = Record<ProduktKategorie, ProduktStav[]>;

const STORAGE_KEY = "hypoFormDraft.v2";

const initialState: FormState = {
  cisty_prijem_mesicne: "",
  typ_prijmu: "zamestnanec",
  vek: "",
  osvc_obor: "",
  osvc_rocni_obrat_czk: "",
  pocet_osob_domacnost: "1",
  pocet_deti: "0",
  // --- TESTOVACI PREDVYPLNENI (odstranit pred ostrym provozem) ---
  typ_pozadavku: "uver_proti_nemovitosti",
  ucel: "vlastni_bydleni",
  hodnota_nemovitosti: "10000000",
  vlastni_zdroje: "0",
  zbyvajici_dluh: "3900000",
  pozadovana_castka: "",
  // --- KONEC TESTOVACIHO PREDVYPLNENI ---
  splatnost_roky: "25",
  fixace_roky: "5",
};

function prazdnyProdukt(): ProduktStav {
  return {
    aktivni: false,
    instituce_id: "",
    nazev_produktu: "",
    mesicni_castka: "",
    frekvence: "mesicne",
    zustatek: "",
    vcetne_domacnosti: false,
    vcetne_odpovednosti: false,
  };
}

function initProduktyState(): ProduktyState {
  const out = {} as ProduktyState;
  for (const k of VSECHNY_KATEGORIE) {
    out[k.id] = [prazdnyProdukt()];
  }

  // --- TESTOVACI PREDVYPLNENI (odstranit pred ostrym provozem) ---
  out.hypoteka_jina = [
    {
      ...prazdnyProdukt(),
      aktivni: true,
      instituce_id: "moneta",
      mesicni_castka: "22700",
    },
  ];
  out.spotrebitelsky_uver = [
    {
      ...prazdnyProdukt(),
      aktivni: true,
      instituce_id: "csas",
      mesicni_castka: "21000",
    },
  ];
  out.stavebni_sporeni = [
    {
      ...prazdnyProdukt(),
      aktivni: true,
      instituce_id: "ss_modra_pyramida",
      mesicni_castka: "1370",
    },
  ];
  out.zp_rizikove = [
    {
      ...prazdnyProdukt(),
      aktivni: true,
      instituce_id: "kooperativa",
      nazev_produktu: "Flexi",
      mesicni_castka: "4300",
    },
  ];
  out.poj_nemovitosti = [
    {
      ...prazdnyProdukt(),
      aktivni: true,
      mesicni_castka: "5500",
      frekvence: "rocne",
      vcetne_domacnosti: true,
      vcetne_odpovednosti: true,
    },
  ];
  out.investice = [
    { ...prazdnyProdukt(), aktivni: true, instituce_id: "investown" },
    { ...prazdnyProdukt(), aktivni: true, instituce_id: "xtb" },
    { ...prazdnyProdukt(), aktivni: true, instituce_id: "etoro" },
  ];
  // --- KONEC TESTOVACIHO PREDVYPLNENI ---

  return out;
}

const TOTAL_STEPS = 5;

export default function HypoForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormState>(initialState);
  const [produkty, setProdukty] = useState<ProduktyState>(initProduktyState());
  const [instituce, setInstituce] = useState<Instituce[]>([]);
  const [institucniChyba, setInstitucniChyba] = useState<string | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>> & {
      produkty?: Partial<Record<ProduktKategorie, string>>;
    }
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Načti seznam institucí na pozadí
  useEffect(() => {
    fetchInstituce()
      .then(setInstituce)
      .catch((err) => {
        setInstitucniChyba(
          err instanceof Error ? err.message : "Nepodařilo se načíst seznam institucí",
        );
      });
  }, []);

  // Obnov rozpracovany formular (napr. po "Upravit zadani" z vysledku).
  // localStorage az po mountu — kvuli SSR hydrataci.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          data?: Partial<FormState>;
          produkty?: Partial<ProduktyState>;
        };
        if (saved.data) {
          setData((d) => ({ ...d, ...saved.data }));
        }
        if (saved.produkty) {
          setProdukty((p) => {
            const merged = { ...p };
            for (const k of VSECHNY_KATEGORIE) {
              const sp = saved.produkty?.[k.id];
              if (Array.isArray(sp) && sp.length > 0) {
                merged[k.id] = sp.map((i) => ({ ...prazdnyProdukt(), ...i }));
              }
            }
            return merged;
          });
        }
      }
    } catch {
      // poskozeny draft ignorujeme
    }
    setDraftLoaded(true);
  }, []);

  // Prubezne ukladani draftu
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, produkty }));
    } catch {
      // quota / private mode — ignorujeme
    }
  }, [data, produkty, draftLoaded]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function updateProdukt(
    kategorie: ProduktKategorie,
    idx: number,
    patch: Partial<ProduktStav>,
  ) {
    setProdukty((p) => {
      const list = [...p[kategorie]];
      list[idx] = { ...list[idx], ...patch };
      return { ...p, [kategorie]: list };
    });
    setErrors((e) => ({
      ...e,
      produkty: { ...(e.produkty ?? {}), [kategorie]: undefined },
    }));
  }

  function pridatInstanci(kategorie: ProduktKategorie) {
    setProdukty((p) => ({
      ...p,
      [kategorie]: [...p[kategorie], { ...prazdnyProdukt(), aktivni: true }],
    }));
  }

  function odebratInstanci(kategorie: ProduktKategorie, idx: number) {
    setProdukty((p) => {
      const list = p[kategorie].filter((_, i) => i !== idx);
      return {
        ...p,
        [kategorie]: list.length > 0 ? list : [prazdnyProdukt()],
      };
    });
  }

  function toggleKategorie(kategorie: ProduktKategorie, aktivni: boolean) {
    setProdukty((p) => {
      if (aktivni) {
        const list = [...p[kategorie]];
        list[0] = { ...list[0], aktivni: true };
        return { ...p, [kategorie]: list };
      }
      // Vypnuti = reset cele kategorie (vc. extra instanci)
      return { ...p, [kategorie]: [prazdnyProdukt()] };
    });
    setErrors((e) => ({
      ...e,
      produkty: { ...(e.produkty ?? {}), [kategorie]: undefined },
    }));
  }

  function validateStep(s: number): boolean {
    const e: typeof errors = {};
    const num = (v: string) => Number(v.replace(/\s/g, ""));

    if (s === 1) {
      const maObrat =
        data.typ_prijmu === "osvc" &&
        !!data.osvc_rocni_obrat_czk &&
        num(data.osvc_rocni_obrat_czk) > 0;
      const maObor = data.typ_prijmu === "osvc" && !!data.osvc_obor;
      const osvcKompletni = maObrat && maObor;

      // Mesicni prijem je povinny, POKUD nemame kompletni OSVC udaje
      // (obor + obrat) — z tech si prijem odvodime.
      if (!osvcKompletni) {
        if (!data.cisty_prijem_mesicne || num(data.cisty_prijem_mesicne) <= 0)
          e.cisty_prijem_mesicne =
            data.typ_prijmu === "osvc"
              ? "Zadejte čistý měsíční příjem, nebo vyplňte obor + roční obrat níže."
              : "Zadejte čistý měsíční příjem (CZK).";
      } else if (
        data.cisty_prijem_mesicne &&
        num(data.cisty_prijem_mesicne) < 0
      ) {
        e.cisty_prijem_mesicne = "Nemůže být záporné.";
      }
      if (!data.vek || num(data.vek) < 18 || num(data.vek) > 99)
        e.vek = "Věk 18–99.";
      // OSVČ: obor a obrat jdou jen v páru
      if (data.typ_prijmu === "osvc") {
        if (maObrat && !maObor) e.osvc_obor = "Vyberte obor podnikání.";
        if (maObor && !maObrat) e.osvc_rocni_obrat_czk = "Zadejte roční obrat.";
      }
    }
    if (s === 2) {
      if (num(data.pocet_osob_domacnost) < 1)
        e.pocet_osob_domacnost = "Min. 1 osoba.";
      if (num(data.pocet_deti) < 0) e.pocet_deti = "Nemůže být záporné.";
    }
    if (s === 3) {
      // Pro každou zapnutou instanci vyžadujeme platnou částku.
      // U sporicich/investicnich kategorii staci zustatek (jednorazovy investor).
      const produktyErrors: Partial<Record<ProduktKategorie, string>> = {};
      for (const k of VSECHNY_KATEGORIE) {
        const instances = produkty[k.id];
        instances.forEach((p, idx) => {
          if (!p.aktivni) return;
          const castka = num(p.mesicni_castka);
          const zustatek = num(p.zustatek);
          const maCastku = !!p.mesicni_castka && !isNaN(castka) && castka > 0;
          const maZustatek = !!p.zustatek && !isNaN(zustatek) && zustatek > 0;
          const oznaceni =
            instances.filter((i) => i.aktivni).length > 1
              ? ` (položka ${idx + 1})`
              : "";
          if (k.ma_zustatek) {
            if (!maCastku && !maZustatek) {
              produktyErrors[k.id] =
                `Zadejte pravidelnou částku nebo aktuálně naspořeno${oznaceni}.`;
            }
          } else if (!maCastku) {
            produktyErrors[k.id] = `Zadejte měsíční částku v CZK${oznaceni}.`;
          }
        });
      }
      if (Object.keys(produktyErrors).length > 0) {
        e.produkty = produktyErrors;
      }
    }
    if (s === 4) {
      if (!data.hodnota_nemovitosti || num(data.hodnota_nemovitosti) <= 0)
        e.hodnota_nemovitosti = "Zadejte hodnotu nemovitosti.";
      if (data.typ_pozadavku === "koupe") {
        if (num(data.vlastni_zdroje) < 0)
          e.vlastni_zdroje = "Nemůže být záporné.";
        if (num(data.vlastni_zdroje) > num(data.hodnota_nemovitosti))
          e.vlastni_zdroje = "Vlastní zdroje > hodnota nemovitosti.";
      } else {
        const dluh = num(data.zbyvajici_dluh);
        if (data.zbyvajici_dluh === "" || isNaN(dluh) || dluh < 0)
          e.zbyvajici_dluh = "Zadejte zbývající dluh (0, pokud žádný).";
        if (dluh >= num(data.hodnota_nemovitosti))
          e.zbyvajici_dluh = "Dluh musí být nižší než hodnota nemovitosti.";
        if (data.pozadovana_castka && num(data.pozadovana_castka) < 0)
          e.pozadovana_castka = "Nemůže být záporné.";
      }
    }
    if (s === 5) {
      const sp = num(data.splatnost_roky);
      if (sp < 5 || sp > 30) e.splatnost_roky = "Splatnost 5–30 let.";
      const fx = num(data.fixace_roky);
      if (fx < 1 || fx > 10) e.fixace_roky = "Fixace 1–10 let.";
    }
    setErrors(e);
    const hasFieldError = Object.keys(e).filter((k) => k !== "produkty").length > 0;
    const hasProduktError = e.produkty && Object.keys(e.produkty).length > 0;
    return !hasFieldError && !hasProduktError;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  function vyrobExistingProductList(): ExistingProduct[] {
    const out: ExistingProduct[] = [];
    for (const k of VSECHNY_KATEGORIE) {
      for (const p of produkty[k.id]) {
        if (!p.aktivni) continue;
        const castka = Number(p.mesicni_castka.replace(/\s/g, "") || "0");
        const mesicne =
          p.frekvence === "rocne" ? Math.round(castka / 12) : castka;
        const zustatek = Number(p.zustatek.replace(/\s/g, "") || "0");

        const zahrnuje: ProduktKategorie[] = [];
        if (k.id === "poj_nemovitosti") {
          if (p.vcetne_domacnosti) zahrnuje.push("poj_domacnosti");
          if (p.vcetne_odpovednosti) zahrnuje.push("poj_odpovednosti");
        }

        out.push({
          kategorie: k.id,
          instituce_id: p.instituce_id || null,
          nazev_produktu: p.nazev_produktu.trim() || null,
          mesicni_castka_czk: mesicne,
          zahrnuje_kategorie: zahrnuje.length > 0 ? zahrnuje : null,
          zustatek_czk: zustatek > 0 ? zustatek : null,
        });
      }
    }
    return out;
  }

  async function submit() {
    if (!validateStep(step)) return;
    setSubmitting(true);
    setSubmitError(null);

    const obratNum = Number(data.osvc_rocni_obrat_czk || "0");
    const protiNemovitosti = data.typ_pozadavku === "uver_proti_nemovitosti";
    const profile: CustomerProfile = {
      cisty_prijem_mesicne: Number(data.cisty_prijem_mesicne || "0"),
      typ_prijmu: data.typ_prijmu,
      vek: Number(data.vek),
      pocet_osob_domacnost: Number(data.pocet_osob_domacnost),
      pocet_deti: Number(data.pocet_deti),
      // Splatky se pocitaji automaticky ze souctu uveru v kroku 3
      stavajici_splatky_mesicne: 0,
      ucel: data.ucel,
      hodnota_nemovitosti: Number(data.hodnota_nemovitosti),
      vlastni_zdroje: protiNemovitosti ? 0 : Number(data.vlastni_zdroje),
      splatnost_roky: Number(data.splatnost_roky),
      fixace_roky: Number(data.fixace_roky),
      existujici_produkty: vyrobExistingProductList(),
      osvc_obor:
        data.typ_prijmu === "osvc" && data.osvc_obor ? data.osvc_obor : null,
      osvc_rocni_obrat_czk:
        data.typ_prijmu === "osvc" && obratNum > 0 ? obratNum : null,
      typ_pozadavku: data.typ_pozadavku,
      zbyvajici_dluh_nemovitost_czk: protiNemovitosti
        ? Number(data.zbyvajici_dluh || "0")
        : null,
      pozadovana_castka_czk:
        protiNemovitosti && Number(data.pozadovana_castka || "0") > 0
          ? Number(data.pozadovana_castka)
          : null,
    };

    try {
      const result = await vypocitej(profile);
      sessionStorage.setItem("hypoResult", JSON.stringify(result));
      router.push("/vysledky");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Neznámá chyba při výpočtu.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="form-card">
      <div className="step-indicator">
        <div className="step-circles">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <span
              key={s}
              className={
                "step-circle " +
                (s === step ? "active" : s < step ? "done" : "")
              }
              aria-label={`Krok ${s}`}
            >
              {s < step ? "✓" : s}
            </span>
          ))}
        </div>
        <span className="step-label">
          Krok {step} z {TOTAL_STEPS}
        </span>
      </div>
      <div className="step-progress" aria-hidden="true">
        <div
          className="step-progress-fill"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {step === 1 && (
        <>
          <h2>Příjem a věk</h2>
          <div className="field">
            <label htmlFor="typ_prijmu">Typ příjmu</label>
            <select
              id="typ_prijmu"
              value={data.typ_prijmu}
              onChange={(e) =>
                update("typ_prijmu", e.target.value as TypPrijmu)
              }
            >
              <option value="zamestnanec">Zaměstnanec</option>
              <option value="osvc">OSVČ</option>
              <option value="jiny">Jiný (důchod, rodičovský…)</option>
            </select>
            <span className="hint">
              Banky mají různé požadavky na doložení a OSVČ často podhodnocují
              příjem podle daňového přiznání.
            </span>
          </div>
          <div className="field">
            <label htmlFor="prijem">
              {data.typ_prijmu === "osvc"
                ? "Čistý měsíční příjem (CZK) — volitelné, pokud níže vyplníte obor a obrat"
                : "Čistý měsíční příjem (CZK)"}
            </label>
            <input
              id="prijem"
              type="number"
              inputMode="numeric"
              value={data.cisty_prijem_mesicne}
              onChange={(e) =>
                update("cisty_prijem_mesicne", e.target.value)
              }
              placeholder={
                data.typ_prijmu === "osvc"
                  ? "kolik si reálně měsíčně berete (nepovinné)"
                  : "např. 45000"
              }
            />
            {data.typ_prijmu === "osvc" && (
              <span className="hint">
                Pokud vyplníte obor + roční obrat, příjem odvodíme z obratu.
                Vyplňte jen pokud chcete porovnat s vlastním odhadem.
              </span>
            )}
            {errors.cisty_prijem_mesicne && (
              <span className="error">{errors.cisty_prijem_mesicne}</span>
            )}
          </div>

          {data.typ_prijmu === "osvc" && (
            <div className="osvc-blok">
              <div className="osvc-blok-nadpis">
                <strong>OSVČ — pomozte nám správně odhadnout bonitu</strong>
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  Pokud vyplníte obor a roční obrat, použijeme realistický
                  příjem podle vašeho oboru místo daňového základu. (Volitelné.)
                </p>
              </div>
              <div className="row">
                <div className="field">
                  <label htmlFor="osvc_obor">Obor podnikání</label>
                  <select
                    id="osvc_obor"
                    value={data.osvc_obor}
                    onChange={(e) =>
                      update("osvc_obor", e.target.value as OsvcObor | "")
                    }
                  >
                    <option value="">— nevyplněno —</option>
                    {OSVC_OBORY.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {errors.osvc_obor && (
                    <span className="error">{errors.osvc_obor}</span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="osvc_obrat">Roční obrat (CZK)</label>
                  <input
                    id="osvc_obrat"
                    type="number"
                    inputMode="numeric"
                    value={data.osvc_rocni_obrat_czk}
                    onChange={(e) =>
                      update("osvc_rocni_obrat_czk", e.target.value)
                    }
                    placeholder="např. 1500000"
                  />
                  {errors.osvc_rocni_obrat_czk && (
                    <span className="error">
                      {errors.osvc_rocni_obrat_czk}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="vek">Věk žadatele</label>
            <input
              id="vek"
              type="number"
              inputMode="numeric"
              value={data.vek}
              onChange={(e) => update("vek", e.target.value)}
              placeholder="např. 32"
            />
            <span className="hint">
              Do 36 let lze čerpat LTV až 90 % (CNB regulace).
            </span>
            {errors.vek && <span className="error">{errors.vek}</span>}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Domácnost a závazky</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="osoby">Počet osob v domácnosti</label>
              <input
                id="osoby"
                type="number"
                inputMode="numeric"
                value={data.pocet_osob_domacnost}
                onChange={(e) =>
                  update("pocet_osob_domacnost", e.target.value)
                }
              />
              {errors.pocet_osob_domacnost && (
                <span className="error">{errors.pocet_osob_domacnost}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="deti">Vyživované děti</label>
              <input
                id="deti"
                type="number"
                inputMode="numeric"
                value={data.pocet_deti}
                onChange={(e) => update("pocet_deti", e.target.value)}
              />
              {errors.pocet_deti && (
                <span className="error">{errors.pocet_deti}</span>
              )}
            </div>
          </div>
          <p className="hint" style={{ marginTop: 4 }}>
            Splátky stávajících úvěrů nezadáváte ručně — spočítáme je
            automaticky z produktů, které vyplníte v dalším kroku.
          </p>
        </>
      )}

      {step === 3 && (
        <ProduktyKrok
          produkty={produkty}
          instituce={instituce}
          institucniChyba={institucniChyba}
          updateProdukt={updateProdukt}
          toggleKategorie={toggleKategorie}
          pridatInstanci={pridatInstanci}
          odebratInstanci={odebratInstanci}
          chyby={errors.produkty ?? {}}
        />
      )}

      {step === 4 && (
        <>
          <h2>Nemovitost a úvěr</h2>
          <div className="field">
            <label htmlFor="typ_pozadavku">Co řešíte?</label>
            <select
              id="typ_pozadavku"
              value={data.typ_pozadavku}
              onChange={(e) =>
                update("typ_pozadavku", e.target.value as TypPozadavku)
              }
            >
              <option value="koupe">
                Koupě / výstavba nemovitosti (nová hypotéka)
              </option>
              <option value="uver_proti_nemovitosti">
                Půjčka proti stávající nemovitosti (navýšení / americká
                hypotéka)
              </option>
            </select>
            {data.typ_pozadavku === "uver_proti_nemovitosti" && (
              <span className="hint">
                Vaše nemovitost slouží jako zástava. Spočítáme, kolik můžete
                půjčit do LTV limitu banky po odečtení stávajícího dluhu.
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="ucel">Účel</label>
            <select
              id="ucel"
              value={data.ucel}
              onChange={(e) => update("ucel", e.target.value as Ucel)}
            >
              <option value="vlastni_bydleni">Vlastní bydlení</option>
              <option value="investicni">Investiční nemovitost</option>
            </select>
            <span className="hint">
              U investiční nemovitosti je max. LTV 70 % (CNB doporučení od
              4/2026).
            </span>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="hodnota">Hodnota nemovitosti (CZK)</label>
              <input
                id="hodnota"
                type="number"
                inputMode="numeric"
                value={data.hodnota_nemovitosti}
                onChange={(e) =>
                  update("hodnota_nemovitosti", e.target.value)
                }
                placeholder="např. 4500000"
              />
              {errors.hodnota_nemovitosti && (
                <span className="error">{errors.hodnota_nemovitosti}</span>
              )}
            </div>
            {data.typ_pozadavku === "koupe" ? (
              <div className="field">
                <label htmlFor="vlastni">Vlastní zdroje (CZK)</label>
                <input
                  id="vlastni"
                  type="number"
                  inputMode="numeric"
                  value={data.vlastni_zdroje}
                  onChange={(e) => update("vlastni_zdroje", e.target.value)}
                  placeholder="např. 900000"
                />
                {errors.vlastni_zdroje && (
                  <span className="error">{errors.vlastni_zdroje}</span>
                )}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="dluh">
                  Zbývající dluh na nemovitosti (CZK)
                </label>
                <input
                  id="dluh"
                  type="number"
                  inputMode="numeric"
                  value={data.zbyvajici_dluh}
                  onChange={(e) => update("zbyvajici_dluh", e.target.value)}
                  placeholder="např. 3900000"
                />
                <span className="hint">
                  Aktuální zůstatek hypotéky/úvěrů zajištěných touto
                  nemovitostí. 0, pokud je bez zástavy.
                </span>
                {errors.zbyvajici_dluh && (
                  <span className="error">{errors.zbyvajici_dluh}</span>
                )}
              </div>
            )}
          </div>
          {data.typ_pozadavku === "uver_proti_nemovitosti" && (
            <div className="field">
              <label htmlFor="pozadovana">
                Kolik chcete půjčit (CZK) — volitelné
              </label>
              <input
                id="pozadovana"
                type="number"
                inputMode="numeric"
                value={data.pozadovana_castka}
                onChange={(e) =>
                  update("pozadovana_castka", e.target.value)
                }
                placeholder="prázdné = maximum do LTV limitu"
              />
              <span className="hint">
                Necháte-li prázdné, spočítáme maximum, na které dosáhnete.
                {Number(data.hodnota_nemovitosti) > 0 &&
                  Number(data.zbyvajici_dluh) >= 0 && (
                    <>
                      {" "}
                      Orientačně při LTV 70 %:{" "}
                      <strong>
                        {Math.max(
                          0,
                          Math.round(
                            Number(data.hodnota_nemovitosti) * 0.7 -
                              Number(data.zbyvajici_dluh || "0"),
                          ),
                        ).toLocaleString("cs-CZ")}{" "}
                        Kč
                      </strong>
                      , při LTV 80 %:{" "}
                      <strong>
                        {Math.max(
                          0,
                          Math.round(
                            Number(data.hodnota_nemovitosti) * 0.8 -
                              Number(data.zbyvajici_dluh || "0"),
                          ),
                        ).toLocaleString("cs-CZ")}{" "}
                        Kč
                      </strong>
                      .
                    </>
                  )}
              </span>
              {errors.pozadovana_castka && (
                <span className="error">{errors.pozadovana_castka}</span>
              )}
            </div>
          )}
        </>
      )}

      {step === 5 && (
        <>
          <h2>Parametry úvěru</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="splatnost">Splatnost (let)</label>
              <input
                id="splatnost"
                type="number"
                inputMode="numeric"
                value={data.splatnost_roky}
                onChange={(e) => update("splatnost_roky", e.target.value)}
              />
              <span className="hint">5–30 let.</span>
              {errors.splatnost_roky && (
                <span className="error">{errors.splatnost_roky}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="fixace">Fixace (let)</label>
              <select
                id="fixace"
                value={data.fixace_roky}
                onChange={(e) => update("fixace_roky", e.target.value)}
              >
                <option value="1">1 rok</option>
                <option value="2">2 roky</option>
                <option value="3">3 roky</option>
                <option value="5">5 let</option>
                <option value="7">7 let</option>
                <option value="10">10 let</option>
              </select>
              {errors.fixace_roky && (
                <span className="error">{errors.fixace_roky}</span>
              )}
            </div>
          </div>
        </>
      )}

      {submitError && <div className="error">{submitError}</div>}

      <div className="actions">
        <button
          type="button"
          className="btn secondary"
          onClick={prev}
          disabled={step === 1 || submitting}
        >
          Zpět
        </button>
        {step < TOTAL_STEPS ? (
          <button type="button" className="btn" onClick={next}>
            Pokračovat <span className="btn-arrow">→</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Počítám…" : "Spočítat"}
          </button>
        )}
      </div>
    </div>
  );
}

// ----------- Krok 3: Stávající produkty -----------

interface ProduktyKrokProps {
  produkty: ProduktyState;
  instituce: Instituce[];
  institucniChyba: string | null;
  updateProdukt: (
    kategorie: ProduktKategorie,
    idx: number,
    patch: Partial<ProduktStav>,
  ) => void;
  toggleKategorie: (kategorie: ProduktKategorie, aktivni: boolean) => void;
  pridatInstanci: (kategorie: ProduktKategorie) => void;
  odebratInstanci: (kategorie: ProduktKategorie, idx: number) => void;
  chyby: Partial<Record<ProduktKategorie, string>>;
}

function ProduktyKrok({
  produkty,
  instituce,
  institucniChyba,
  updateProdukt,
  toggleKategorie,
  pridatInstanci,
  odebratInstanci,
  chyby,
}: ProduktyKrokProps) {
  const pocetAktivnich = useMemo(
    () =>
      Object.values(produkty)
        .flat()
        .filter((p) => p.aktivni).length,
    [produkty],
  );

  return (
    <>
      <h2>Stávající produkty</h2>
      <p className="hint" style={{ marginBottom: 16 }}>
        Vyberte produkty, které už máte. Společnost a název jsou volitelné,
        <strong> měsíční částku potřebujeme vždy</strong> (vklad / splátka /
        pojistné). Splátky úvěrů odtud automaticky započítáme do výpočtu
        bonity (DSTI) a produkty použijeme pro doporučení, kde máte mezery
        v zajištění.
        {pocetAktivnich > 0 && (
          <>
            <br />
            <strong>Vybráno produktů: {pocetAktivnich}</strong>
          </>
        )}
      </p>

      {institucniChyba && (
        <div className="error" style={{ marginBottom: 12 }}>
          Seznam institucí se nepodařilo načíst ({institucniChyba}). Můžete
          pokračovat, instituce zůstanou nevyplněné.
        </div>
      )}

      {SEKCE.map((sekce) => (
        <section key={sekce.id} className="produkty-sekce">
          <h3 className="produkty-sekce-nadpis">{sekce.nazev}</h3>
          <p className="hint" style={{ marginTop: -4 }}>
            {sekce.popis}
          </p>
          <div className="produkty-list">
            {sekce.kategorie.map((kat) => {
              const instances = produkty[kat.id];
              const kategorieAktivni = instances.some((i) => i.aktivni);
              const chyba = chyby[kat.id];
              return (
                <div
                  key={kat.id}
                  className={
                    "produkt-radek " + (kategorieAktivni ? "active" : "")
                  }
                >
                  <label className="produkt-toggle">
                    <input
                      type="checkbox"
                      checked={kategorieAktivni}
                      onChange={(e) =>
                        toggleKategorie(kat.id, e.target.checked)
                      }
                    />
                    <span>
                      <strong>{kat.nazev}</strong>
                      {kat.popis && (
                        <span className="hint"> — {kat.popis}</span>
                      )}
                    </span>
                  </label>

                  {kategorieAktivni && (
                    <>
                      {instances.map((p, idx) =>
                        p.aktivni ? (
                          <ProduktInstance
                            key={idx}
                            kat={kat}
                            p={p}
                            idx={idx}
                            pocetInstanci={
                              instances.filter((i) => i.aktivni).length
                            }
                            instituce={instituce}
                            updateProdukt={updateProdukt}
                            odebratInstanci={odebratInstanci}
                            chyba={idx === 0 ? chyba : undefined}
                          />
                        ) : null,
                      )}
                      {kat.vice_instanci && (
                        <button
                          type="button"
                          className="btn-pridat-instanci"
                          onClick={() => pridatInstanci(kat.id)}
                        >
                          + Přidat další {kat.id === "investice"
                            ? "platformu"
                            : "smlouvu"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

// ----------- Jedna instance produktu -----------

interface ProduktInstanceProps {
  kat: KategoriiDef;
  p: ProduktStav;
  idx: number;
  pocetInstanci: number;
  instituce: Instituce[];
  updateProdukt: (
    kategorie: ProduktKategorie,
    idx: number,
    patch: Partial<ProduktStav>,
  ) => void;
  odebratInstanci: (kategorie: ProduktKategorie, idx: number) => void;
  chyba?: string;
}

function ProduktInstance({
  kat,
  p,
  idx,
  pocetInstanci,
  instituce,
  updateProdukt,
  odebratInstanci,
  chyba,
}: ProduktInstanceProps) {
  const filtrovaneInstituce = instituce.filter((i) =>
    kat.relevantni_typy.includes(i.typ),
  );
  const suffix = `${kat.id}-${idx}`;

  return (
    <div className="produkt-detail">
      {pocetInstanci > 1 && (
        <div className="instance-header">
          <span className="hint">Položka {idx + 1}</span>
          <button
            type="button"
            className="btn-odebrat"
            onClick={() => odebratInstanci(kat.id, idx)}
            aria-label={`Odebrat položku ${idx + 1}`}
          >
            ✕ odebrat
          </button>
        </div>
      )}
      <div className="field">
        <label htmlFor={`inst-${suffix}`} style={{ fontSize: 13 }}>
          Společnost (volitelné)
        </label>
        <select
          id={`inst-${suffix}`}
          value={p.instituce_id}
          onChange={(e) =>
            updateProdukt(kat.id, idx, { instituce_id: e.target.value })
          }
          disabled={filtrovaneInstituce.length === 0}
        >
          <option value="">— vyberte —</option>
          {filtrovaneInstituce.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nazev}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`nazev-${suffix}`} style={{ fontSize: 13 }}>
          Název produktu (volitelné)
        </label>
        <input
          id={`nazev-${suffix}`}
          type="text"
          value={p.nazev_produktu}
          onChange={(e) =>
            updateProdukt(kat.id, idx, { nazev_produktu: e.target.value })
          }
          placeholder="např. KB Garant Plus"
        />
      </div>
      <div className="field">
        <label htmlFor={`castka-${suffix}`} style={{ fontSize: 13 }}>
          {p.frekvence === "rocne"
            ? kat.castka_label.replace("Měsíční", "Roční")
            : kat.castka_label}{" "}
          <span className="required">*</span>
        </label>
        <div className="castka-radek">
          <input
            id={`castka-${suffix}`}
            type="number"
            inputMode="numeric"
            value={p.mesicni_castka}
            onChange={(e) =>
              updateProdukt(kat.id, idx, { mesicni_castka: e.target.value })
            }
            placeholder="CZK"
            aria-invalid={chyba ? "true" : undefined}
          />
          <select
            aria-label="Frekvence platby"
            value={p.frekvence}
            onChange={(e) =>
              updateProdukt(kat.id, idx, {
                frekvence: e.target.value as Frekvence,
              })
            }
          >
            <option value="mesicne">měsíčně</option>
            <option value="rocne">ročně</option>
          </select>
        </div>
        {p.frekvence === "rocne" && Number(p.mesicni_castka) > 0 && (
          <span className="hint">
            ≈ {Math.round(Number(p.mesicni_castka) / 12).toLocaleString("cs-CZ")}{" "}
            Kč/měs
          </span>
        )}
        {chyba && <span className="error">{chyba}</span>}
      </div>
      {kat.ma_zustatek && (
        <div className="field">
          <label htmlFor={`zustatek-${suffix}`} style={{ fontSize: 13 }}>
            Aktuálně naspořeno (CZK)
          </label>
          <input
            id={`zustatek-${suffix}`}
            type="number"
            inputMode="numeric"
            value={p.zustatek}
            onChange={(e) =>
              updateProdukt(kat.id, idx, { zustatek: e.target.value })
            }
            placeholder="např. 150000"
          />
          <span className="hint">
            Volitelné — zpřesní výpočet vaší rezervy.
          </span>
        </div>
      )}
      {kat.id === "poj_nemovitosti" && (
        <div className="field balicek-kryti">
          <label style={{ fontSize: 13 }}>Co smlouva zahrnuje</label>
          <label className="balicek-checkbox">
            <input
              type="checkbox"
              checked={p.vcetne_domacnosti}
              onChange={(e) =>
                updateProdukt(kat.id, idx, {
                  vcetne_domacnosti: e.target.checked,
                })
              }
            />
            <span>včetně pojištění domácnosti</span>
          </label>
          <label className="balicek-checkbox">
            <input
              type="checkbox"
              checked={p.vcetne_odpovednosti}
              onChange={(e) =>
                updateProdukt(kat.id, idx, {
                  vcetne_odpovednosti: e.target.checked,
                })
              }
            />
            <span>včetně odpovědnosti za škodu</span>
          </label>
        </div>
      )}
    </div>
  );
}
