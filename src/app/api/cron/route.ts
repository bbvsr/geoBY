import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { runDueTests } from "@/lib/autorun";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * Zamanlanmış görevler için: hatırlatıcının zamanı geldiyse testleri çalıştırır.
 * CRON_SECRET ile korunur. Vercel Cron bu değeri "Authorization: Bearer" olarak gönderir;
 * başka bir zamanlayıcı ?key= parametresiyle de çağırabilir. ?force=1 zamanı beklemez.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET ayarlı değil. Zamanlanmış test için .env.local dosyasına CRON_SECRET ekleyin." },
      { status: 503 }
    );
  }
  const given =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("key") ?? "";
  if (!safeEqual(given, secret)) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  try {
    const result = await runDueTests({ force: req.nextUrl.searchParams.get("force") === "1" });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
