import {useCallback, useEffect, useMemo, useRef} from "react";

export default function useThrottle(ms: number) {
  const timeoutRef = useRef<number | null>(null);
  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  const run = useCallback(
    (fn: () => void) => {
      if (timeoutRef.current !== null) {
        return;
      }
      timeoutRef.current = window.setTimeout(() => {
        try {
          fn();
        } catch (reason) {
          console.error(
            "function passed to run function failed with error: %o",
            reason
          );
        }
        timeoutRef.current = null;
      }, ms);
    },
    [ms]
  );
  useEffect(
    () => () => {
      clear();
    },
    [clear]
  );
  return useMemo(
    () => ({
      clear,
      run
    }),
    [run, clear]
  );
}
