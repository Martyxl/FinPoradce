# FinPoradce — orientační kalkulačka hypotéky (MVP)

Webová aplikace, která ze základních vstupů spočítá předběžnou způsobilost
na hypotéku u **10 retailových bank** a doporučí "chytré zajištění" — co
sjednat / vylepšit, aby byla hypotéka bezpečná. Zdarma, online, bez lovu kontaktů.

- **Frontend:** Next.js 14 (App Router, TypeScript)
- **Backend:** Next.js Route Handlers (`app/api/*/route.ts`) — Node.js runtime na Vercelu
- **Data MVP:** JSON v gitu, rozdělené do produktových souborů
  - `data/banks.json` — hypoteční produkty 10 bank
  - `data/cnb_rules.json` — LTV/DTI/DSTI, životní minimum, repo sazba
  - `data/instituce.json` — master seznam 15+ retailových institucí, pojišťoven, penzijních společností, stavebních spořitelen
  - `data/produkty_sporeni.json` — spořicí účty + termínované vklady
  - `data/produkty_stavebni_sporeni.json` — stavební spoření + úvěr ze SS
  - `data/produkty_pojisteni.json` — typy ŽP/majetkového, doporučené krytí, tržní podíly pojišťoven
  - `data/produkty_penze.json` — DPS (III. pilíř), DIP, penzijní společnosti
  - `data/regulatorni_parametry_2026.json` — paušální výdaje, paušální daň, daňové odpočty, DPS, OSVČ
  - `data/scoring_pravidla.json` — CFPB rámec, poměrové ukazatele, OSVČ větev se 4 metodami

> Výpočet je předběžný odhad. Závazné podmínky určí banka po posouzení.
> Sazby = snapshot jaro 2026, mění se měsíčně.

---

## Architektura

```
repo/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── calculate/route.ts    # POST: výpočet hypotéky + doporučení
│   │   ├── instituce/route.ts    # GET: ploché instituce pro form
│   │   ├── banks/route.ts        # GET: pouze id+název bank
│   │   └── health/route.ts       # GET: liveness probe
│   ├── layout.tsx
│   ├── page.tsx                  # progresivní formulář (5 kroků)
│   ├── vysledky/page.tsx
│   └── globals.css
├── components/
│   ├── HypoForm.tsx
│   ├── VysledekKarta.tsx
│   └── DoporuceniKarta.tsx
├── lib/
│   ├── bonita.ts                 # BonitaCalculator (izolovaný modul)
│   ├── recommendations.ts        # RecommendationEngine (izolovaný modul)
│   ├── data.ts                   # JSON loadery (fs read)
│   ├── categories.ts             # katalog 17 kategorií produktů + mapping
│   ├── api.ts                    # fetch helper + formátování CZK/%
│   └── types.ts                  # sdílené TS interfaces
├── data/                         # JSON datová vrstva (commitnutá v gitu)
│   ├── banks.json
│   ├── cnb_rules.json
│   ├── instituce.json
│   ├── produkty_*.json
│   ├── regulatorni_parametry_2026.json
│   └── scoring_pravidla.json
├── package.json
├── tsconfig.json
├── next.config.js
└── vercel.json
```

### Izolace bonitního modulu

Třída `BonitaCalculator` v `lib/bonita.ts` má pevné rozhraní:

```ts
calculate(profile: CustomerProfile): CalculationResult
```

`CalculationResult.per_bank[i]` obsahuje pro každou banku:
`max_loan, max_monthly_payment, sazba, limiting_factor, is_estimate, …`

Modul lze nahradit přesnějším modelem (přesný interní scoring, regresní model
na historických datech…) **beze změny formuláře nebo prezentace** — stačí
implementovat stejné rozhraní a v `app/api/calculate/route.ts` vyměnit instanci.

### Izolace doporučovacího modulu

Třída `RecommendationEngine` v `lib/recommendations.ts` má pevné rozhraní:

```ts
evaluate(profile: CustomerProfile, calculation: CalculationResult): Doporuceni[]
```

Pravidla jsou samostatné metody `pravidlo*`. Přidání nového pravidla = jedna
nová metoda v `evaluate()` listu. Pravidla jsou seřazena podle priority a
kategorie (CHYBI > NEOPTIMALNI > UPOZORNENI > OK).

