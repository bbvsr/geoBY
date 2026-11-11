"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Tarayıcı tarafı JSON isteği; hata durumunda anlaşılır mesajla Error fırlatır. */
export async function api<T = unknown>(
  url: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<T> {
  const { body, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: body !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Sunucuya ulaşılamadı. Uygulamanın çalıştığından emin olun.");
  }
  if (res.status === 401 && !url.startsWith("/api/login")) {
    window.location.href = "/login";
    throw new Error("Oturum açmanız gerekiyor.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* JSON olmayan cevap */
  }
  const err = (data as { error?: string } | null)?.error;
  if (!res.ok || err) throw new Error(err || `İstek başarısız oldu (HTTP ${res.status}).`);
  return data as T;
}

/** Veri yükleme: yükleniyor/hata durumları, bağımlılık değişince yeniden yükleme, eski isteklerin sonucunu yok sayma. */
export function useData<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    api<T>(url)
      .then((d) => id === seq.current && setData(d))
      .catch((e: Error) => id === seq.current && setError(e.message))
      .finally(() => id === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
