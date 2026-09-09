import { NextResponse } from "next/server";
import { checkTables } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await checkTables();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        allTablesExist: false,
        results: [],
        error: e instanceof Error ? e.message : "Bilinmeyen hata",
      },
      { status: 200 }
    );
  }
}

export async function POST() {
  return GET();
}
