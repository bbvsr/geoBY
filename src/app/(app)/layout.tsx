import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppProvider } from "@/components/app/AppContext";
import { AppShell } from "@/components/app/AppShell";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = db();

  // Supabase kullanılıyorsa tablolar kurulu mu? (Yerel modda her zaman hazır.)
  let ready = false;
  try {
    ready = (await store.checkTables()).allTablesExist;
  } catch {
    ready = false;
  }
  if (!ready) redirect("/setup");

  const brand = await store.getPrimaryBrand();
  if (!brand) return <OnboardingFlow />;

  const competitors = await store.getCompetitors(brand.id);
  return (
    <AppProvider initialBrand={brand} initialCompetitors={competitors}>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
