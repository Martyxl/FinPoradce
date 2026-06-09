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


# -------- Datovy model: stavajici produkt klienta --------
ProduktKategorie = Literal[
    # Uvery
    "hypoteka_jina",
    "spotrebitelsky_uver",
    "leasing",
    "kreditni_karta",
    # Sporeni a investice
    "stavebni_sporeni",
    "dps",
    "dip",
    "investice",
    "sporici_ucet",
    # Pojisteni
    "zp_rizikove",
    "zp_investicni",
    "zp_kapitalove",
    "urazove",
    "schopnost_splacet",
    "poj_nemovitosti",
    "poj_domacnosti",
    "poj_odpovednosti",
]


class ExistingProduct(BaseModel):
    """Stavajici produkt klienta. instituce a nazev jsou volitelne,
    mesicni_castka je vzdy povinna (vklad/splatka/pojistne)."""
    kategorie: ProduktKategorie
    instituce_id: str | None = None
    nazev_produktu: str | None = None
    mesicni_castka_czk: float = Field(gt=0, description="Pravidelna mesicni castka v CZK")


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
    existujici_produkty: list[ExistingProduct] = Field(
        default_factory=list,
        description="Volitelny seznam stavajicich produktu klienta pro pozdejsi recommendation engine.",
    )


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


DoporuceniKategorie = Literal["CHYBI", "NEOPTIMALNI", "OK", "UPOZORNENI"]


class Doporuceni(BaseModel):
    """Strukturovane doporuceni pro chytre zajisteni klienta.

    kategorie:
      - CHYBI       = nema, doporucujeme sjednat
      - NEOPTIMALNI = ma, ale lepe vymenit / upravit
      - OK          = ma a je v poradku
      - UPOZORNENI  = obecne upozorneni (napr. drahy produkt)
    """
    id: str
    kategorie: DoporuceniKategorie
    priorita: int = Field(ge=1, le=5, description="1 = nejvyssi priorita")
    nadpis: str
    popis: str
    proc: list[str] = Field(default_factory=list)
    doporucena_akce: str | None = None
    doporucena_castka_czk: float | None = None
    souvisejici_kategorie_produktu: list[str] = Field(default_factory=list)


class CalculationResult(BaseModel):
    max_loan: float
    max_monthly_payment: float
    limiting_factor: str
    per_bank: list[BankResult]
    profile_echo: CustomerProfile
    upozorneni: list[str]
    doporuceni: list[Doporuceni] = Field(default_factory=list)


