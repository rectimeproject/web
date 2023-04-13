import { useCallback, useEffect, useMemo, useRef } from 'react';

export default function useDebounce(ms: number) {
  const timeout = useRef<number | null>(null);
  const reset = useCallback(() => {
    if (timeout.current !== null) {
      window.clearTimeout(timeout.current);
      timeout.current = null;
    }
  }, []);
  const run = useCallback(
    (fn: (() => void) | (() => Promise<void>)) => {
      reset();
      timeout.current = window.setTimeout(() => {
        let result: Promise<void> | void;
        try {
          result = fn();
        } catch (reason) {
          console.error('input function threw an exception: %o', reason);
          return;
        }
        if (result) {
          result.catch((reason) => {
            console.error(
              'promise returned by the input function failed with: %o',
              reason
            );
          });
        }
      }, ms);
    },
    [ms]
  );
  useEffect(() => reset, []);
  return useMemo(
    () => ({
      run,
    }),
    [run]
  );
}
