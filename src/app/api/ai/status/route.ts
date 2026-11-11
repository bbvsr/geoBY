import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { modelStatuses } from "@/lib/ai/engines";
import { assistantProvider } from "@/lib/ai/assistant";
import { PROVIDERS, isProviderConfigured } from "@/lib/ai/providers";
import { storageMode } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Hangi yapay zeka bağlantıları aktif? (Anahtarların kendisi asla döndürülmez.) */
export const GET = route(async () => {
  const assistant = assistantProvider();
  return NextResponse.json({
    models: modelStatuses(),
    providers: Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      free: p.free,
      envKey: p.envKey,
      envExample: p.envExample,
      signupUrl: p.signupUrl ?? null,
      note: p.note,
      configured: isProviderConfigured(p.id),
    })),
    assistant: assistant ? PROVIDERS[assistant].label : null,
    storage: storageMode(),
  });
});
