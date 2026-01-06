import {useRef, useCallback, useEffect} from "react";
import {useTimeout} from "./useTimeout";

export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options?: {leading?: boolean; trailing?: boolean}
) => {
  const {leading = true, trailing = true} = options || {};
  const {start, stop} = useTimeout(
    () => {
      if (trailing && savedArgsRef.current) {
        savedCallbackRef.current(...savedArgsRef.current);
        savedArgsRef.current = null;
        start();
      } else {
        isThrottledRef.current = false;
      }
    },
    delay,
    {autoStart: false}
  );

  const savedCallbackRef = useRef(callback);
  const savedArgsRef = useRef<unknown[] | null>(null);
  const isThrottledRef = useRef(false);
  const lastCallTimeRef = useRef(0);

  useEffect(() => {
    savedCallbackRef.current = callback;
  }, [callback]);

  const throttledFunction = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      savedArgsRef.current = args;

      if (!isThrottledRef.current) {
        if (leading) {
          savedCallbackRef.current(...args);
          lastCallTimeRef.current = now;
        }

        isThrottledRef.current = true;
        start();
      } else if (trailing) {
        // Store args for trailing call
        savedArgsRef.current = args;
      }
    },
    [start, stop, leading, trailing]
  );

  const cancel = useCallback(() => {
    stop();
    isThrottledRef.current = false;
    savedArgsRef.current = null;
  }, [stop]);

  return {
    throttled: throttledFunction,
    cancel
  };
};
