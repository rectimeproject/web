import {useCallback, useMemo, useState} from "react";

export interface IStorageEstimate {
  quota?: number;
  usage?: number;
}

export default function useNavigatorStorage() {
  const [estimateResult, setEstimateResult] = useState<IStorageEstimate | null>(
    null
  );
  const [isEstimating, setIsEstimating] = useState(false);
  const [hasLoadedInitialEstimation, setHasLoadedInitialEstimation] =
    useState(false);
  const estimate = useCallback(() => {
    if (isEstimating) {
      return;
    }
    setIsEstimating(true);
    navigator.storage
      .estimate()
      .then(result => {
        const newResult: IStorageEstimate = {};
        if (typeof result.quota === "number") {
          newResult.quota = result.quota;
        }
        if (typeof result.usage === "number") {
          newResult.usage = result.usage;
        }
        setEstimateResult(newResult);
      })
      .finally(() => {
        setIsEstimating(false);
        setHasLoadedInitialEstimation(true);
      });
  }, [setEstimateResult, isEstimating, setIsEstimating]);
  return useMemo(
    () => ({
      hasLoadedInitialEstimation,
      isEstimating,
      estimate,
      estimateResult
    }),
    [estimate, estimateResult, hasLoadedInitialEstimation, isEstimating]
  );
}
