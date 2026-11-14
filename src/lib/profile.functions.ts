import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileSchema } from "./profile";

export const getHealthProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("patient_profiles").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error("Não foi possível carregar seu perfil. Tente novamente.");
    return data ? profileSchema.parse(data) : null;
  });

export const saveHealthProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("patient_profiles").upsert({
      ...data, user_id: context.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível salvar seu perfil. Suas alterações continuam nesta tela.");
    return { saved: true };
  });