import { NextResponse } from "next/server";
import { HttpError, readJson, route, str } from "@/lib/http";
import { generatePrompts } from "@/lib/generators";
import type { CrawlResult } from "@/types";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const body = await readJson<{ crawlData?: CrawlResult; domain?: string }>(req);
  if (!body.crawlData) throw new HttpError(400, "crawlData gerekli.");
  return NextResponse.json({ prompts: generatePrompts(body.crawlData, str(body.domain, 200)) });
});
