import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Sessão local (sem ida ao Auth): as server functions revalidam o token e o RLS protege os dados.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/entrar" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
