import { NextResponse } from "next/server";
import { HttpError, readJson, route } from "@/lib/http";
import { generateCompetitors } from "@/lib/generators";
import type { CrawlResult } from "@/types";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const body = await readJson<{ crawlData?: CrawlResult }>(req);
  if (!body.crawlData) throw new HttpError(400, "crawlData gerekli.");
  return NextResponse.json({ competitors: generateCompetitors(body.crawlData) });
});
