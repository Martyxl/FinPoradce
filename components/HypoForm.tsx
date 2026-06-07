"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerProfile, TypPrijmu, Ucel } from "@/lib/types";
import { vypocitej } from "@/lib/api";

type FormState = {
  cisty_prijem_mesicne: string;
  typ_prijmu: TypPrijmu;
  vek: string;
  pocet_osob_domacnost: string;
  pocet_deti: string;
  stavajici_splatky_mesicne: string;
  ucel: Ucel;
  hodnota_nemovitosti: string;
  vlastni_zdroje: string;
  splatnost_roky: string;
  fixace_roky: string;
};

const initialState: FormState = {
  cisty_prijem_mesicne: "",
  typ_prijmu: "zamestnanec",
  vek: "",
  pocet_osob_domacnost: "1",
  pocet_deti: "0",
  stavajici_splatky_mesicne: "0",
  ucel: "vlastni_bydleni",
  hodnota_nemovitosti: "",
  vlastni_zdroje: "0",
  splatnost_roky: "25",
  fixace_roky: "5",
};

const TOTAL_STEPS = 4;

export default function HypoForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateStep(s: number): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    const num = (v: string) => Number(v.replace(/\s/g, ""));

    if (s === 1) {
      if (!data.cisty_prijem_mesicne || num(data.cisty_prijem_mesicne) <= 0)
        e.cisty_prijem_mesicne = "Zadejte čistý měsíční příjem (CZK).";
      if (!data.vek || num(data.vek) < 18 || num(data.vek) > 99)
        e.vek = "Věk 18–99.";
    }
    if (s === 2) {
      if (num(data.pocet_osob_domacnost) < 1)
        e.pocet_osob_domacnost = "Min. 1 osoba.";
      if (num(data.pocet_deti) < 0) e.pocet_deti = "Nemůže být záporné.";
      if (num(data.stavajici_splatky_mesicne) < 0)
        e.stavajici_splatky_mesicne = "Nemůže být záporné.";
    }
    if (s === 3) {
      if (!data.hodnota_nemovitosti || num(data.hodnota_nemovitosti) <= 0)
        e.hodnota_nemovitosti = "Zadejte hodnotu nemovitosti.";
      if (num(data.vlastni_zdroje) < 0)
        e.vlastni_zdroje = "Nemůže být záporné.";
      if (num(data.vlastni_zdroje) > num(data.hodnota_nemovitosti))
        e.vlastni_zdroje = "Vlastní zdroje > hodnota nemovitosti.";
    }
    if (s === 4) {
      const sp = num(data.splatnost_roky);
      if (sp < 5 || sp > 30) e.splatnost_roky = "Splatnost 5–30 let.";
      const fx = num(data.fixace_roky);
      if (fx < 1 || fx > 10) e.fixace_roky = "Fixace 1–10 let.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function prev() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    if (!validateStep(step)) return;
    setSubmitting(true);
    setSubmitError(null);

    const profile: CustomerProfile = {
      cisty_prijem_mesicne: Number(data.cisty_prijem_mesicne),
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
        {[1, 2, 3, 4].map((s) => (
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
            <label htmlFor="prijem">Čistý měsíční příjem (CZK)</label>
            <input
              id="prijem"
              type="number"
              inputMode="numeric"
              value={data.cisty_prijem_mesicne}
              onChange={(e) =>
                update("cisty_prijem_mesicne", e.target.value)
              }
              placeholder="např. 45000"
            />
            {errors.cisty_prijem_mesicne && (
              <span className="error">{errors.cisty_prijem_mesicne}</span>
            )}
          </div>
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
              Pro tuto verzi typ příjmu ovlivňuje pouze informativní hodnocení.
              Banky mají různé požadavky na doložení.
            </span>
          </div>
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
              Spotřebitelské úvěry, leasing, kreditní karty. Nezapočítávejte
              běžné výdaje.
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

      {step === 4 && (
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
