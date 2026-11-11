import type { Metadata } from "next";
import { SourcesPage } from "@/components/sources/SourcesPage";

export const metadata: Metadata = { title: "Kaynaklar" };

export default function Page() {
  return <SourcesPage />;
}
