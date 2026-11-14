import { z } from "zod";

export function ageFromBirthDate(birthDate: string | null, today = new Date()): number | null {
  if (!birthDate) return null;
  const parts = birthDate.split("-").map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > today) return null;
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}

const text = z.string().trim().max(2000, "Use até 2.000 caracteres.");
export const medicationSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do medicamento.").max(150),
  dose: z.string().trim().max(100),
  frequency: z.string().trim().max(150),
});
export const profileSchema = z.object({
  full_name: z.string().trim().max(150),
  birth_date: z.string().nullable().refine((date) => date === null || (/^\d{4}-\d{2}-\d{2}$/.test(date) && ageFromBirthDate(date) !== null), "Informe uma data de nascimento válida, que não esteja no futuro."),
  height_cm: z.number().positive("Informe uma altura maior que zero.").max(300, "Confira a altura em centímetros.").nullable(),
  weight_kg: z.number().positive("Informe um peso maior que zero.").max(700, "Confira o peso em quilos.").nullable(),
  medications: z.array(medicationSchema).max(50),
  allergies: text,
  conditions: text,
  surgeries: text,
  family_history: text,
  smoking: z.enum(["", "Nunca", "Já parei", "Atualmente"]),
  alcohol: z.enum(["", "Não consumo", "Ocasionalmente", "Regularmente"]),
  activity: z.enum(["", "Não pratico", "1–2 dias por semana", "3–4 dias por semana", "5 ou mais dias por semana"]),
  questionnaire_completed: z.boolean(),
});
export type HealthProfile = z.infer<typeof profileSchema>;
export type Medication = z.infer<typeof medicationSchema>;
export const emptyProfile: HealthProfile = {
  full_name: "", birth_date: null, height_cm: null, weight_kg: null, medications: [],
  allergies: "", conditions: "", surgeries: "", family_history: "", smoking: "", alcohol: "", activity: "", questionnaire_completed: false,
};