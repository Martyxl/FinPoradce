import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "FinSei — podmínky a ochrana údajů",
};

export default function PodminkyPage() {
  return (
    <AppShell>
      <h1>Podmínky použití a ochrana údajů</h1>
      <p className="lead">
        Naposledy aktualizováno: červen 2026. Tento dokument je informativní
        shrnutí, ne náhrada za úplné obchodní podmínky před ostrým provozem.
      </p>

      <h2>Co FinSei je — a co není</h2>
      <p>
        FinSei je <strong>informativní nástroj</strong>, který z údajů, jež
        zadáte, spočítá orientační odhad způsobilosti na hypotéku a doporučí
        oblasti zajištění. Výpočty a doporučení jsou <strong>předběžné odhady
        </strong> založené na veřejně dostupných a odhadovaných datech
        (snapshot sazeb jaro 2026, interní limity bank jsou odhad).
      </p>
      <p>
        <strong>FinSei není licencovaný finanční poradce</strong> ani
        zprostředkovatel podle zákona č. 257/2016 Sb. a poskytnuté informace
        nejsou investičním, daňovým ani právním poradenstvím. Závazné podmínky
        vždy určí konkrétní banka, pojišťovna nebo jiná instituce po vlastním
        posouzení. Před uzavřením jakékoli smlouvy si ověřte aktuální podmínky
        přímo u dané instituce nebo u licencovaného poradce.
      </p>

      <h2>Jaké údaje zpracováváme</h2>
      <p>
        Údaje z formuláře (příjem, věk, hodnota nemovitosti, stávající
        produkty apod.) se zpracovávají <strong>výhradně pro výpočet</strong>{" "}
        a zobrazení výsledku ve vašem prohlížeči. Ukládají se{" "}
        <strong>lokálně u vás</strong> (localStorage pro rozpracovaný
        formulář, sessionStorage pro výsledek a volbu světlého/tmavého
        režimu). Tato data <strong>neodesíláme ani neukládáme na server</strong>{" "}
        a nesdílíme je s třetími stranami.
      </p>
      <p>
        Výjimka 1: funkce <strong>„Co doporučuje AI?"</strong> odešle
        anonymizovaný profil (bez jména, kontaktu či IP nad rámec technicky
        nutného) ke zpracování modelem Claude (Anthropic) pro sestavení
        balíčků. Tento přenos proběhne jen na vaše vyžádání kliknutím na
        tlačítko.
      </p>
      <p>
        Výjimka 2: pokud sami zvolíte <strong>„Chci to probrat s poradcem"</strong>{" "}
        a udělíte souhlas, odešleme váš e-mail (a volitelně jméno, telefon,
        poznámku) spolu se shrnutím výpočtu nezávislému poradci za účelem
        kontaktu. Tento krok je <strong>výhradně dobrovolný</strong> a údaje se
        použijí jen pro vaše oslovení a navazující poradenství; souhlas můžete
        kdykoli odvolat na kontaktu uvedeném v komunikaci.
      </p>

      <h2>Cookies a úložiště</h2>
      <p>
        Používáme pouze <strong>technické úložiště prohlížeče</strong> nezbytné
        pro fungování (draft formuláře, volba režimu). Nepoužíváme analytické,
        marketingové ani sledovací cookies a nenasazujeme skripty třetích
        stran pro profilování. Uložená data můžete kdykoli smazat vymazáním dat
        webu v prohlížeči.
      </p>

      <h2>Odpovědnost</h2>
      <p>
        FinSei nenese odpovědnost za rozhodnutí učiněná na základě
        orientačních výpočtů. Sazby a podmínky produktů se mění; data jsou
        snapshot a mohou být neaktuální. Vždy ověřte u zdroje.
      </p>
    </AppShell>
  );
}
