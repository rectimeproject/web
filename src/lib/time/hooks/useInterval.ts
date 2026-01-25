import {useRef, useEffect, useCallback} from "react";
import {useTime} from "../TimeProvider.js";

interface UseIntervalOptions {
  autoStart?: boolean;
  immediateStart?: boolean;
}

export const useInterval = (
  callback: () => void,
  delay: number | null,
  options: UseIntervalOptions = {}
) => {
  const {autoStart = true, immediateStart = false} = options;
  const {setInterval, clearInterval} = useTime();
  const intervalIdRef = useRef<number | null>(null);
  const savedCallbackRef = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallbackRef.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    if (delay === null) return;

    // Clear existing interval
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
    }

    if (immediateStart) {
      savedCallbackRef.current();
    }

    const id = setInterval(savedCallbackRef.current, delay);
    intervalIdRef.current = id;
  }, [delay, setInterval, clearInterval, immediateStart]);

  const stop = useCallback(() => {
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, [clearInterval]);

  const restart = useCallback(() => {
    stop();
    start();
  }, [stop, start]);

  const isActive = useCallback(() => intervalIdRef.current !== null, []);

  // Auto-start the interval if enabled
  useEffect(() => {
    if (autoStart && delay !== null) {
      start();
    }

    return stop;
  }, [delay, autoStart, start, stop]);

  return {
    start,
    stop,
    restart,
    isActive: isActive()
  };
};
