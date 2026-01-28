import {useRef, useEffect, useCallback} from "react";
import {useTime} from "../TimeProvider.js";

interface UseTimeoutOptions {
  autoStart?: boolean;
  persist?: boolean;
}

export const useTimeout = (
  callback: () => void,
  delay: number | null,
  options: UseTimeoutOptions = {}
) => {
  const {autoStart = true, persist = false} = options;
  const {setTimeout, clearTimeout} = useTime();
  const timeoutIdRef = useRef<number | null>(null);
  const savedCallbackRef = useRef(callback);
  const persistRef = useRef(persist);

  // Remember the latest callback
  useEffect(() => {
    savedCallbackRef.current = callback;
  }, [callback]);

  // Remember persist flag
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const start = useCallback(() => {
    if (delay === null) return;

    // Clear existing timeout
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
    }

    const id = setTimeout(() => {
      savedCallbackRef.current();
      if (!persistRef.current) {
        timeoutIdRef.current = null;
      }
    }, delay);

    timeoutIdRef.current = id;
  }, [delay, setTimeout, clearTimeout]);

  const stop = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, [clearTimeout]);

  const restart = useCallback(() => {
    stop();
    start();
  }, [stop, start]);

  const isActive = useCallback(() => timeoutIdRef.current !== null, []);

  // Auto-start the timeout if enabled
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
