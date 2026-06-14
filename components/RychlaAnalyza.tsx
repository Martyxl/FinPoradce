"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  OsvcObor,
  PotrebaPlan,
  RychlyProfil,
  TypPrijmu,
} from "@/lib/types";
import { formatCZK } from "@/lib/api";
import type { PotrebaTyp } from "@/lib/potreby";
import { CHAT_RYCHLY_KEY } from "@/components/ChatPanel";

const OSVC_OBORY: { id: OsvcObor; label: string }[] = [
  { id: "it_programovani", label: "IT, programování" },
  { id: "marketing_poradenstvi_kreativa", label: "Marketing, poradenství, kreativa" },
  { id: "advokacie_lekar_notarstvi", label: "Advokacie, lékaři, notáři" },
  { id: "obecne_volne_zivnosti", label: "Ostatní volné živnosti" },
  { id: "remeslne_zivnosti", label: "Řemeslné živnosti" },
  { id: "zemedelska_vyroba", label: "Zemědělství, lesnictví" },
];

type FormState = {
  typ_prijmu: TypPrijmu;
  cisty_prijem_mesicne: string;
  vek: string;
  pocet_osob_domacnost: string;
  pocet_deti: string;
  osvc_obor: OsvcObor | "";
  osvc_rocni_obrat_czk: string;
  cil_text: string;
  co_uz_mam: string;
  castka_mesicne_czk: string;
  horizont_let: string;
};

const init: FormState = {
  typ_prijmu: "zamestnanec",
  cisty_prijem_mesicne: "",
  vek: "",
  pocet_osob_domacnost: "1",
  pocet_deti: "0",
  osvc_obor: "",
  osvc_rocni_obrat_czk: "",
  cil_text: "",
  co_uz_mam: "",
  castka_mesicne_czk: "",
  horizont_let: "",
};

