"""
FastAPI endpoint pro vypocet predbezne zpusobilosti na hypoteku.

ARCHITEKTONICKY POZADAVEK: Bonitni vypocet je izolovany ve tride BonitaCalculator
s pevnym rozhranim (CustomerProfile -> CalculationResult). Modul jde nahradit
presnejsim modelem bez zasahu do formulare nebo prezentace.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -------- Cesty k datum --------
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


# -------- Datovy model: vstup od zakaznika --------
class CustomerProfile(BaseModel):
    cisty_prijem_mesicne: float = Field(gt=0, description="CZK / mesic")
    typ_prijmu: Literal["zamestnanec", "osvc", "jiny"]
    vek: int = Field(ge=18, le=99)
    pocet_osob_domacnost: int = Field(ge=1, le=10)
    pocet_deti: int = Field(ge=0, le=10)
    stavajici_splatky_mesicne: float = Field(ge=0)
    ucel: Literal["vlastni_bydleni", "investicni"]
    hodnota_nemovitosti: float = Field(gt=0)
    vlastni_zdroje: float = Field(ge=0)
    splatnost_roky: int = Field(ge=5, le=30)
    fixace_roky: int = Field(ge=1, le=10)


# -------- Datovy model: vystup --------
class BankResult(BaseModel):
    bank_id: str
    bank_nazev: str
    max_loan: float
    max_monthly_payment: float
    sazba: float
    sazba_puvod: str
    limiting_factor: Literal["LTV", "DSTI", "DTI", "ZADOST"]
    is_estimate: bool
    ltv_pouzite: float
    pozadovany_uver: float
    podminky_slev: str
    poznamky: list[str]


class CalculationResult(BaseModel):
    max_loan: float
    max_monthly_payment: float
    limiting_factor: str
    per_bank: list[BankResult]
    profile_echo: CustomerProfile
    upozorneni: list[str]


# -------- Nacitani dat --------
def load_banks() -> dict:
    with open(DATA_DIR / "banks.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_cnb_rules() -> dict:
    with open(DATA_DIR / "cnb_rules.json", "r", encoding="utf-8") as f:
        return json.load(f)


# -------- IZOLOVANY VYPOCETNI MODUL --------
class BonitaCalculator:
    """
    Izolovany modul vypoctu bonity. Verejne rozhrani:
      calculate(profile: CustomerProfile) -> CalculationResult

    Pro nahradu presnejsim modelem: implementuj stejne rozhrani a vymen instanci.
    """

    def __init__(self, banks_data: dict, cnb_rules: dict) -> None:
        self.banks = banks_data["banky"]
        self.cnb = cnb_rules

    # ---- Pomocne funkce ----
    @staticmethod
    def _anuita_splatka(jistina: float, rocni_sazba: float, n_mesicu: int) -> float:
        if rocni_sazba <= 0 or n_mesicu <= 0:
            return jistina / max(n_mesicu, 1)
        i = rocni_sazba / 12.0
        return jistina * i / (1.0 - (1.0 + i) ** (-n_mesicu))

    @staticmethod
    def _anuita_jistina(splatka: float, rocni_sazba: float, n_mesicu: int) -> float:
        if splatka <= 0:
            return 0.0
        if rocni_sazba <= 0:
            return splatka * n_mesicu
        i = rocni_sazba / 12.0
        return splatka * (1.0 - (1.0 + i) ** (-n_mesicu)) / i

    def _vyber_sazbu(self, bank: dict, fixace: int, ltv: float) -> tuple[float, str]:
        """Najde nejblizsi dostupnou fixaci a vrati (sazba, puvod)."""
        sazby = bank.get("sazby", [])
        if not sazby:
            return 0.05, "estimate"
        # Presna shoda fixace
        for s in sazby:
            if s["fixace_roky"] == fixace and ltv <= s["ltv_do"]:
                base = s["sazba"]
                # Prirazka nad LTV 80 %
                if ltv > 0.80:
                    base += bank.get("ltv_prirazka_nad_80", 0.0)
                return base, s.get("puvod", "estimate")
        # Nejblizsi vyssi fixace
        cand = sorted(sazby, key=lambda x: abs(x["fixace_roky"] - fixace))
        s = cand[0]
        base = s["sazba"]
        if ltv > 0.80:
            base += bank.get("ltv_prirazka_nad_80", 0.0)
        return base, s.get("puvod", "estimate")

    def _max_ltv_bank(self, bank: dict, profile: CustomerProfile) -> float:
        """Max LTV pro danou banku a profil zakaznika (zohledni vek a ucel)."""
        # CNB pravidla maji prednost — pouzijeme prusek s limitem banky
        cnb_ltv = self.cnb["ltv"]
        if profile.ucel == "investicni":
            cnb_max = cnb_ltv["investicni_nemovitost"]["max"]
        else:
            cnb_max = (
                cnb_ltv["vlastni_bydleni"]["max_do_36_let"]
                if profile.vek <= 36
                else cnb_ltv["vlastni_bydleni"]["max"]
            )
        bank_max = bank.get("ltv_max", 0.90)
        return min(cnb_max, bank_max)

    # ---- Per-banka vypocet ----
    def _spocti_banku(self, bank: dict, profile: CustomerProfile) -> BankResult:
        poznamky: list[str] = []
        n = profile.splatnost_roky * 12

        # 1) LTV omezeni
        max_ltv = self._max_ltv_bank(bank, profile)
        max_uver_ltv = profile.hodnota_nemovitosti * max_ltv
        # Pozadovany uver z hodnoty nemovitosti minus vlastni zdroje
        pozadovany_uver = max(0.0, profile.hodnota_nemovitosti - profile.vlastni_zdroje)
        uver_dle_ltv = min(max_uver_ltv, pozadovany_uver if pozadovany_uver > 0 else max_uver_ltv)

        # Skutecne LTV pro vyber sazby
        skutecne_ltv = (
            uver_dle_ltv / profile.hodnota_nemovitosti if profile.hodnota_nemovitosti > 0 else 0
        )

        # 2) Sazba podle banky / fixace / LTV
        sazba, sazba_puvod = self._vyber_sazbu(bank, profile.fixace_roky, skutecne_ltv)

        # 3) DSTI omezeni (interni limit banky)
        dsti_limit = bank.get("interni_dsti_limit", 0.45)
        max_splatka_dsti = (
            profile.cisty_prijem_mesicne * dsti_limit - profile.stavajici_splatky_mesicne
        )
        max_splatka_dsti = max(0.0, max_splatka_dsti)
        uver_dle_dsti = self._anuita_jistina(max_splatka_dsti, sazba, n)

        # 4) DTI omezeni (interni limit banky)
        dti_limit = bank.get("interni_dti_limit", 8)
        rocni_prijem = profile.cisty_prijem_mesicne * 12
        max_dluh_dti = rocni_prijem * dti_limit
        # Snizit o stavajici dluh (hruba aproximace pres rocni splatky)
        stavajici_dluh_aprox = profile.stavajici_splatky_mesicne * 12 * 5
        uver_dle_dti = max(0.0, max_dluh_dti - stavajici_dluh_aprox)

        # ---- Vyber minimum a urc limitujici faktor ----
        kandidati = {
            "LTV": uver_dle_ltv,
            "DSTI": uver_dle_dsti,
            "DTI": uver_dle_dti,
        }
        limiting_factor = min(kandidati, key=kandidati.get)
        max_loan = max(0.0, kandidati[limiting_factor])

        # Pokud pozadovany uver je nizsi nez vsechna omezeni, je limitujici "ZADOST"
        if pozadovany_uver > 0 and pozadovany_uver < max_loan:
            max_loan = pozadovany_uver
            limiting_factor = "ZADOST"

        max_monthly = self._anuita_splatka(max_loan, sazba, n)

        # Priznak estimate (interni limity banky)
        is_estimate = (
            bank.get("puvod_interni_limity") == "estimate"
            or sazba_puvod == "estimate"
        )

        if bank.get("puvod_interni_limity") == "estimate":
            poznamky.append("Interni DSTI/DTI limity banky jsou odhad — overit u banky.")
        if sazba_puvod == "estimate":
            poznamky.append("Sazba prevzata z prehledoveho zdroje — overit na webu banky.")
        if profile.vek > 36 and profile.ucel == "vlastni_bydleni":
            poznamky.append("Vek nad 36 let: maximalni LTV 80 %.")

        return BankResult(
            bank_id=bank["id"],
            bank_nazev=bank["nazev"],
            max_loan=round(max_loan, -3),
            max_monthly_payment=round(max_monthly, 0),
            sazba=sazba,
            sazba_puvod=sazba_puvod,
            limiting_factor=limiting_factor,  # type: ignore
            is_estimate=is_estimate,
            ltv_pouzite=round(skutecne_ltv, 4),
            pozadovany_uver=round(pozadovany_uver, -3),
            podminky_slev=bank.get("slevy_podminky", ""),
            poznamky=poznamky,
        )

    # ---- Verejny vstup ----
    def calculate(self, profile: CustomerProfile) -> CalculationResult:
        per_bank = [self._spocti_banku(b, profile) for b in self.banks]
        nejlepsi = max(per_bank, key=lambda r: r.max_loan) if per_bank else None

        upozorneni = [
            "Vypocet je predbezny odhad. Zavazne podminky urci banka po posouzeni.",
            "Interni DSTI/DTI limity bank jsou odhad (puvod=estimate) — overit u kazde banky.",
            "CNB ma od 2024 DSTI a DTI pro standardni bydleni deaktivovane — zavazny je jen LTV.",
        ]

        return CalculationResult(
            max_loan=nejlepsi.max_loan if nejlepsi else 0,
            max_monthly_payment=nejlepsi.max_monthly_payment if nejlepsi else 0,
            limiting_factor=nejlepsi.limiting_factor if nejlepsi else "LTV",
            per_bank=per_bank,
            profile_echo=profile,
            upozorneni=upozorneni,
        )


# -------- FastAPI app --------
app = FastAPI(title="FinPoradce API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/banks")
def banks_metadata() -> dict:
    """Vrati seznam bank (bez interniho scoringu) pro frontend."""
    data = load_banks()
    return {
        "banky": [
            {"id": b["id"], "nazev": b["nazev"]}
            for b in data["banky"]
        ]
    }


@app.post("/api/calculate", response_model=CalculationResult)
def calculate(profile: CustomerProfile) -> CalculationResult:
    try:
        banks_data = load_banks()
        cnb_rules = load_cnb_rules()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Chybi datovy soubor: {e}")

    calc = BonitaCalculator(banks_data=banks_data, cnb_rules=cnb_rules)
    return calc.calculate(profile)
