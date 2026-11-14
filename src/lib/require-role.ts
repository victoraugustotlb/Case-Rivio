import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountQuery } from "@/lib/account-query";
import { roleRedirect, type Role } from "@/lib/routing";

/**
 * Único guarda de papel, usado no beforeLoad das rotas de paciente e de /clinico.
 * Sessão é lida localmente (sem chamada ao Auth); o tipo de conta vem do cache (60 s).
 */
export async function requireRole(role: Role, ctx: { queryClient: QueryClient }) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw redirect({ to: "/entrar", replace: true });
  const account = await ctx.queryClient.ensureQueryData(accountQuery);
  const to = roleRedirect(role, account.type);
  if (to) throw redirect({ to, replace: true });
  return { account };
}
