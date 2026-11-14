import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { requireRole } from "@/lib/require-role";

// Todas as telas do paciente passam por aqui: sem sessão → /entrar; médico ou laboratório → /clinico.
// O guarda de papel vive só neste ponto (e em /clinico), para o menu do profissional nunca se misturar com o do paciente.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { account } = await requireRole("paciente", context);
    const { data } = await supabase.auth.getSession(); // sessão local, sem ida ao Auth
    return { user: data.session!.user, account };
  },
  component: () => <Outlet />,
});
