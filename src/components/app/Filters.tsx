"use client";
import { MODEL_LABELS, type ModelId } from "@/types";
import { Segmented, Select } from "@/components/ui";
import { useApp } from "./AppContext";

const PERIODS = [
  { value: 7, label: "7 gün" },
  { value: 30, label: "30 gün" },
  { value: 90, label: "90 gün" },
  { value: 365, label: "1 yıl" },
];

export function Filters() {
  const { days, setDays, model, setModel, brand } = useApp();
  // Seçili model artık izlenmiyorsa bile listede kalsın ki filtre görünmez olmasın
  const options = [...new Set([...brand.selected_models, ...(model ? [model] : [])])];

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Segmented label="Dönem" value={days} onChange={setDays} options={PERIODS} />
      <label className="sr-only" htmlFor="filter-model">
        Asistan
      </label>
      <Select
        id="filter-model"
        value={model ?? ""}
        onChange={(e) => setModel((e.target.value || null) as ModelId | null)}
        className="h-8 w-auto py-0 text-[13px]"
      >
        <option value="">Tüm asistanlar</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {MODEL_LABELS[m]}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** URL sorgu parametreleri: ?days=30&model=gemini */
export function useFilterQuery(): string {
  const { days, model } = useApp();
  const q = new URLSearchParams({ days: String(days) });
  if (model) q.set("model", model);
  return q.toString();
}
