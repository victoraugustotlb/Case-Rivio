import { queryOptions } from "@tanstack/react-query";
import { getFamily, getMemberRecords } from "./family.functions";

export const familyQuery = queryOptions({ queryKey: ["family"], queryFn: () => getFamily(), staleTime: 30_000 });
export const memberRecordsQuery = (memberId: string) => queryOptions({ queryKey: ["family", "member", memberId], queryFn: () => getMemberRecords({ data: { memberId } }), staleTime: 0 });
