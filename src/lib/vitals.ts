export type VitalStatus = "normal" | "atencao" | "alerta";

/** Classificação informativa (não diagnóstica) de pressão arterial, em mmHg. */
export function classifyBloodPressure(systolic: number, diastolic: number): VitalStatus {
  if (systolic >= 140 || diastolic >= 90 || systolic < 90 || diastolic < 60) return "alerta";
  if (systolic >= 130 || diastolic >= 85) return "atencao";
  return "normal";
}

/** Frequência cardíaca em repouso, bpm. */
export function classifyHeartRate(bpm: number): VitalStatus {
  if (bpm < 50 || bpm > 110) return "alerta";
  if (bpm > 100 || bpm < 60) return "atencao";
  return "normal";
}

/** Glicemia em jejum, mg/dL. */
export function classifyGlucose(mgdl: number): VitalStatus {
  if (mgdl >= 126 || mgdl < 70) return "alerta";
  if (mgdl >= 100) return "atencao";
  return "normal";
}

export const statusLabel: Record<VitalStatus, string> = {
  normal: "Dentro da faixa",
  atencao: "Atenção",
  alerta: "Fora da faixa",
};
