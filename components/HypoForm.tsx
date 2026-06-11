"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomerProfile,
  ExistingProduct,
  Instituce,
  OsvcObor,
  ProduktKategorie,
  TypPrijmu,
  Ucel,
} from "@/lib/types";
import { fetchInstituce, vypocitej } from "@/lib/api";
import { SEKCE, VSECHNY_KATEGORIE } from "@/lib/categories";

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
  stavajici_splatky_mesicne: string;
  // Krok 4 (Nemovitost)
  ucel: Ucel;
  hodnota_nemovitosti: string;
  vlastni_zdroje: string;
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

type ProduktyState = Record<ProduktKategorie, ProduktStav>;

const STORAGE_KEY = "hypoFormDraft.v1";

const initialState: FormState = {
  cisty_prijem_mesicne: "",
  typ_prijmu: "zamestnanec",
  vek: "",
  osvc_obor: "",
  osvc_rocni_obrat_czk: "",
  pocet_osob_domacnost: "1",
  pocet_deti: "0",
  stavajici_splatky_mesicne: "0",
  ucel: "vlastni_bydleni",
  hodnota_nemovitosti: "",
  vlastni_zdroje: "0",
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
    out[k.id] = prazdnyProdukt();
  }

  // --- TESTOVACI PREDVYPLNENI (odstranit pred ostrym provozem) ---
  out.hypoteka_jina = {
    ...prazdnyProdukt(),
    aktivni: true,
    instituce_id: "moneta",
    mesicni_castka: "22700",
  };
  out.spotrebitelsky_uver = {
    ...prazdnyProdukt(),
    aktivni: true,
    instituce_id: "csas",
    mesicni_castka: "21000",
  };
  out.stavebni_sporeni = {
    ...prazdnyProdukt(),
    aktivni: true,
    instituce_id: "ss_modra_pyramida",
    mesicni_castka: "1370",
  };
  out.zp_rizikove = {
    ...prazdnyProdukt(),
    aktivni: true,
    instituce_id: "kooperativa",
    nazev_produktu: "Flexi",
    mesicni_castka: "4300",
  };
  out.poj_nemovitosti = {
    ...prazdnyProdukt(),
    aktivni: true,
    mesicni_castka: "5500",
    frekvence: "rocne",
    vcetne_domacnosti: true,
    vcetne_odpovednosti: true,
  };
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
              if (sp) merged[k.id] = { ...prazdnyProdukt(), ...sp };
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
    patch: Partial<ProduktyState[ProduktKategorie]>,
  ) {
    setProdukty((p) => ({ ...p, [kategorie]: { ...p[kategorie], ...patch } }));
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
      if (num(data.stavajici_splatky_mesicne) < 0)
        e.stavajici_splatky_mesicne = "Nemůže být záporné.";
    }
    if (s === 3) {
      // Pro každý zapnutý produkt vyžadujeme platnou částku.
      // U sporicich/investicnich kategorii staci zustatek (jednorazovy investor).
      const produktyErrors: Partial<Record<ProduktKategorie, string>> = {};
      for (const k of VSECHNY_KATEGORIE) {
        const p = produkty[k.id];
        if (!p.aktivni) continue;
        const castka = num(p.mesicni_castka);
        const zustatek = num(p.zustatek);
        const maCastku = !!p.mesicni_castka && !isNaN(castka) && castka > 0;
        const maZustatek = !!p.zustatek && !isNaN(zustatek) && zustatek > 0;
        if (k.ma_zustatek) {
          if (!maCastku && !maZustatek) {
            produktyErrors[k.id] =
              "Zadejte pravidelnou částku nebo aktuálně naspořeno.";
          }
        } else if (!maCastku) {
          produktyErrors[k.id] = "Zadejte měsíční částku v CZK.";
        }
      }
      if (Object.keys(produktyErrors).length > 0) {
        e.produkty = produktyErrors;
      }
    }
    if (s === 4) {
      if (!data.hodnota_nemovitosti || num(data.hodnota_nemovitosti) <= 0)
        e.hodnota_nemovitosti = "Zadejte hodnotu nemovitosti.";
      if (num(data.vlastni_zdroje) < 0)
        e.vlastni_zdroje = "Nemůže být záporné.";
      if (num(data.vlastni_zdroje) > num(data.hodnota_nemovitosti))
        e.vlastni_zdroje = "Vlastní zdroje > hodnota nemovitosti.";
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
      const p = produkty[k.id];
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
    return out;
  }

  async function submit() {
    if (!validateStep(step)) return;
    setSubmitting(true);
    setSubmitError(null);

    const obratNum = Number(data.osvc_rocni_obrat_czk || "0");
    const profile: CustomerProfile = {
      cisty_prijem_mesicne: Number(data.cisty_prijem_mesicne || "0"),
      typ_prijmu: data.typ_prijmu,
      vek: Number(data.vek),
      pocet_osob_domacnost: Number(data.pocet_osob_domacnost),
      pocet_deti: Number(data.pocet_deti),
      stavajici_splatky_mesicne: Number(data.stavajici_splatky_mesicne),
      ucel: data.ucel,
      hodnota_nemovitosti: Number(data.hodnota_nemovitosti),
      vlastni_zdroje: Number(data.vlastni_zdroje),
      splatnost_roky: Number(data.splatnost_roky),
      fixace_roky: Number(data.fixace_roky),
      existujici_produkty: vyrobExistingProductList(),
      osvc_obor:
        data.typ_prijmu === "osvc" && data.osvc_obor ? data.osvc_obor : null,
      osvc_rocni_obrat_czk:
        data.typ_prijmu === "osvc" && obratNum > 0 ? obratNum : null,
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
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <span
            key={s}
            className={
              "step-dot " +
              (s === step ? "active" : s < step ? "done" : "")
            }
            aria-label={`Krok ${s}`}
          />
        ))}
        <span>
          Krok {step} ze {TOTAL_STEPS}
        </span>
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
          <div className="field">
            <label htmlFor="splatky">
              Stávající měsíční splátky závazků (CZK)
            </label>
            <input
              id="splatky"
              type="number"
              inputMode="numeric"
              value={data.stavajici_splatky_mesicne}
              onChange={(e) =>
                update("stavajici_splatky_mesicne", e.target.value)
              }
              placeholder="např. 3000"
            />
            <span className="hint">
              Souhrn měsíčních splátek úvěrů, leasingu a kreditních karet.
              Použije se pro výpočet DSTI. Detailní rozpis vyplníte v dalším
              kroku.
            </span>
            {errors.stavajici_splatky_mesicne && (
              <span className="error">
                {errors.stavajici_splatky_mesicne}
              </span>
            )}
          </div>
        </>
      )}

      {step === 3 && (
        <ProduktyKrok
          produkty={produkty}
          instituce={instituce}
          institucniChyba={institucniChyba}
          updateProdukt={updateProdukt}
          chyby={errors.produkty ?? {}}
        />
      )}

      {step === 4 && (
        <>
          <h2>Nemovitost</h2>
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
          </div>
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
            Pokračovat
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
    patch: Partial<ProduktyState[ProduktKategorie]>,
  ) => void;
  chyby: Partial<Record<ProduktKategorie, string>>;
}

