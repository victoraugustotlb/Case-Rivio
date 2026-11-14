import { useRouter, useRouterState } from "@tanstack/react-router";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/vita/AppShell";

function Blocks() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl bg-muted lg:col-span-2" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

/** Esqueleto sem moldura (usado em / enquanto o destino é decidido e fora da área do paciente). */
export function BareSkeleton() {
  return <div role="status" aria-label="Carregando" className="mx-auto min-h-screen max-w-5xl bg-background p-6"><Blocks /></div>;
}

/** Esqueleto padrão das transições: dentro do AppShell nas telas do paciente, para não piscar em branco. */
export function PageSkeleton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = (useRouter().options.context as { queryClient?: QueryClient } | undefined)?.queryClient;
  const patientArea = !["/", "/entrar", "/medico"].includes(path) && !path.startsWith("/clinico");
  if (!patientArea || !qc) return <BareSkeleton />;
  // O esqueleto pode aparecer acima do provider da raiz (SSR/primeira carga): traz o próprio provider.
  return <QueryClientProvider client={qc}><AppShell><div role="status" aria-label="Carregando"><Blocks /></div></AppShell></QueryClientProvider>;
}
