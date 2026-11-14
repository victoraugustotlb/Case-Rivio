import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, FolderHeart, LogOut, Home, ScanLine, Share2, User } from "lucide-react";

const nav = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Documentos", to: "/documentos", icon: FolderHeart },
  { label: "Compartilhar", to: "/compartilhar", icon: Share2 },
  { label: "Perfil", to: "/perfil", icon: User },
] as const;

function isActive(path: string, to: string) {
  return path.startsWith(to);
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setName((data.user?.user_metadata?.["full_name"] as string) || data.user?.email || ""));
  }, []);
  const sair = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/entrar", replace: true });
  };
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Link to="/inicio" className="flex items-center gap-2 px-2 font-display text-2xl font-bold tracking-tight text-sidebar-accent-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sm text-sidebar-primary-foreground">V</span>
          VITA
        </Link>
        <div className="mt-8 rounded-xl bg-sidebar-accent p-3">
          <p className="text-xs text-sidebar-foreground/70">Perfil ativo</p>
          <p className="truncate font-semibold text-sidebar-accent-foreground">{name || "…"}</p>
        </div>
        <nav aria-label="Navegação principal" className="mt-6 flex flex-col gap-1">
          {nav.map(({ label, to, icon: Icon }) => {
            const active = isActive(path, to);
            return (
              <Link key={to} to={to} aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <Link to="/documentos/adicionar" className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
          <FileUp className="h-5 w-5" aria-hidden /> Adicionar arquivo
        </Link>
        <button type="button" onClick={sair} className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm hover:bg-sidebar-accent"><LogOut className="h-4 w-4" aria-hidden /> Sair</button>
      </aside>

      <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:ml-64 lg:px-8">
        <span className="truncate font-display text-xl font-bold text-primary lg:hidden">VITA</span>
        <span className="hidden text-sm text-muted-foreground lg:block">Seu histórico de saúde em um só lugar</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={sair} aria-label="Sair" className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted lg:hidden"><LogOut className="h-5 w-5" aria-hidden /></button>
          <Link to="/documentos/adicionar" aria-label="Escanear documento" className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground lg:hidden">
            <ScanLine className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 lg:ml-64 lg:px-8 lg:pb-10">{children}</main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.map(({ label, to, icon: Icon }) => {
          const active = isActive(path, to);
          return (
            <Link key={to} to={to} aria-current={active ? "page" : undefined}
              className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
