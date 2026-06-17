"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatPanel, { CHAT_QUERY_KEY } from "@/components/ChatPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoLockup } from "@/components/Logo";

export default function ChatPage() {
  const [query, setQuery] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const q = sessionStorage.getItem(CHAT_QUERY_KEY);
      if (q) {
        sessionStorage.removeItem(CHAT_QUERY_KEY);
        setQuery(q);
      }
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  return (
    <div className="chat-pg-wrap">
      <header className="chat-pg-header">
        <Link href="/" className="ld-logo">
          <LogoLockup orbSize={42} />
        </Link>
        <div className="chat-pg-header-right">
          <ThemeToggle />
          <Link href="/" className="btn secondary chat-pg-zpet">
            ← Zpět
          </Link>
        </div>
      </header>

      <div className="chat-pg-body">
        {query ? (
          <>
            <div className="chat-pg-intro">
              <h1 className="chat-pg-nadpis">Váš finanční průvodce</h1>
              <p className="lead">
                Odpovězte na pár doplňujících otázek — AI pak sestaví
                konkrétní doporučení přímo pro vás.
              </p>
            </div>

            <div className="chat-pg-panel">
              <ChatPanel initialMessage={query} />
            </div>

            <p className="chat-pg-skip">
              Raději vyplnit formulář přímo?{" "}
              <Link href="/start">Vyberte oblast →</Link>
            </p>
          </>
        ) : (
          <div className="chat-pg-empty">
            <p className="lead">Žádná otázka nenalezena.</p>
            <Link href="/" className="btn">
              Zpět na začátek →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
