import { NextResponse, type NextRequest } from "next/server";
import { ALL_MODELS, type Brand, type ModelId } from "@/types";
import { db } from "@/lib/db";

/** Kullanıcıya gösterilecek, beklenen hatalar (400/404). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Rota sarmalayıcı: tüm hataları JSON { error } olarak döndürür. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error("[GeoBY]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu" },
        { status: 500 }
      );
    }
  };
}

export async function requireBrand(): Promise<Brand> {
  const brand = await db().getPrimaryBrand();
  if (!brand) throw new HttpError(400, "Önce kurulumu tamamlayıp markanızı oluşturun.");
  return brand;
}

export function isModelId(v: unknown): v is ModelId {
  return typeof v === "string" && (ALL_MODELS as string[]).includes(v);
}

/** ?days= ve ?model= parametrelerini güvenli şekilde okur. */
export function parseFilters(req: NextRequest, defaultDays = 90) {
  const sp = req.nextUrl.searchParams;
  const rawDays = parseInt(sp.get("days") ?? "", 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 3650) : defaultDays;
  const m = sp.get("model");
  const model = isModelId(m) ? m : undefined;
  return { days, model };
}

export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Geçersiz istek gövdesi (JSON bekleniyor).");
  }
}

export function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
