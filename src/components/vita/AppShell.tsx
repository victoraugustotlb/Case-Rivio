import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bell, CalendarDays, FileHeart, Home, Pill, Siren, User } from "lucide-react";

const nav = [
  { label: "Início", icon: Home, active: true },
  { label: "Prontuário", icon: FileHeart },
  { label: "Consultas", icon: CalendarDays },
  { label: "Medicamentos", icon: Pill },
  { label: "Perfil", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar p-5 text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2 px-2 font-display text-2xl font-bold tracking-tight text-sidebar-accent-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sm text-sidebar-primary-foreground">V</span>
          VITA
        </Link>
        <div className="mt-8 rounded-xl bg-sidebar-accent p-3">
          <p className="text-xs text-sidebar-foreground/70">Perfil ativo</p>
          <p className="font-semibold text-sidebar-accent-foreground">Mariana Souza</p>
        </div>
        <nav aria-label="Navegação principal" className="mt-6 flex flex-col gap-1">
          {nav.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              type="button"
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden /> {label}
            </button>
          ))}
        </nav>
        <button type="button" className="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-lg bg-destructive font-semibold text-destructive-foreground">
          <Siren className="h-5 w-5" aria-hidden /> Emergência SOS
        </button>
      </aside>

      <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:ml-64 lg:px-8">
        <span className="truncate font-display text-xl font-bold text-primary lg:hidden">VITA</span>
        <span className="hidden text-sm text-muted-foreground lg:block">Sexta-feira, 13 de novembro</span>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Notificações (2 novas)" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-muted">
            <Bell className="h-5 w-5" aria-hidden />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive" />
          </button>
          <button type="button" aria-label="Emergência SOS" className="grid h-11 w-11 place-items-center rounded-full bg-destructive text-destructive-foreground lg:hidden">
            <Siren className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className="px-4 pb-28 pt-6 lg:ml-64 lg:px-8 lg:pb-10">{children}</main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            aria-current={active ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
