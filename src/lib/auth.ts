/**
 * İsteğe bağlı parola koruması. GEOBY_PASSWORD ayarlıysa tüm sayfalar ve API
 * oturum çerezi ister. Hem Node hem Edge (middleware) ortamında çalışır.
 */
export const SESSION_COOKIE = "geoby_session";

export function passwordEnabled(): boolean {
  return !!process.env.GEOBY_PASSWORD?.trim();
}

/** Parolanın kendisini çereze yazmamak için türetilmiş bir anahtar. */
export async function sessionToken(password = process.env.GEOBY_PASSWORD?.trim() ?? ""): Promise<string> {
  const data = new TextEncoder().encode(`geoby-session:v1:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sabit sürede karşılaştırma (zamanlama saldırılarına karşı). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
