import HypoForm from "@/components/HypoForm";

export default function HomePage() {
  return (
    <>
      <h1>Orientační výpočet hypotéky</h1>
      <p className="lead">
        Vyplňte pár údajů a uvidíte, na jakou výši hypotéky předběžně dosáhnete
        u Komerční banky, Air Bank a České spořitelny. Výpočet je informativní,
        bez prodejního tlaku a bez nutnosti zanechat kontakt.
      </p>
      <HypoForm />
    </>
  );
}
