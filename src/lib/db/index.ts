import path from "path";
import { createLocalStore } from "./local";
import { createSupabaseStore } from "./supabase";
import type { DataStore } from "./types";

export type { DataStore } from "./types";

function isRealValue(v: string | undefined): v is string {
  return !!v && !/YOUR-PROJECT|sb_secret_xxx|^xxx$/i.test(v);
}

/** Supabase bilgileri girildiyse Supabase, aksi halde yerel dosya kullanılır. */
export function storageMode(): "supabase" | "local" {
  if (process.env.GEOBY_STORAGE === "local") return "local";
  return isRealValue(process.env.SUPABASE_URL) && isRealValue(process.env.SUPABASE_SECRET_KEY)
    ? "supabase"
    : "local";
}

let cached: { key: string; store: DataStore } | null = null;

export function db(): DataStore {
  const mode = storageMode();
  const dataDir = process.env.GEOBY_DATA_DIR || path.join(process.cwd(), ".data");
  const key = mode === "supabase" ? `sb:${process.env.SUPABASE_URL}` : `local:${dataDir}`;
  if (cached?.key === key) return cached.store;
  const store =
    mode === "supabase"
      ? createSupabaseStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
      : createLocalStore(dataDir);
  cached = { key, store };
  return store;
}