### Výpočetní logika

Max. úvěr pro každou banku = **MINIMUM** ze tří omezení:

1. **LTV** = `hodnota_nemovitosti × min(CNB_max, banka.ltv_max)`
   - vlastní bydlení do 36 let: až 90 %
   - vlastní bydlení nad 36 let: 80 %
   - investiční nemovitost: 70 %
2. **DSTI** (interní limit banky):
   `(čistý_příjem × dsti_limit − stávající_splátky) → max_splátka → jistina anuitou`
3. **DTI** (interní limit banky): `roční_příjem × dti_limit − stávající_dluh`

Anuitní vzorec: `splátka = jistina × (i/12) / (1 − (1+i/12)^(−n))`.

> ČNB má od 2024 DSTI a DTI pro standardní bydlení **deaktivované** — závazný
> je jen LTV (a od 4/2026 DTI 7 pro investiční nemovitost). Proto výpočet
> pracuje s **interními** limity bank, které jsou označené jako odhad.

---

## Spuštění lokálně

### Předpoklady

- Node.js ≥ 18

### Instalace + dev server

```bash
npm install
npm run dev
```

Otevři <http://localhost:3000>. Žádný separátní Python proces — Route Handlers
běží přímo v Next.js dev serveru.

---

## Nasazení na Vercel

Projekt je čistý Next.js. Po importu repozitáře Vercel automaticky:

1. Detekuje **Next.js** preset.
2. Spustí `next build`.
3. Route Handlers v `app/api/*/route.ts` se nasadí jako Node.js serverless
   funkce. JSON soubory v `/data` jsou součástí buildu — `fs.readFileSync`
   funguje bez konfigurace.

`vercel.json` obsahuje jen `framework: nextjs` jako pojistka pro auto-detekci.
Žádné ENV proměnné nejsou potřeba pro MVP.

---

## Místa označená `estimate` / `OVERIT`

Toto je **seznam k ověření** před ostrým provozem. Hodnoty pocházejí
z přehledových zdrojů nebo jsou odhady — interní scoring bank je obchodní
tajemstvi a sazby/poplatky se mění.

### `data/banks.json` — hypoteční sazby a interní scoring

| Banka | Pole | Stav |
| --- | --- | --- |
| KB, Air Bank | `interni_dsti_limit`, `interni_dti_limit` | **estimate** — interní scoring je obchodní tajemství |
| KB | sazby, poplatky | **public** — sazebník KB |
| Air Bank | sazby | **public** — `airbank.cz`, jaro 2026 |
| Air Bank | `poplatky` | **estimate** — doplnit z `airbank.cz` |
| Česká spořitelna | celé `sazby` | **estimate** — Hypoindex snapshot, ne `csas.cz` |
| Česká spořitelna | `poplatky`, interní limity | **estimate / OVERIT** |
| ČSOB / Hypoteční banka | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 |
| Moneta Money Bank | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 |
| Fio banka | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 |
| UniCredit Bank | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 |
| Raiffeisenbank | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 (březen 2026 zvedla o 0,5 p.b.) |
| Partners Banka | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 (březen 2026 zvedla o 0,5 p.b.) |
| mBank | sazby, poplatky, limity | **estimate** — Hypoindex 24.2.2026 |
| `trzni_prumery.*` | Swiss Life Hypoindex, ČBA Hypomonitor | **estimate** — sekundární zdroj |

### `data/cnb_rules.json` — CNB / MPSV regulace

| Pole | Stav |
| --- | --- |
| LTV vlastní bydlení 80/90 %, investiční 70 % | **public** — ČNB |
| DSTI/DTI (deaktivováno pro standardní bydlení) | **public** — ČNB |
| Repo sazba 3,50 % | **public** — ČNB bankovní rada |
| Životní minimum (do 30.4.2026 a od 1.5.2026) | **public** — zákon č. 152/2025 Sb. |

### `data/instituce.json` — master seznam institucí

| Kategorie | Počet | Stav |
| --- | --- | --- |
| Velké univerzální banky | 7 | **public** |
| Menší / specializované banky | 10 | **public** |
| Stavební spořitelny | 5 | **public** |
| Pojišťovny | 12 | **public** (tržní podíly z ČAP 2023) |
| Penzijní společnosti | 8 | **public** |

