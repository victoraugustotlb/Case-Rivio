import { queryOptions } from "@tanstack/react-query";
import { getPatientSettings, getProfileOverview } from "./profile.functions";

export const patientSettingsQuery = queryOptions({ queryKey: ["patient-settings"], queryFn: () => getPatientSettings(), staleTime: 60_000 });
export const profileOverviewQuery = queryOptions({ queryKey: ["profile-overview"], queryFn: () => getProfileOverview(), staleTime: 30_000 });
