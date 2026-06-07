# FinPoradce — orientační kalkulačka hypotéky (MVP)

Webová aplikace, která ze základních vstupů spočítá předběžnou způsobilost
na hypotéku u **Komerční banky, Air Bank a České spořitelny**. Zdarma, online,
bez lovu kontaktů.

- **Frontend:** Next.js 14 (App Router, TypeScript)
- **Backend:** Python FastAPI jako serverless funkce v `/api` (Vercel-kompatibilní)
- **Data MVP:** JSON v gitu (`data/banks.json`, `data/cnb_rules.json`)

> Výpočet je předběžný odhad. Závazné podmínky určí banka po posouzení.
> Sazby = snapshot jaro 2026, mění se měsíčně.

---

## Architektura

```
repo/
├── api/
│   └── calculate.py     # FastAPI app + izolovaný BonitaCalculator
├── app/                 # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx         # progresivní formulář (4 kroky)
│   ├── vysledky/page.tsx
│   └── globals.css
├── components/
│   ├── HypoForm.tsx
│   └── VysledekKarta.tsx
├── lib/
│   ├── api.ts           # fetch helper + formátování
│   └── types.ts         # TS zrcadlo Pydantic modelů
├── data/
│   ├── banks.json
│   └── cnb_rules.json
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json
└── requirements.txt
```

### Izolace bonitního modulu

Třída `BonitaCalculator` v `api/calculate.py` má pevné rozhraní:

```python
calculate(profile: CustomerProfile) -> CalculationResult
```

`CalculationResult.per_bank[i]` obsahuje pro každou banku:
`max_loan, max_monthly_payment, sazba, limiting_factor, is_estimate, …`

Modul lze nahradit přesnějším modelem (přesný interní scoring, regresní model
na historických datech…) **beze změny formuláře nebo prezentace** — stačí
implementovat stejné rozhraní a v `calculate` endpointu vyměnit instanci.

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
- Python ≥ 3.11

### Instalace

```bash
npm install
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

### Dev server

```bash
npm run dev
```

Spustí paralelně:

- `next dev` na <http://localhost:3000> (frontend)
- `uvicorn api.calculate:app` na <http://127.0.0.1:8000> (Python backend)

`next.config.js` v development módu přepisuje `/api/*` na `http://127.0.0.1:8000/api/*`,
takže frontend volá `/api/calculate` a Next.js to proxy-uje na FastAPI.

Pokud chcete spustit jen frontend nebo jen backend:

```bash
npm run dev:next
npm run dev:api
```

---

## Nasazení na Vercel

Projekt je Vercel-ready. Po importu repozitáře:

1. Vercel detekuje **Next.js** automaticky.
2. `vercel.json` říká, že `api/calculate.py` se má buildit jako Python serverless
   funkce (`@vercel/python@4.3.1`) a má do balíčku zahrnout `data/**`.
3. `requirements.txt` v rootu zajistí, že se nainstaluje `fastapi`, `pydantic`,
   `uvicorn`.
4. Po deploy je endpoint `POST /api/calculate` živý a frontend ho volá přímo
   (na Vercelu se `/api/*` nepoužívá rewrite — FastAPI běží jako serverless).

Žádné ENV proměnné nejsou potřeba pro MVP.

---

## Místa označená `estimate` / `OVERIT`

Toto je **seznam k ověření** před ostrým provozem. Hodnoty pocházejí
z přehledových zdrojů nebo jsou odhady — interní scoring bank je obchodní
tajemstvi a sazby/poplatky se mění.

### `data/banks.json`

| Banka | Pole | Stav |
| --- | --- | --- |
| Komerční banka | `interni_dsti_limit`, `interni_dti_limit` | **estimate** — ověřit u banky |
| Air Bank | `interni_dsti_limit`, `interni_dti_limit` | **estimate** — ověřit u banky |
| Air Bank | `poplatky` | **estimate** — doplnit z `airbank.cz` |
| Air Bank | `_komentar_ltv` — přirážka nad 80 % pro žadatele 36+ | ověřit |
| Česká spořitelna | celé `sazby` | **estimate** — převzato z přehledu Hypoindex, ne z `csas.cz` |
| Česká spořitelna | `interni_dsti_limit`, `interni_dti_limit` | **estimate** |
| Česká spořitelna | `slevy_podminky` | **OVERIT** — doplnit z oficiálních materiálů |
| Česká spořitelna | `poplatky` | **OVERIT** — doplnit ze sazebníku |

### `data/cnb_rules.json`

| Pole | Stav |
| --- | --- |
| `zivotni_minimum.*` | **OVERIT** — částky životního minima dle nařízení vlády (`mpsv.cz`) |

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
