import { NextResponse } from "next/server";
import { HttpError, readJson, route } from "@/lib/http";
import { SESSION_COOKIE, passwordEnabled, safeEqual, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Kaba kuvvet denemelerini yavaşlatmak için basit, bellek içi sınır
const attempts = new Map<string, { count: number; until: number }>();

export const POST = route(async (req) => {
  if (!passwordEnabled()) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "yerel";
  const a = attempts.get(ip);
  if (a && a.until > Date.now() && a.count >= 5) {
    throw new HttpError(429, "Çok fazla hatalı deneme. Birkaç dakika sonra tekrar deneyin.");
  }

  const { password } = await readJson(req);
  const given = typeof password === "string" ? password.trim() : "";
  const expected = await sessionToken();
  if (!given || !safeEqual(await sessionToken(given), expected)) {
    const cur = a && a.until > Date.now() ? a : { count: 0, until: Date.now() + 5 * 60_000 };
    attempts.set(ip, { count: cur.count + 1, until: cur.until });
    throw new HttpError(401, "Parola hatalı.");
  }
  attempts.delete(ip);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
});

export const DELETE = route(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
