import { Suspense } from "react";
import { AtlasHome } from "@/components/AtlasHome";

export const runtime = "edge";

export default function AtlasPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center text-[var(--muted)]">
          Loading neural atlas…
        </main>
      }
    >
      <AtlasHome />
    </Suspense>
  );
}
