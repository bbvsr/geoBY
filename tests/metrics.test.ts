import { describe, expect, it } from "vitest";
import { rankings, visibility, avgPosition, shareOfVoice } from "@/lib/metrics";
import type { Brand, Competitor, Run } from "@/types";

const brand = { id: "b", name: "Marka", domain: "marka.com" } as Brand;
const comps = [
  { id: "c1", name: "Rakip1", domain: "r1.com" },
  { id: "c2", name: "Rakip2", domain: "r2.com" },
] as Competitor[];

function run(mentioned: boolean, c: Record<string, boolean>, pos: number | null = null): Run {
  return {
    id: Math.random().toString(),
    prompt_id: "p",
    model: "openai",
    response: "",
    query_text: "",
    mentioned,
    mention_count: mentioned ? 1 : 0,
    position_score: pos,
    sentiment: "positive",
    competitor_mentions: c,
    source: "manual",
    created_at: new Date().toISOString(),
  };
}

describe("metrics", () => {
  const runs = [
    run(true, { Rakip1: true, Rakip2: false }, 2),
    run(false, { Rakip1: true, Rakip2: true }),
    run(true, { Rakip1: false, Rakip2: false }, 1),
    run(false, { Rakip1: true, Rakip2: false }),
  ];

  it("görünürlük, sıra ve SOV", () => {
    expect(visibility(runs)).toBe(0.5);
    expect(avgPosition(runs)).toBe(1.5);
    // marka 2, rakip1 3, rakip2 1 → 2/6
    expect(shareOfVoice(runs)).toBeCloseTo(2 / 6);
  });

  it("sıralamada rakiplerin SOV toplamı 1'e tamamlanır", () => {
    const rows = rankings(runs, brand, comps);
    expect(rows[0].name).toBe("Rakip1");
    const total = rows.reduce((s, r) => s + r.sov, 0);
    expect(total).toBeCloseTo(1);
  });

  it("boş veri sıfır döner", () => {
    expect(visibility([])).toBe(0);
    expect(avgPosition([])).toBeNull();
  });
});
