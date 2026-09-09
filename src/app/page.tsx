import { redirect } from "next/navigation";
import { checkTables, getPrimaryBrand, getCompetitors } from "@/lib/supabase-admin";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  // 1) Tablolar var mı?
  let tablesOk = false;
  try {
    const { allTablesExist } = await checkTables();
    tablesOk = allTablesExist;
  } catch {
    tablesOk = false;
  }
  if (!tablesOk) redirect("/setup");

  // 2) Marka var mı?
  const brand = await getPrimaryBrand();
  if (!brand) {
    return <OnboardingFlow />;
  }

  // 3) Dashboard
  const competitors = await getCompetitors(brand.id);
  return <Dashboard brand={brand} competitors={competitors} />;
}