export default function RychlaAnalyza({
  potreba,
  nadpis,
  cilPlaceholder,
}: {
  potreba: Extract<PotrebaTyp, "zajisteni" | "sporeni">;
  nadpis: string;
  cilPlaceholder: string;
}) {
  const [data, setData] = useState<FormState>(init);
  const [plan, setPlan] = useState<PotrebaPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const jeSporeni = potreba === "sporeni";

  // Predvyplneni z chatu (sessionStorage)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHAT_RYCHLY_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<RychlyProfil>;
        setData((d) => ({
          ...d,
          typ_prijmu: p.typ_prijmu ?? d.typ_prijmu,
          cisty_prijem_mesicne:
            typeof p.cisty_prijem_mesicne === "number"
              ? String(p.cisty_prijem_mesicne)
              : d.cisty_prijem_mesicne,
          vek: typeof p.vek === "number" ? String(p.vek) : d.vek,
          pocet_osob_domacnost:
            typeof p.pocet_osob_domacnost === "number"
              ? String(p.pocet_osob_domacnost)
              : d.pocet_osob_domacnost,
          pocet_deti:
            typeof p.pocet_deti === "number" ? String(p.pocet_deti) : d.pocet_deti,
          osvc_obor: p.osvc_obor ?? d.osvc_obor,
          osvc_rocni_obrat_czk:
            typeof p.osvc_rocni_obrat_czk === "number"
              ? String(p.osvc_rocni_obrat_czk)
              : d.osvc_rocni_obrat_czk,
          cil_text: p.cil_text ?? d.cil_text,
          co_uz_mam: p.co_uz_mam ?? d.co_uz_mam,
          castka_mesicne_czk:
            typeof p.castka_mesicne_czk === "number"
              ? String(p.castka_mesicne_czk)
              : d.castka_mesicne_czk,
          horizont_let:
            typeof p.horizont_let === "number" ? String(p.horizont_let) : d.horizont_let,
        }));
        sessionStorage.removeItem(CHAT_RYCHLY_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function odeslat() {
    setChyba(null);
    const prijem = Number(data.cisty_prijem_mesicne);
    const vek = Number(data.vek);
    if (!prijem || prijem <= 0) {
      setChyba("Zadejte čistý měsíční příjem.");
      return;
    }
    if (!vek || vek < 18 || vek > 99) {
      setChyba("Zadejte věk (18–99).");
      return;
    }
    const profil: RychlyProfil = {
      typ_prijmu: data.typ_prijmu,
      cisty_prijem_mesicne: prijem,
      vek,
      pocet_osob_domacnost: Number(data.pocet_osob_domacnost) || 1,
      pocet_deti: Number(data.pocet_deti) || 0,
      osvc_obor: data.typ_prijmu === "osvc" && data.osvc_obor ? data.osvc_obor : null,
      osvc_rocni_obrat_czk: Number(data.osvc_rocni_obrat_czk) || null,
      cil_text: data.cil_text.trim(),
      co_uz_mam: data.co_uz_mam.trim() || null,
      castka_mesicne_czk: jeSporeni ? Number(data.castka_mesicne_czk) || null : null,
      horizont_let: jeSporeni ? Number(data.horizont_let) || null : null,
    };
    setLoading(true);
    try {
      const res = await fetch("/api/analyza-potreby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ potreba, profil }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(typeof d?.detail === "string" ? d.detail : `Chyba ${res.status}`);
      }
      setPlan(d as PotrebaPlan);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : "Neznámá chyba.");
    } finally {
      setLoading(false);
    }
  }

  if (plan) {
    return (
      <>
        <h1>{nadpis} — váš plán</h1>
        <div className="potreba-plan-shrnuti">{plan.shrnuti}</div>

        {plan.kroky.map((k, i) => (
          <div key={i} className="potreba-krok">
            <h3>
              {i + 1}. {k.nadpis}
            </h3>
            <p>{k.popis}</p>
            {k.produkty.length > 0 && (
              <p className="hint">Produkty: {k.produkty.join(", ")}</p>
            )}
            {typeof k.odhad_mesicne_czk === "number" &&
              k.odhad_mesicne_czk > 0 && (
                <div className="potreba-krok-naklad">
                  Orientačně {formatCZK(k.odhad_mesicne_czk)} / měs
                </div>
              )}
          </div>
        ))}

        {plan.doporucene_produkty.length > 0 && (
          <>
            <h2>Doporučené produkty</h2>
            <ul className="produkty-prehled">
              {plan.doporucene_produkty.map((p, i) => (
                <li key={i}>
                  <strong>{p.nazev}</strong>
                  {p.instituce_id && <> · {p.instituce_id}</>}
                  <span style={{ float: "right" }}>
                    {formatCZK(p.mesicni_naklad_czk)} / měs
                  </span>
                  <span className="hint">{p.proc}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.upozorneni.length > 0 && (
          <div className="warnings">
            <strong>Důležité:</strong>
            <ul>
              {plan.upozorneni.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="hint" style={{ marginTop: 16 }}>
          Plán je orientační, nenahrazuje licencované poradenství. Ceny určí
          instituce.
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setPlan(null)}
          >
            Upravit zadání
          </button>
          <Link href="/start" className="btn secondary">
            Jiná potřeba
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{nadpis}</h1>
      <p className="lead">
        Pár údajů a AI vám sestaví konkrétní plán na míru. Bez prodejního tlaku,
        nezávisle na provizích.
      </p>

      <div className="form-card">
        <div className="field">
          <label htmlFor="cil">Co chcete vyřešit?</label>
          <input
            id="cil"
            type="text"
            value={data.cil_text}
            onChange={(e) => upd("cil_text", e.target.value)}
            placeholder={cilPlaceholder}
          />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="typ">Typ příjmu</label>
            <select
              id="typ"
              value={data.typ_prijmu}
              onChange={(e) => upd("typ_prijmu", e.target.value as TypPrijmu)}
            >
              <option value="zamestnanec">Zaměstnanec</option>
              <option value="osvc">OSVČ</option>
              <option value="jiny">Jiný</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="prijem">Čistý měsíční příjem (CZK)</label>
            <input
              id="prijem"
              type="number"
              inputMode="numeric"
              value={data.cisty_prijem_mesicne}
              onChange={(e) => upd("cisty_prijem_mesicne", e.target.value)}
              placeholder="např. 45000"
            />
          </div>
        </div>

        {data.typ_prijmu === "osvc" && (
          <div className="osvc-blok">
            <div className="row">
              <div className="field">
                <label htmlFor="obor">Obor (volitelné)</label>
                <select
                  id="obor"
                  value={data.osvc_obor}
                  onChange={(e) => upd("osvc_obor", e.target.value as OsvcObor | "")}
                >
                  <option value="">— nevyplněno —</option>
                  {OSVC_OBORY.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="obrat">Roční obrat (CZK, volitelné)</label>
                <input
                  id="obrat"
                  type="number"
                  inputMode="numeric"
                  value={data.osvc_rocni_obrat_czk}
                  onChange={(e) => upd("osvc_rocni_obrat_czk", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="row">
          <div className="field">
            <label htmlFor="vek">Věk</label>
            <input
              id="vek"
              type="number"
              inputMode="numeric"
              value={data.vek}
              onChange={(e) => upd("vek", e.target.value)}
              placeholder="např. 35"
            />
          </div>
          <div className="field">
            <label htmlFor="osoby">Osob v domácnosti / z toho dětí</label>
            <div className="castka-radek">
              <input
                id="osoby"
                type="number"
                inputMode="numeric"
                value={data.pocet_osob_domacnost}
                onChange={(e) => upd("pocet_osob_domacnost", e.target.value)}
                aria-label="Počet osob"
              />
              <input
                type="number"
                inputMode="numeric"
                value={data.pocet_deti}
                onChange={(e) => upd("pocet_deti", e.target.value)}
                aria-label="Počet dětí"
              />
            </div>
          </div>
        </div>

        {jeSporeni && (
          <div className="row">
            <div className="field">
              <label htmlFor="castka">Kolik můžete odkládat měsíčně (CZK)</label>
              <input
                id="castka"
                type="number"
                inputMode="numeric"
                value={data.castka_mesicne_czk}
                onChange={(e) => upd("castka_mesicne_czk", e.target.value)}
                placeholder="např. 5000"
              />
            </div>
            <div className="field">
              <label htmlFor="horizont">Horizont (let)</label>
              <input
                id="horizont"
                type="number"
                inputMode="numeric"
                value={data.horizont_let}
                onChange={(e) => upd("horizont_let", e.target.value)}
                placeholder="např. 15"
              />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="mam">Co už v této oblasti máte? (volitelné)</label>
          <input
            id="mam"
            type="text"
            value={data.co_uz_mam}
            onChange={(e) => upd("co_uz_mam", e.target.value)}
            placeholder={
              jeSporeni
                ? "např. spořicí účet 200 tis., DPS 500 Kč/měs"
                : "např. životko od banky, pojištění bytu"
            }
          />
        </div>

        {chyba && <div className="error">{chyba}</div>}

        <div className="actions">
          <Link href="/start" className="btn secondary">
            Zpět
          </Link>
          <button
            type="button"
            className="btn"
            onClick={odeslat}
            disabled={loading}
          >
            {loading ? "AI sestavuje plán…" : "Sestavit plán ✦"}
          </button>
        </div>
      </div>
    </>
  );
}
