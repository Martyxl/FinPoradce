"use client";

import { useEffect, useState } from "react";

/**
 * Prepinac dark/light. Vychozi je DARK (FinSei design); volba se uklada
 * do sessionStorage a aplikuje az po mountu — SSR vzdy renderuje dark,
 * zadny hydration mismatch.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      if (sessionStorage.getItem("theme") === "light") {
        setTheme("light");
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {
      // private mode — ignorujeme
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      sessionStorage.setItem("theme", next);
    } catch {
      // ignorujeme
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"
      }
      title={theme === "dark" ? "Světlý režim" : "Tmavý režim"}
    >
      {theme === "dark" ? "◐" : "◑"}
    </button>
  );
}