> Tržní podíly pojišťoven jsou za 2023 (poslední kompletní procentní data od ČAP). Pro 2024/2025 jsou veřejné jen agregáty — pro produkční nasazení stáhnout XLSX z `cap.cz` ručně.

### `data/produkty_sporeni.json`

- **13 spořicích účtů** a **4 termínované vklady** ze snapshotu jaro 2026 — všechny tagované `estimate`, zdroj srovnávače e15/finance.cz/top.cz.
- Pro produkci nutno aktualizovat ze sazebníků bank — bonusové sazby lze měnit bez 2měsíční výpovědní lhůty.

### `data/produkty_stavebni_sporeni.json`

- Státní podpora 5 % / max 1 000 Kč rok — **public** (zákon).
- Sazby tarifů (Raiffeisen SS, Modrá pyramida, Buřinka, MONETA SS) — **estimate** snapshot jaro 2026.
- ČSOB Stavební spořitelna (ČMSS) — sazby **OVERIT**, nedoplněno.

### `data/produkty_pojisteni.json`

- Typy ŽP / majetkového — **public** (regulace, ČAP definice).
- Doporučené krytí (5–10× příjem pro živitele, klesající PČ při hypotéce) — **estimate**, odborná doporučení.
- Tržní podíly 2023 — **public** ČAP.

### `data/produkty_penze.json`

- DPS, státní příspěvek 340 Kč/měs, daňové odpočty 48 000 Kč/rok — **public**.
- Povinný příspěvek zaměstnavatele 4 % od 1.1.2026 pro rizikovou práci 3. kategorie — **public** (zákon č. 324/2025 Sb.).
- Agregáty trhu (3,9 mil. účastníků, 644 mld. Kč) — **public** APS ČR.

### `data/regulatorni_parametry_2026.json`

- Paušální výdaje (80/60/40/30 %) — **public** (zákon o daních z příjmů).
- Paušální daň (I/II/III pásmo: 9 984 / 16 745 / 27 139 Kč) — **public** Finanční správa. Novela snížení záloh OSVČ na 35 % průměrné mzdy — **OVERIT** finální částky.
- DPS, stavební spoření, daňové odpočty — **public**.

### `data/scoring_pravidla.json`

- CFPB Financial Well-Being Scale (USA) — **public** metodika.
- Poměrové ukazatele (DSTI < 40 %, DTI < 8, rezerva 3–6 měs, savings rate 10–20 %) — **public** ČNB + **estimate** Vanguard/EMH.
- **OSVČ větev** (4 metody hodnocení bank, koeficienty reálných nákladů dle oboru) — **estimate**, před produkcí kalibrovat s hypotečními specialisty.
- Váhy skóre (0–100) — **estimate**, kalibrovat na reálných datech.

### Obecné

- Snapshot sazeb je k **jaru 2026**, sazby se mění měsíčně — před ostrým
  provozem nastavit proces aktualizace (manuálně nebo přes scraping).
- `ltv_prirazka_nad_80` u KB je z veřejného sazebníku, ale ostatní banky
  mohou mít obdobné přirážky, které dnes nejsou v datech.

---

## Co je a není v této iteraci

**ANO**

- datová vrstva produktů (`data/*.json`)
- progresivní formulář (4 kroky, validace)
- izolovaný výpočetní modul (`BonitaCalculator`)
- výsledková stránka s porovnáním 3 bank

**NE** (struktura připravena, neimplementováno)

- konverze / předání žádosti do banky
- uživatelské účty, ukládání žádostí (sessionStorage pouze)
- platby
- scraping sazeb
- admin rozhraní
- přechod z JSON na PostgreSQL

### Budoucí migrace na PostgreSQL

Stačí přepsat funkce `load_banks()` a `load_cnb_rules()` v `api/calculate.py`,
aby četly z DB místo z JSON. `BonitaCalculator` ani frontend se nemění.

### Budoucí výměna bonitního modulu

Implementovat třídu se stejným rozhraním a v endpointu `calculate` vyměnit
instanci `BonitaCalculator(...)` za novou implementaci.
