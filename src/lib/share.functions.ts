import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERIOD_OPTIONS, VALIDITY_OPTIONS, formatShareCode, validateShare } from "@/lib/share";
import type { CreateShareError } from "@/lib/codes";
import { ESSENTIAL_FIELDS } from "@/lib/profile-completion";

const input = z.object({
  categories: z.array(z.enum(["exames", "laudos", "consultas", "receitas", "vacinas"])).max(5),
  signals: z.array(z.enum(["fc", "sono", "spo2", "passos", "pressao", "glicose"])).max(6),
  includeProfile: z.boolean(),
  includeEssentials: z.boolean().default(false),
  essentialsFields: z.array(z.enum(ESSENTIAL_FIELDS)).max(ESSENTIAL_FIELDS.length).default([]),
  periodMonths: z.number().refine((n) => (PERIOD_OPTIONS as readonly number[]).includes(n)),
  validityHours: z.number().refine((n) => (VALIDITY_OPTIONS as readonly number[]).includes(n)),
  /** Validade até a consulta agendada (opcional, no máximo 60 dias). */
  until: z.string().datetime({ offset: true }).optional(),
});

/** Gera o código do paciente no servidor. Não depende de plano ou assinatura. */
export const createShareCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; code: string; id: string } | { ok: false; error: CreateShareError }> => {
    if (validateShare({ ...data, includeEssentials: data.includeEssentials && data.essentialsFields.length > 0 }).length) return { ok: false, error: "sem_selecao" };
    let expires = new Date(Date.now() + data.validityHours * 3600_000);
    if (data.until) {
      const u = new Date(data.until);
      if (u.getTime() > Date.now() && u.getTime() < Date.now() + 60 * 86400_000) expires = u;
    }
    for (let i = 0; i < 5; i++) {
      const code = formatShareCode();
      const { data: row, error } = await context.supabase.from("share_codes").insert({
        user_id: context.userId, code, categories: data.categories, signals: data.signals, include_profile: data.includeProfile,
        // Retrato do momento: mudar a configuração depois não amplia este código.
        include_essentials: data.includeEssentials && data.essentialsFields.length > 0, essentials_fields: data.includeEssentials ? data.essentialsFields : [],
        period_months: data.periodMonths, expires_at: expires.toISOString(),
      }).select("id").single();
      if (!error && row) return { ok: true, code, id: row.id };
      if (error?.code !== "23505") { console.error("createShareCode", error?.code, error?.message); return { ok: false, error: "falha_servidor" }; }
    }
    return { ok: false, error: "colisao_esgotada" };
  });
