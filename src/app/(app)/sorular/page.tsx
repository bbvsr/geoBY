import type { Metadata } from "next";
import { PromptsPage } from "@/components/prompts/PromptsPage";

export const metadata: Metadata = { title: "Sorular" };

export default function Page() {
  return <PromptsPage />;
}