function ProduktyKrok({
  produkty,
  instituce,
  institucniChyba,
  updateProdukt,
  chyby,
}: ProduktyKrokProps) {
  const pocetAktivnich = useMemo(
    () => Object.values(produkty).filter((p) => p.aktivni).length,
    [produkty],
  );

  return (
    <>
      <h2>Stávající produkty</h2>
      <p className="hint" style={{ marginBottom: 16 }}>
        Vyberte produkty, které už máte. Společnost a název jsou volitelné,
        <strong> měsíční částku potřebujeme vždy</strong> (vklad / splátka /
        pojistné). Stávající produkty se použijí pro pozdější doporučení, kde
        máte mezery v zajištění.
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
              const p = produkty[kat.id];
              const filtrovaneInstituce = instituce.filter((i) =>
                kat.relevantni_typy.includes(i.typ),
              );
              const chyba = chyby[kat.id];
              return (
                <div
                  key={kat.id}
                  className={"produkt-radek " + (p.aktivni ? "active" : "")}
                >
                  <label className="produkt-toggle">
                    <input
                      type="checkbox"
                      checked={p.aktivni}
                      onChange={(e) =>
                        updateProdukt(kat.id, { aktivni: e.target.checked })
                      }
                    />
                    <span>
                      <strong>{kat.nazev}</strong>
                      {kat.popis && (
                        <span className="hint"> — {kat.popis}</span>
                      )}
                    </span>
                  </label>

                  {p.aktivni && (
                    <div className="produkt-detail">
                      <div className="field">
                        <label
                          htmlFor={`inst-${kat.id}`}
                          style={{ fontSize: 13 }}
                        >
                          Společnost (volitelné)
                        </label>
                        <select
                          id={`inst-${kat.id}`}
                          value={p.instituce_id}
                          onChange={(e) =>
                            updateProdukt(kat.id, {
                              instituce_id: e.target.value,
                            })
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
                        <label
                          htmlFor={`nazev-${kat.id}`}
                          style={{ fontSize: 13 }}
                        >
                          Název produktu (volitelné)
                        </label>
                        <input
                          id={`nazev-${kat.id}`}
                          type="text"
                          value={p.nazev_produktu}
                          onChange={(e) =>
                            updateProdukt(kat.id, {
                              nazev_produktu: e.target.value,
                            })
                          }
                          placeholder="např. KB Garant Plus"
                        />
                      </div>
                      <div className="field">
                        <label
                          htmlFor={`castka-${kat.id}`}
                          style={{ fontSize: 13 }}
                        >
                          {p.frekvence === "rocne"
                            ? kat.castka_label.replace("Měsíční", "Roční")
                            : kat.castka_label}{" "}
                          <span className="required">*</span>
                        </label>
                        <div className="castka-radek">
                          <input
                            id={`castka-${kat.id}`}
                            type="number"
                            inputMode="numeric"
                            value={p.mesicni_castka}
                            onChange={(e) =>
                              updateProdukt(kat.id, {
                                mesicni_castka: e.target.value,
                              })
                            }
                            placeholder="CZK"
                            aria-invalid={chyba ? "true" : undefined}
                          />
                          <select
                            aria-label="Frekvence platby"
                            value={p.frekvence}
                            onChange={(e) =>
                              updateProdukt(kat.id, {
                                frekvence: e.target.value as Frekvence,
                              })
                            }
                          >
                            <option value="mesicne">měsíčně</option>
                            <option value="rocne">ročně</option>
                          </select>
                        </div>
                        {p.frekvence === "rocne" &&
                          Number(p.mesicni_castka) > 0 && (
                            <span className="hint">
                              ≈{" "}
                              {Math.round(
                                Number(p.mesicni_castka) / 12,
                              ).toLocaleString("cs-CZ")}{" "}
                              Kč/měs
                            </span>
                          )}
                        {chyba && <span className="error">{chyba}</span>}
                      </div>
                      {kat.ma_zustatek && (
                        <div className="field">
                          <label
                            htmlFor={`zustatek-${kat.id}`}
                            style={{ fontSize: 13 }}
                          >
                            Aktuálně naspořeno (CZK)
                          </label>
                          <input
                            id={`zustatek-${kat.id}`}
                            type="number"
                            inputMode="numeric"
                            value={p.zustatek}
                            onChange={(e) =>
                              updateProdukt(kat.id, {
                                zustatek: e.target.value,
                              })
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
                          <label style={{ fontSize: 13 }}>
                            Co smlouva zahrnuje
                          </label>
                          <label className="balicek-checkbox">
                            <input
                              type="checkbox"
                              checked={p.vcetne_domacnosti}
                              onChange={(e) =>
                                updateProdukt(kat.id, {
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
                                updateProdukt(kat.id, {
                                  vcetne_odpovednosti: e.target.checked,
                                })
                              }
                            />
                            <span>včetně odpovědnosti za škodu</span>
                          </label>
                        </div>
                      )}
                    </div>
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
