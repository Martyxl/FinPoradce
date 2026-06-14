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
        Cílem FinSei je pomoci vám <strong>mít osobní finance pod kontrolou
        bez zbytečných provizí</strong>. Klasický zprostředkovatel je placený
        provizí od banky či pojišťovny, a má tak motivaci doporučit produkt
        s nejvyšší provizí — ne ten nejvýhodnější pro vás. FinSei tenhle střet
        zájmů odstraňuje: porovnává <strong>celý trh</strong> (hypotéky,
        pojištění, investice i penzi) a doporučuje podle dat to, co se vyplatí
        vám, ne poradci podle výše provize.
      </p>
      <p>
        Výpočet hypotéky je jen vstupní bod. FinSei je{" "}
        <strong>informativní nástroj a přehled</strong> napříč vašimi
        financemi — orientační odhady způsobilosti, mezery v zajištění a
        návrhy řešení. Všechny výpočty a doporučení jsou{" "}
        <strong>předběžné odhady</strong> založené na veřejně dostupných a
        odhadovaných datech (snapshot sazeb jaro 2026, interní limity bank jsou
        odhad).
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

      <h2>Ochrana osobních údajů (GDPR)</h2>
      <p>
        Zpracování osobních údajů se řídí nařízením Evropského parlamentu a
        Rady (EU) 2016/679 (<strong>GDPR</strong>) a zákonem č. 110/2019 Sb.,
        o zpracování osobních údajů. Většina dat zůstává jen ve vašem
        prohlížeči (viz výše) — k předání osobních údajů dochází pouze ve
        dvou dobrovolných případech: při použití funkce „Co doporučuje AI?"
        (anonymizovaný profil) a při vyžádání kontaktu poradcem (e-mail a
        volitelné kontaktní údaje).
      </p>

      <h3>Správce údajů</h3>
      <p>
        Správcem je provozovatel FinSei{" "}
        <strong>[DOPLNIT: obchodní firma / jméno, IČO, sídlo]</strong>.
        Kontakt pro uplatnění práv a dotazy k ochraně údajů:{" "}
        <strong>[DOPLNIT: kontaktní e-mail]</strong>. Pověřence pro ochranu
        osobních údajů (DPO) nemáme jmenovaného — nejsme orgán veřejné moci ani
        nezpracováváme údaje ve velkém rozsahu jako hlavní činnost.
      </p>

      <h3>Účel, právní základ a doba uchování</h3>
      <ul className="gdpr-list">
        <li>
          <strong>AI doporučení balíčků</strong> — účel: sestavení návrhu
          řešení na vaše vyžádání; právní základ: souhlas / provedení úkonu na
          vaši žádost (čl. 6 odst. 1 písm. a/b GDPR); rozsah: anonymizovaný
          profil bez jména a kontaktu; doba: zpracováno jednorázově, na serveru
          neukládáme (dočasná cache výsledku max. 24 hodin podle nastavení
          výpočtu).
        </li>
        <li>
          <strong>Předání poradci</strong> — účel: kontaktování a navazující
          poradenství; právní základ: váš výslovný souhlas (čl. 6 odst. 1 písm.
          a GDPR); rozsah: e-mail, volitelně jméno, telefon, poznámka a shrnutí
          výpočtu; doba: po dobu vyřízení poptávky, nejdéle do odvolání
          souhlasu.
        </li>
        <li>
          <strong>Technické úložiště v prohlížeči</strong> — účel: funkčnost
          (rozpracovaný formulář, volba režimu); právní základ: oprávněný zájem
          / nezbytné technické úložiště; data neopouštějí vaše zařízení.
        </li>
      </ul>

      <h3>Příjemci a předání mimo EU</h3>
      <p>
        Při AI funkci je zpracovatelem společnost{" "}
        <strong>Anthropic</strong> (poskytovatel modelu Claude); přenos může
        zahrnovat zpracování mimo EU na základě standardních smluvních doložek.
        E-mail poradci doručujeme přes službu pro odesílání e-mailů
        (zpracovatel). Údaje <strong>neprodáváme</strong> a nepředáváme je pro
        marketing třetích stran.
      </p>

      <h3>Vaše práva</h3>
      <p>Jako subjekt údajů máte podle GDPR právo na:</p>
      <ul className="gdpr-list">
        <li><strong>přístup</strong> k údajům a informaci, zda je zpracováváme;</li>
        <li><strong>opravu</strong> nepřesných údajů;</li>
        <li><strong>výmaz</strong> („právo být zapomenut");</li>
        <li><strong>omezení zpracování</strong>;</li>
        <li><strong>přenositelnost</strong> údajů ve strojově čitelném formátu;</li>
        <li><strong>vznést námitku</strong> proti zpracování;</li>
        <li>
          <strong>odvolat souhlas</strong> kdykoli (odvolání nemá vliv na
          zákonnost zpracování před odvoláním);
        </li>
        <li>
          podat <strong>stížnost u dozorového úřadu</strong> — Úřad pro ochranu
          osobních údajů, Pplk. Sochora 27, 170 00 Praha 7,{" "}
          <a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">
            uoou.gov.cz
          </a>
          .
        </li>
      </ul>
      <p>
        Práva uplatníte na kontaktu správce uvedeném výše. Souhlas s předáním
        poradci lze odvolat i prostým e-mailem.
      </p>

      <p className="hint" style={{ marginTop: 24 }}>
        Pasáže označené <strong>[DOPLNIT]</strong> je nutné před ostrým provozem
        nahradit reálnými údaji provozovatele.
      </p>
    </AppShell>
  );
}
