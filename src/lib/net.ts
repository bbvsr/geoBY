import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Kullanıcının verdiği adresleri güvenle çekmek için: yalnızca internetteki
 * herkese açık sunuculara izin verir. Yerel ağ, bulut meta veri servisi gibi iç
 * adreslere (SSRF) ve oralara yönlendirmelere izin vermez.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPublicIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const n = ipv4ToInt(ip);
    return !V4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (v === 6) {
    const a = ip.toLowerCase();
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicIp(mapped[1]);
    if (a === "::" || a === "::1") return false;
    // fc00::/7 (özel), fe80::/10 (bağlantı-yerel), ff00::/8 (çoklu yayın)
    return !/^(f[cd]|fe[89ab]|ff)/.test(a);
  }
  return false;
}

export class UnsafeUrlError extends Error {}

/** Adresin herkese açık bir sunucuya gittiğini doğrular. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Adres geçersiz.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("Yalnızca http/https adresleri.");
  if (url.username || url.password) throw new UnsafeUrlError("Adreste kullanıcı bilgisi olamaz.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new UnsafeUrlError("İç ağ adreslerine izin verilmez.");

  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  if (addresses.length === 0 || !addresses.every(isPublicIp)) {
    throw new UnsafeUrlError("Bu adres herkese açık bir siteye gitmiyor.");
  }
  return url;
}

/**
 * Herkese açık bir sayfayı çeker. Yönlendirmeleri tek tek doğrulayarak izler.
 * Hata durumunda null döner (tarama bir sayfayı atlayıp devam eder).
 */
export async function fetchPublicPage(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> } = {}
): Promise<{ url: string; html: string } | null> {
  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    let url: URL;
    try {
      url = await assertPublicUrl(current);
    } catch {
      return null;
    }
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: opts.headers,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.includes("html")) return null;
    const html = (await res.text()).slice(0, opts.maxBytes ?? 500_000);
    return { url: url.toString(), html };
  }
  return null;
}
