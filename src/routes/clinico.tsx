import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { requireRole } from "@/lib/require-role";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, FilePlus2, History, KeyRound, LayoutDashboard, Loader2, LogOut, Menu, Send, Stethoscope, UserCog, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtCnpj, useProMe } from "@/lib/pro-me";
import { hasProvider } from "@/lib/pro.functions";
import { NoDoctor, NoLab } from "@/components/vita/ProOnboarding";

export const Route = createFileRoute("/clinico")({
  ssr: false,
  beforeLoad: ({ context }) => requireRole("profissional", context),
  head: () => ({
    meta: [
      { title: "Área do profissional — VITA Clínico" },
      { name: "description", content: "Pacientes com acesso, histórico, pedidos por código de 6 dígitos, envio de documentos e agenda." },
      { property: "og:title", content: "Área do profissional — VITA Clínico" },
      { property: "og:description", content: "Veja só o que o paciente liberou, pelo tempo que ele escolheu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClinicoLayout,
});

function ClinicoLayout() {
  const nav = useNavigate();
  const me = useProMe();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const provFn = useServerFn(hasProvider);
  const prov = useQuery({ queryKey: ["pro-has-provider"], queryFn: () => provFn(), enabled: !!(me.data?.doctor || me.data?.lab) });
  useEffect(() => setOpen(false), [path]);
  const sair = async () => { qc.clear(); await supabase.auth.signOut(); nav({ to: "/entrar", replace: true }); };

  if (me.isLoading || !me.data?.user || me.data.type === "patient") return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando" /></div>;
  if (me.data.type === "laboratory" && !me.data.lab) return <NoLab onDone={() => me.refetch()} />;
  if (me.data.type === "doctor" && !me.data.doctor) return <NoDoctor onDone={() => me.refetch()} />;
  const who = me.data.doctor
    ? { name: me.data.doctor.full_name, cred: `CRM ${me.data.doctor.crm}/${me.data.doctor.uf} informado` }
    : { name: me.data.lab!.legal_name, cred: `CNPJ ${fmtCnpj(me.data.lab!.cnpj)} informado` };

  const items = [
    { to: "/clinico", label: "Painel", icon: LayoutDashboard, exact: true },
    { to: "/clinico/pacientes", label: "Pacientes com acesso", icon: Users },
    { to: "/clinico/historico", label: "Histórico de pacientes", icon: History },
    { to: "/clinico/pedir", label: "Pedir acesso", icon: Send },
    { to: "/clinico/enviar", label: "Adicionar documento", icon: FilePlus2 },
    ...(prov.data ? [{ to: "/clinico/agenda", label: "Agenda", icon: CalendarDays }] : []),
    { to: "/clinico/conta", label: "Minha conta", icon: UserCog },
  ] as const;
  const active = (to: string, exact?: boolean) => (exact ? path === to || path === `${to}/` : path.startsWith(to) || (to === "/clinico/pacientes" && path.startsWith("/clinico/paciente/")));

  const menu = (
    <nav aria-label="Menu do profissional" className="flex flex-col gap-0.5">
      {items.map((it) => {
        const Icon = it.icon; const on = active(it.to, "exact" in it ? it.exact : false);
        return <Link key={it.to} to={it.to} aria-current={on ? "page" : undefined} className={`flex h-9 items-center gap-2 rounded px-2 text-[13px] font-medium ${on ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}><Icon className="h-4 w-4 shrink-0" aria-hidden />{it.label}</Link>;
      })}
      <Link to="/medico" className="mt-2 flex h-9 items-center gap-2 rounded px-2 text-[13px] hover:bg-sidebar-accent"><KeyRound className="h-4 w-4" aria-hidden />Abrir com código do paciente</Link>
    </nav>
  );
  const side = (
    <div className="flex h-full flex-col gap-4 p-3 text-sidebar-foreground">
      <div className="flex items-center gap-2 px-1 text-sm font-bold text-sidebar-accent-foreground"><Stethoscope className="h-5 w-5" aria-hidden />VITA Clínico</div>
      <div className="rounded border border-sidebar-border px-2 py-1.5 text-xs"><p className="truncate font-semibold">{who.name}</p><p className="opacity-75">{who.cred}</p></div>
      {menu}
      <button onClick={sair} className="mt-auto flex h-9 items-center gap-2 rounded px-2 text-[13px] hover:bg-sidebar-accent"><LogOut className="h-4 w-4" aria-hidden />Sair</button>
    </div>
  );
  return (
    <div className="min-h-screen bg-background font-sans text-[13px] text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-56 bg-sidebar lg:block">{side}</aside>
      <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b bg-card px-3 lg:hidden">
        <span className="flex items-center gap-1.5 font-semibold text-primary"><Stethoscope className="h-4 w-4" aria-hidden />VITA Clínico</span>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="grid h-10 w-10 place-items-center rounded hover:bg-muted"><Menu className="h-5 w-5" aria-hidden /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Menu" className="h-full w-64 bg-sidebar" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="absolute left-52 top-2 grid h-10 w-10 place-items-center rounded text-sidebar-foreground"><X className="h-5 w-5" aria-hidden /></button>
            {side}
          </div>
        </div>
      )}
      <main className="px-3 py-4 lg:ml-56 lg:px-6"><Outlet /></main>
    </div>
  );
}
