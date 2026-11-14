import { queryOptions } from "@tanstack/react-query";
import { getHealthProfile } from "./profile.functions";

export const healthProfileQuery = queryOptions({
  queryKey: ["health-profile"],
  queryFn: () => getHealthProfile(),
});