import { queryOptions } from "@tanstack/react-query";
import { getSchedulingOptions, listAppointments } from "./scheduling.functions";
export const schedulingOptionsQuery = queryOptions({ queryKey: ["scheduling-options"], queryFn: () => getSchedulingOptions() });
export const appointmentsQuery = queryOptions({ queryKey: ["appointments"], queryFn: () => listAppointments() });