# -------- Nacitani dat --------
def load_banks() -> dict:
    with open(DATA_DIR / "banks.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_cnb_rules() -> dict:
    with open(DATA_DIR / "cnb_rules.json", "r", encoding="utf-8") as f:
        return json.load(f)


def load_instituce() -> dict:
    with open(DATA_DIR / "instituce.json", "r", encoding="utf-8") as f:
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


# -------- IZOLOVANY DOPORUCOVACI MODUL --------
class RecommendationEngine:
    """Izolovany modul doporuceni "chytreho zajisteni" na zaklade stavajicich
    produktu klienta a parametru hypoteky. Pro pozdejsi nahrazeni pokrocilejsim
    pravidlovym systemem (nebo ML modelem) staci implementovat stejne rozhrani.

    Verejne rozhrani:
      evaluate(profile, calculation) -> list[Doporuceni]
    """

    def __init__(self) -> None:
        pass

    # ---- Pomocne ----
    @staticmethod
    def _najdi_produkt(profile: CustomerProfile, kategorie: str) -> ExistingProduct | None:
        for p in profile.existujici_produkty:
            if p.kategorie == kategorie:
                return p
        return None

    @staticmethod
    def _ma_jakoukoliv(profile: CustomerProfile, kategorie_list: list[str]) -> bool:
        return any(p.kategorie in kategorie_list for p in profile.existujici_produkty)

    # ---- Pravidla ----
    def _pravidlo_rzp_k_hypotece(
        self, profile: CustomerProfile, calc: CalculationResult
    ) -> Doporuceni:
        ma_komplexni_zp = self._ma_jakoukoliv(
            profile, ["zp_rizikove", "zp_investicni", "zp_kapitalove"]
        )
        schopnost_splacet = self._najdi_produkt(profile, "schopnost_splacet")
        doporucena_pc = calc.max_loan if calc.max_loan > 0 else 0.0

        if ma_komplexni_zp:
            return Doporuceni(
                id="rzp_k_hypotece",
                kategorie="OK",
                priorita=1,
                nadpis="Životní pojištění k hypotéce máte",
                popis=(
                    "Máte komplexní životní pojištění, které kryje výpadek "
                    "příjmu při neočekávané události."
                ),
                proc=[
                    "Ověřte, že pojistná částka pro případ smrti pokrývá výši hypotéky.",
                    "Ideálně klesající pojistná částka odpovídající zůstatku úvěru — pojistné je v čase nižší.",
                    "Pojistka není vázaná na konkrétní banku → při refinancování ji ponecháte.",
                ],
                doporucena_castka_czk=doporucena_pc,
                souvisejici_kategorie_produktu=[
                    "zp_rizikove",
                    "zp_investicni",
                    "zp_kapitalove",
                ],
            )

        if schopnost_splacet is not None:
            return Doporuceni(
                id="rzp_k_hypotece",
                kategorie="NEOPTIMALNI",
                priorita=1,
                nadpis="Pojištění schopnosti splácet — lepší je nezávislé rizikové ŽP",
                popis=(
                    "Pojištění schopnosti splácet od banky kryje jen tuto jednu "
                    "hypotéku a v poměru cena/krytí je obvykle horší než "
                    "samostatné rizikové životní pojištění."
                ),
                proc=[
                    "Bankovní pojistka zaniká při refinancování — zaplacené pojistné se vám nikam nepřevádí.",
                    "Komplexní rizikové ŽP kryje smrt, invaliditu I.–III. stupně, vážná onemocnění i pracovní neschopnost — ne jen splátku úvěru.",
                    "Rizikové ŽP s klesající pojistnou částkou kopíruje zůstatek hypotéky → pojistné v čase klesá.",
                    "Hypotéka je dlouhodobý závazek (25–30 let). Komplexní pojistka chrání celou rodinu, ne jen tento jeden úvěr.",
                ],
                doporucena_akce=(
                    "Nahradit pojištění schopnosti splácet samostatným rizikovým "
                    "životním pojištěním s klesající pojistnou částkou ve výši hypotéky."
                ),
                doporucena_castka_czk=doporucena_pc,
                souvisejici_kategorie_produktu=["schopnost_splacet", "zp_rizikove"],
            )

        # Klient nema zadne ZP
        return Doporuceni(
            id="rzp_k_hypotece",
            kategorie="CHYBI",
            priorita=1,
            nadpis="Chytré zajištění hypotéky: rizikové životní pojištění",
            popis=(
                "K hypotéce je životní pojištění zásadní. Místo bankovního "
                "„pojištění schopnosti splácet" doporučujeme komplexní rizikové "
                "životní pojištění od nezávislé pojišťovny."
            ),
            proc=[
                "Hypotéka je závazek na 25–30 let. Vážná nemoc, úraz nebo úmrtí mohou rodině znemožnit splácení.",
                "Banka nabídne „pojištění schopnosti splácet". To je vázané jen na tento úvěr, dražší v poměru ke krytí a zaniká při refinancování.",
                "Komplexní rizikové ŽP kryje smrt, invaliditu I.–III. stupně, vážná onemocnění a pracovní neschopnost. Není vázané na konkrétní banku.",
                "Doporučená pojistná částka odpovídá výši hypotéky a klesá s tím, jak ji splácíte → pojistné v čase nižší.",
            ],
            doporucena_akce=(
                "Sjednat samostatné rizikové životní pojištění s klesající "
                "pojistnou částkou ve výši hypotéky a klesajícím profilem dle splátkového kalendáře."
            ),
            doporucena_castka_czk=doporucena_pc,
            souvisejici_kategorie_produktu=["zp_rizikove"],
        )

    def _pravidlo_pojisteni_nemovitosti(
        self, profile: CustomerProfile, calc: CalculationResult
    ) -> Doporuceni:
        if self._najdi_produkt(profile, "poj_nemovitosti"):
            return Doporuceni(
                id="pojisteni_nemovitosti",
                kategorie="OK",
                priorita=2,
                nadpis="Pojištění nemovitosti máte",
                popis="Pojištění nemovitosti splňuje podmínku banky pro čerpání hypotéky.",
                proc=[
                    "Ověřte, že pojistná částka odpovídá aktuální reprodukční (nové) hodnotě nemovitosti, ne tržní ceně.",
                    "Bance je třeba dodat vinkulaci pojistného plnění ve prospěch hypotečního úvěru.",
                ],
                souvisejici_kategorie_produktu=["poj_nemovitosti"],
            )
        return Doporuceni(
            id="pojisteni_nemovitosti",
            kategorie="CHYBI",
            priorita=2,
            nadpis="Pojištění nemovitosti — povinné pro čerpání hypotéky",
            popis="Banka pojištění nemovitosti vyžaduje jako zástavu k úvěru. Bez něj peníze neuvolní.",
            proc=[
                "Pojistná částka by měla odpovídat reprodukční (nové) hodnotě nemovitosti, ne tržní ceně.",
                "Vinkulace ve prospěch banky je standardní požadavek.",
                "I bez hypotéky chrání majetek proti živelním událostem (oheň, voda, vichřice).",
            ],
            doporucena_akce="Sjednat pojištění nemovitosti s pojistnou částkou rovnou hodnotě nemovitosti.",
            doporucena_castka_czk=profile.hodnota_nemovitosti,
            souvisejici_kategorie_produktu=["poj_nemovitosti"],
        )

    def _pravidlo_pojisteni_domacnosti(
        self, profile: CustomerProfile, calc: CalculationResult
    ) -> Doporuceni | None:
        if self._najdi_produkt(profile, "poj_domacnosti"):
            return None  # neuvadime OK pro vsechno
        return Doporuceni(
            id="pojisteni_domacnosti",
            kategorie="CHYBI",
            priorita=3,
            nadpis="Pojištění domácnosti — vybavení a movitý majetek",
            popis=(
                "Pojištění nemovitosti kryje budovu, ale ne vybavení. "
                "Pojištění domácnosti kryje nábytek, elektroniku, oblečení a další "
                "movitý majetek proti krádeži, požáru a vodě."
            ),
            proc=[
                "Často se kombinuje s pojištěním nemovitosti u stejné pojišťovny se slevou.",
                "Pojistná částka by měla odpovídat odhadní hodnotě vybavení (typicky 300–800 tis. Kč).",
            ],
            doporucena_akce="Sjednat pojištění domácnosti (typicky v balíčku s pojištěním nemovitosti).",
            souvisejici_kategorie_produktu=["poj_domacnosti"],
        )

    def _pravidlo_pojisteni_odpovednosti(
        self, profile: CustomerProfile, calc: CalculationResult
    ) -> Doporuceni | None:
        if self._najdi_produkt(profile, "poj_odpovednosti"):
            return None
        return Doporuceni(
            id="pojisteni_odpovednosti",
            kategorie="CHYBI",
            priorita=3,
            nadpis="Pojištění odpovědnosti za škodu",
            popis=(
                "Kryje škody, které způsobíte třetí osobě (zdraví nebo na majetku). "
                "Levné pojištění s vysokým potenciálním dopadem."
            ),
            proc=[
                "Roční pojistné typicky 1–3 tis. Kč, krytí v řádu milionů.",
                "Bez něj může jedna nehoda (např. způsobená dětmi nebo psem) finančně zničit rodinu.",
            ],
            doporucena_akce="Sjednat pojištění odpovědnosti za škodu v běžném životě, ideálně s limitem 5–10 mil. Kč.",
            souvisejici_kategorie_produktu=["poj_odpovednosti"],
        )

    def _pravidlo_dps(
        self, profile: CustomerProfile, calc: CalculationResult
    ) -> Doporuceni | None:
        if profile.vek >= 60:
            return None
        dps = self._najdi_produkt(profile, "dps")
        if dps is None:
            return Doporuceni(
                id="dps",
                kategorie="CHYBI",
                priorita=4,
                nadpis="Doplňkové penzijní spoření (III. pilíř)",
                popis=(
                    "Stát přispívá až 340 Kč/měs (4 080 Kč/rok) k vašemu vkladu. "
                    "Jeden z nejlepších „lehkých" produktů na zajištění na penzi."
                ),
                proc=[
                    "Státní příspěvek 20 % z vlastního vkladu, max. 340 Kč/měs při vkladu 1 700 Kč/měs.",
                    "Vklady nad 1 700 Kč/měs jsou daňově odčitatelné (společný limit 48 000 Kč/rok s ŽP, DIP a poj. dlouhodobé péče).",
                    "Příspěvek zaměstnavatele je osvobozen od daně a odvodů do 50 000 Kč/rok — využijte, pokud nabízí.",
                ],
                doporucena_akce="Sjednat DPS u penzijní společnosti a vkládat min. 1 700 Kč/měs pro maximální státní příspěvek.",
                doporucena_castka_czk=1700,
                souvisejici_kategorie_produktu=["dps"],
            )
        if dps.mesicni_castka_czk < 1700:
            return Doporuceni(
                id="dps",
                kategorie="NEOPTIMALNI",
                priorita=4,
                nadpis="DPS — vkládáte méně než pro maximální státní příspěvek",
                popis=(
                    f"Vkládáte {int(dps.mesicni_castka_czk)} Kč/měs. Maximální státní "
                    "příspěvek 340 Kč/měs získáte při vkladu 1 700 Kč/měs."
                ),
                proc=[
                    "Stát přispívá 20 % z vašeho vkladu, max. 340 Kč/měs (4 080 Kč/rok).",
                    "Navýšení vkladu z dnešní úrovně na 1 700 Kč/měs přidá až 340 Kč státního příspěvku každý měsíc.",
                ],
                doporucena_akce="Navýšit vlastní vklad na 1 700 Kč/měs pro maximum státního příspěvku.",
                doporucena_castka_czk=1700,
                souvisejici_kategorie_produktu=["dps"],
            )
        return Doporuceni(
            id="dps",
            kategorie="OK",
            priorita=4,
            nadpis="DPS s maximálním státním příspěvkem",
            popis="Vkládáte dostatečně pro plné využití státního příspěvku 340 Kč/měs.",
            proc=[
                "Při vyšších vkladech zvažte daňový odpočet (společný limit 48 000 Kč/rok).",
            ],
            souvisejici_kategorie_produktu=["dps"],
        )

    def _pravidlo_investicni_zp_warning(
        self, profile: CustomerProfile, calc: CalculationResult
    ) -> Doporuceni | None:
        if not self._najdi_produkt(profile, "zp_investicni"):
            return None
        return Doporuceni(
            id="investicni_zp_warning",
            kategorie="UPOZORNENI",
            priorita=3,
            nadpis="Investiční životní pojištění (IŽP) — zvažte rozdělení",
            popis=(
                "IŽP kombinuje pojištění s investováním, ale obvykle za cenu "
                "vysokých poplatků. Investiční složka často tvoří jen 10–15 % "
                "z toho, co platíte."
            ),
            proc=[
                "Levnější varianta: samostatné rizikové ŽP + samostatný DIP nebo podílový fond.",
                "Při zachování stejného krytí a vyšší investiční složky často získáte více.",
                "Tuto úvahu doporučujeme zkonzultovat nezávisle (mimo banku a mimo pojišťovnu).",
            ],
            doporucena_akce="Spočítat, zda by rozdělení na samostatné rizikové ŽP + DIP nebylo výhodnější.",
            souvisejici_kategorie_produktu=["zp_investicni", "zp_rizikove", "dip"],
        )

    # ---- Verejne rozhrani ----
    def evaluate(
        self, profile: CustomerProfile, calculation: CalculationResult
    ) -> list[Doporuceni]:
        kandidati: list[Doporuceni | None] = [
            self._pravidlo_rzp_k_hypotece(profile, calculation),
            self._pravidlo_pojisteni_nemovitosti(profile, calculation),
            self._pravidlo_pojisteni_domacnosti(profile, calculation),
            self._pravidlo_pojisteni_odpovednosti(profile, calculation),
            self._pravidlo_dps(profile, calculation),
            self._pravidlo_investicni_zp_warning(profile, calculation),
        ]
        # Razeni: CHYBI a NEOPTIMALNI nahoru, OK dolu; v ramci skupiny dle priority
        order = {"CHYBI": 0, "NEOPTIMALNI": 1, "UPOZORNENI": 2, "OK": 3}
        result = [d for d in kandidati if d is not None]
        result.sort(key=lambda d: (order.get(d.kategorie, 9), d.priorita))
        return result


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


@app.get("/api/instituce")
def instituce_seznam() -> dict:
    """Vrati plochy seznam vsech retailovych instituci pro vyber v formulari.

    Kazda instituce ma id, nazev a typ (banka_velka, banka_mensi,
    stavebni_sporitelna, pojistovna, penzijni_spolecnost). Frontend
    filtruje podle typu pro konkretni kategorii produktu.
    """
    data = load_instituce()
    flat: list[dict] = []
    skupiny = [
        ("banky_velke_univerzalni", "banka_velka"),
        ("banky_mensi_specializovane", "banka_mensi"),
        ("stavebni_sporitelny", "stavebni_sporitelna"),
        ("pojistovny", "pojistovna"),
        ("penzijni_spolecnosti", "penzijni_spolecnost"),
    ]
    for skupina_klic, default_typ in skupiny:
        for inst in data.get(skupina_klic, []):
            flat.append(
                {
                    "id": inst["id"],
                    "nazev": inst["nazev"],
                    "typ": inst.get("typ", default_typ),
                }
            )
    return {"instituce": flat}


@app.post("/api/calculate", response_model=CalculationResult)
def calculate(profile: CustomerProfile) -> CalculationResult:
    try:
        banks_data = load_banks()
        cnb_rules = load_cnb_rules()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"Chybi datovy soubor: {e}")

    calc = BonitaCalculator(banks_data=banks_data, cnb_rules=cnb_rules)
    result = calc.calculate(profile)

    # Doporuceni "chytreho zajisteni" - izolovany modul, lze nahradit
    engine = RecommendationEngine()
    result.doporuceni = engine.evaluate(profile, result)

    return result
