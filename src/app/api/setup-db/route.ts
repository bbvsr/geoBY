import { NextResponse } from "next/server";
import { db, storageMode } from "@/lib/db";
import { TABLES } from "@/lib/db/types";

export const dynamic = "force-dynamic";

async function check() {
  try {
    const result = await db().checkTables();
    return NextResponse.json({ ...result, mode: storageMode() });
  } catch (e) {
    return NextResponse.json({
      allTablesExist: false,
      results: TABLES.map((table) => ({ table, exists: false })),
      error: e instanceof Error ? e.message : "Bilinmeyen hata",
      mode: storageMode(),
    });
  }
}

export const GET = check;
export const POST = check;
