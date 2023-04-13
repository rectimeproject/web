import { useCallback, useEffect, useMemo, useRef } from 'react';

export default function useInterval(ms: number) {
  const timeoutId = useRef<number | null>(null);
  const shouldContinue = useRef(true);
  const callback = useRef<(() => void) | null>(null);

  const setCallback = useCallback(
    (fn: () => void) => {
      callback.current = fn;
    },
    [callback]
  );

  const stop = useCallback(() => {
    if (timeoutId.current !== null) {
      window.clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    shouldContinue.current = false;
  }, [shouldContinue, timeoutId]);

  const start = useCallback(() => {
    if (timeoutId.current !== null || !shouldContinue.current) {
      return;
    }
    timeoutId.current = window.setTimeout(() => {
      if (callback.current) {
        try {
          callback.current();
        } catch (reason) {
          console.error('interval callback failed with exception: %o', reason);
        }
      }
      timeoutId.current = null;
      start();
    }, ms);
  }, [shouldContinue, ms, timeoutId]);

  useEffect(() => {
    shouldContinue.current = true;
    return () => stop();
  }, [stop]);

  return useMemo(
    () => ({
      start,
      setCallback,
      stop,
    }),
    [start, stop, setCallback]
  );
}
