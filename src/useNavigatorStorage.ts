import {useQuery} from "@tanstack/react-query";
import {useMemo} from "react";

export interface IStorageEstimate {
  quota: number | null;
  usage: number | null;
}

export default function useNavigatorStorage() {
  const estimateQuery = useQuery({
    queryKey: ["navigator-storage-estimate"],
    queryFn: async () => {
      const result = await navigator.storage.estimate();
      const newResult: IStorageEstimate = {
        quota: null,
        usage: null
      };
      if (typeof result.quota === "number") {
        newResult.quota = result.quota;
      }
      if (typeof result.usage === "number") {
        newResult.usage = result.usage;
      }
      return newResult;
    }
  });
  const {
    data: estimateResult,
    isFetching: isEstimating,
    isSuccess: hasLoadedInitialEstimation
  } = estimateQuery;
  return useMemo(
    () => ({
      hasLoadedInitialEstimation,
      isEstimating,
      estimateResult: estimateResult ?? null
    }),
    [estimateResult, hasLoadedInitialEstimation, isEstimating]
  );
}
