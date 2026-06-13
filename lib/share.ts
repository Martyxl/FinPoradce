import type { CustomerProfile } from "./types";

/**
 * Sdileni vysledku odkazem. Do URL hashe (#p=...) zakodujeme POUZE profil
 * klienta (vstup), ne cely vypocet — prijemce si vysledek prepocita pres
 * /api/calculate. Hash se neposila na server v Refereru.
 *
 * Kodovani: JSON -> UTF-8 safe base64 (přes encodeURIComponent escape).
 */
function utf8ToBase64(s: string): string {
  // btoa neumi vicebajtove znaky -> escape na %XX, pak binary string
  return btoa(
    encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    ),
  );
}

function base64ToUtf8(b64: string): string {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(b64), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
}

export function encodeProfilToHash(profile: CustomerProfile): string {
  return "#p=" + utf8ToBase64(JSON.stringify(profile));
}

export function decodeProfilFromHash(hash: string): CustomerProfile | null {
  const m = hash.match(/[#&]p=([^&]+)/);
  if (!m) return null;
  try {
    const obj = JSON.parse(base64ToUtf8(m[1]));
    if (obj && typeof obj === "object" && typeof obj.cisty_prijem_mesicne !== "undefined") {
      return obj as CustomerProfile;
    }
  } catch {
    return null;
  }
  return null;
}

export function shareUrlForProfil(profile: CustomerProfile): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin + "/vysledky"
      : "/vysledky";
  return base + encodeProfilToHash(profile);
}
