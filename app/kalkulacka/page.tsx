import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import HypoForm from "@/components/HypoForm";

export const metadata: Metadata = {
  title: "FinSei — analýza hypotéky",
};

export default function KalkulackaPage() {
  return (
    <AppShell>
      <h1>Nezávislá analýza hypotéky</h1>
      <p className="lead">
        Vyplňte pár údajů a uvidíte, na jakou výši hypotéky předběžně
        dosáhnete u 10 bank — včetně doporučení, kde máte mezery v zajištění.
        Bez prodejního tlaku a bez nutnosti zanechat kontakt.
      </p>
      <HypoForm />
    </AppShell>
  );
}
