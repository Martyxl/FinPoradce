"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Jednoducha cookie/GDPR lista. Aplikace pouziva POUZE technicke uloziste
 * (localStorage pro draft formulare, sessionStorage pro theme a vysledky) —
 * zadne analytics, zadne tracking cookies, zadne treti strany. Proto staci
 * informativni lista s potvrzenim, ne granularni consent management.
 */
export default function CookieLista() {
  const [zobrazit, setZobrazit] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("cookieSouhlas.v1") !== "1") {
        setZobrazit(true);
      }
    } catch {
      // private mode — neukazuj listu (nemohli bychom ji ani schovat)
    }
  }, []);

  function potvrdit() {
    try {
      localStorage.setItem("cookieSouhlas.v1", "1");
    } catch {
      /* ignore */
    }
    setZobrazit(false);
  }

  if (!zobrazit) return null;

  return (
    <div className="cookie-lista" role="dialog" aria-label="Informace o cookies">
      <p>
        Tato aplikace ukládá data <strong>jen ve vašem prohlížeči</strong>
        {" "}(rozpracovaný formulář, volba režimu) pro vaše pohodlí. Nepoužíváme
        analytické ani sledovací cookies a nesdílíme nic s třetími stranami.{" "}
        <Link href="/podminky">Podmínky a ochrana údajů</Link>.
      </p>
      <button type="button" className="btn" onClick={potvrdit}>
        Rozumím
      </button>
    </div>
  );
}
