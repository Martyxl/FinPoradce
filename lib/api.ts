import type {
  CalculationResult,
  CustomerProfile,
  Instituce,
} from "./types";

export async function vypocitej(
  profile: CustomerProfile,
): Promise<CalculationResult> {
  const res = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chyba ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchInstituce(): Promise<Instituce[]> {
  const res = await fetch("/api/instituce");
  if (!res.ok) {
    throw new Error(`Chyba ${res.status} při načítání seznamu institucí`);
  }
  const data = (await res.json()) as { instituce: Instituce[] };
  return data.instituce;
}

export function formatCZK(n: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(n: number, digits = 2): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
