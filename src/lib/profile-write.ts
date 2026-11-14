// Único caminho de gravação do perfil (usado pelo dono e pelo cuidador). Recebe o cliente já autorizado.
import { parseProfileLenient, type HealthProfile } from "./profile";
import { clearNoneWhenFilled, stampSources } from "./profile-completion";

type Sb = { from: (t: string) => any };

export async function loadProfile(sb: Sb, userId: string): Promise<HealthProfile | null> {
  const { data, error } = await sb.from("patient_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar seu perfil. Tente novamente.");
  return data ? parseProfileLenient(data).profile : null;
}

/** Único caminho de gravação: mescla, valida, carimba a origem no servidor e salva. */
export async function writeProfile(sb: Sb, userId: string, prev: HealthProfile | null, next: HealthProfile, meta: Parameters<typeof stampSources>[2]) {
  const cleaned = clearNoneWhenFilled(next);
  const field_sources = stampSources(prev, cleaned, meta);
  const row = { ...cleaned, field_sources, user_id: userId, updated_at: new Date().toISOString() };
  const { error } = await sb.from("patient_profiles").upsert(row, { onConflict: "user_id" });
  if (error) { console.error("writeProfile", error.code); throw new Error("Não foi possível salvar. Suas respostas continuam nesta tela."); }
  return { ...cleaned, field_sources };
}

