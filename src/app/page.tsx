import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = db();

  // 1) Supabase kullanılıyorsa tablolar kurulu mu? (Yerel modda her zaman hazır.)
  let tablesOk = false;
  try {
    tablesOk = (await store.checkTables()).allTablesExist;
  } catch {
    tablesOk = false;
  }
  if (!tablesOk) redirect("/setup");

  // 2) Marka yoksa kurulum sihirbazı, varsa panel
  const brand = await store.getPrimaryBrand();
  if (!brand) return <OnboardingFlow />;

  const competitors = await store.getCompetitors(brand.id);
  return <Dashboard brand={brand} competitors={competitors} />;
}
