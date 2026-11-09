"use client";

/** Tarayıcı tarafı JSON isteği; hata durumunda anlaşılır mesajla Error fırlatır. */
export async function api<T = unknown>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<T> {
  const { body, ...rest } = init ?? {};
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: body && !isForm ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new Error("Sunucuya ulaşılamadı. Uygulamanın çalıştığından emin olun.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* JSON olmayan cevap */
  }
  const err = (data as { error?: string } | null)?.error;
  if (!res.ok || err) throw new Error(err || `İstek başarısız (HTTP ${res.status})`);
  return data as T;
}
