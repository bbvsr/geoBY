import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 0-1 arası oranı Türkçe yüzdeye çevirir: 0.473 → "%47". */
export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !isFinite(value)) return "—";
  const n = (value * 100).toFixed(digits).replace(".", ",");
  return `%${n}`;
}

/** Yüzde puan farkı: 0.052 → "+5 puan". */
export function pointChange(value: number): string {
  const n = Math.round(value * 100);
  if (n === 0) return "değişmedi";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)} puan`;
}

/** Ondalık sayıyı Türkçe biçimde yazar: 2.25 → "2,3". */
export function decimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

/** Bir URL veya alan adı benzeri metinden sade alan adı çıkarır. */
export function extractDomain(input: string): string {
  if (!input) return "";
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split("/")[0];
  s = s.split("?")[0];
  s = s.split("#")[0];
  s = s.split(":")[0];
  return s;
}

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** "28 Tem" */
export function shortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]}`;
}

/** "28 Tem 14:05" */
export function dateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const hm = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `${shortDate(d)} ${hm}`;
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "az önce";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  return shortDate(d);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
