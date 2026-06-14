import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import RychlaAnalyza from "@/components/RychlaAnalyza";
import { najdiPotrebu } from "@/lib/potreby";

const CIL_PLACEHOLDER: Record<string, string> = {
  zajisteni: "např. ochránit příjem rodiny, mám malé děti a hypotéku",
  sporeni: "např. našetřit na byt za 10 let, mám rezervu 100 tis.",
};

export function generateStaticParams() {
  return [{ typ: "zajisteni" }, { typ: "sporeni" }];
}

export default function PotrebaPage({ params }: { params: { typ: string } }) {
  const def = najdiPotrebu(params.typ);
  if (!def) notFound();
  // Bydleni ma vlastni dedikovany tok
  if (def.id === "bydleni") redirect("/kalkulacka");

  return (
    <AppShell>
      <RychlaAnalyza
        potreba={def.id as "zajisteni" | "sporeni"}
        nadpis={def.nazev}
        cilPlaceholder={CIL_PLACEHOLDER[def.id] ?? ""}
      />
    </AppShell>
  );
}
