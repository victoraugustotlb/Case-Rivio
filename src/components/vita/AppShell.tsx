import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, CalendarDays, CreditCard, Eye, FileUp, FolderHeart, LogOut, Home, Menu, ScanLine, Share2, ShieldCheck, User, Users, X } from "lucide-react";
import { appointmentsQuery } from "@/lib/scheduling-query";
import { isTomorrow } from "@/lib/scheduling";
import { accountQuery } from "@/lib/account-query";
import { familyQuery } from "@/lib/family-query";

const nav = [
  { label: "Início", to: "/inicio", icon: Home },
  { label: "Documentos", to: "/documentos", icon: FolderHeart },
  { label: "Consultas", to: "/consultas", icon: CalendarDays },
  { label: "Compartilhar", to: "/compartilhar", icon: Share2 },
] as const;
const moreNav = [
  { label: "Minha família", to: "/familia", icon: Users },
  { label: "Perfil", to: "/perfil", icon: User },
  { label: "Acessos", to: "/acessos", icon: Eye },
  { label: "Conta e privacidade", to: "/plano", icon: ShieldCheck },
  { label: "Assinatura e pagamento", to: "/assinatura", icon: CreditCard },
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
    supabase.auth.getSession().then(({ data }) => { const u = data.session?.user; setName((u?.user_metadata?.["full_name"] as string) || u?.email || ""); });
  }, []);
  const account = useQuery(accountQuery);
  const isPlan = account.data?.type === "patient_plan";
  const family = useQuery({ ...familyQuery, enabled: isPlan });
  const pending = (family.data?.incomingRequests.length ?? 0) + (family.data?.accessRequests.length ?? 0);
  const viewingId = path.startsWith("/familia/") ? path.split("/")[2] : null;
  const viewing = viewingId ? family.data?.members.find((m) => m.id === viewingId) : null;
  const visible = (family.data?.members ?? []).filter((m) => m.access === "ver");
  const [more, setMore] = useState(false);
  const sidebarNav = [...nav, ...moreNav];
  const appts = useQuery(appointmentsQuery);
  const tomorrow = (appts.data ?? []).filter((a) => a.status === "agendado" && isTomorrow(a.startsAt));
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
          <ul className="mt-1 space-y-1" aria-label="Trocar de perfil">
            <li>
              <Link to="/inicio" aria-current={!viewingId ? "true" : undefined} className={`block truncate rounded-md px-2 py-1.5 text-sm ${!viewingId ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground" : "hover:bg-sidebar/40"}`}>{name || "…"} <span className="text-xs opacity-75">(você)</span></Link>
            </li>
            {visible.map((m) => (
              <li key={m.id}>
                <Link to="/familia/$memberId" params={{ memberId: m.id }} aria-current={viewingId === m.id ? "true" : undefined} className={`block truncate rounded-md px-2 py-1.5 text-sm ${viewingId === m.id ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground" : "hover:bg-sidebar/40"}`}>{m.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Navegação principal" className="mt-6 flex flex-col gap-1">
          {sidebarNav.map(({ label, to, icon: Icon }) => {
            const active = isActive(path, to);
            return (
              <Link key={to} to={to} aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden /> {label}
                {to === "/familia" && pending > 0 && <span className="ml-auto rounded-full bg-warning px-2 text-xs font-bold text-card" aria-label={`${pending} aviso(s)`}>{pending}</span>}
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

      {viewingId && (
        <div role="status" className="sticky top-[69px] z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-warning-soft px-4 py-2 text-sm lg:ml-64 lg:px-8">
          <span className="flex items-center gap-2"><Eye className="h-4 w-4" aria-hidden />Você está vendo o perfil de <strong>{viewing?.name ?? "um familiar"}</strong>. Somente leitura.</span>
          <Link to="/inicio" className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-card px-3 font-medium"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar ao meu perfil</Link>
        </div>
      )}

      {tomorrow.length > 0 && !path.startsWith("/consultas/agendamentos") && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary-soft px-4 py-2 text-sm lg:ml-64 lg:px-8">
          <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" aria-hidden />Lembrete: amanhã você tem consulta com <strong>{tomorrow[0]!.provider.name}</strong> às {new Date(tomorrow[0]!.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.</span>
          <Link to="/consultas/agendamentos" className="font-medium text-primary underline">Ver agendamento</Link>
        </div>
      )}

      <main className="px-4 pb-28 pt-6 lg:ml-64 lg:px-8 lg:pb-10">{children}</main>

      {more && (
        <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-label="Mais opções" className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="font-semibold">Mais</p><button type="button" aria-label="Fechar" onClick={() => setMore(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-muted"><X className="h-5 w-5" aria-hidden /></button></div>
            {moreNav.map(({ label, to, icon: Icon }) => (
              <Link key={to} to={to} onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 hover:bg-muted"><Icon className="h-5 w-5" aria-hidden />{label}{to === "/familia" && pending > 0 && <span className="ml-auto rounded-full bg-warning px-2 text-xs font-bold text-card">{pending}</span>}</Link>
            ))}
            {visible.map((m) => (
              <Link key={m.id} to="/familia/$memberId" params={{ memberId: m.id }} onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 rounded-lg px-3 pl-11 text-sm hover:bg-muted">Ver perfil de {m.name}</Link>
            ))}
            <button type="button" onClick={sair} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 hover:bg-muted"><LogOut className="h-5 w-5" aria-hidden />Sair</button>
          </div>
        </div>
      )}

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
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium ${moreNav.some((m) => path.startsWith(m.to)) ? "text-primary" : "text-muted-foreground"}`}>
          <Menu className="h-5 w-5" aria-hidden />
          <span>Mais</span>
          {pending > 0 && <span className="absolute right-[30%] top-2 h-2.5 w-2.5 rounded-full bg-warning" aria-label="Há avisos" />}
        </button>
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
