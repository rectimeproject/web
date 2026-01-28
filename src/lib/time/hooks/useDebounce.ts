import {useCallback, useEffect, useRef} from "react";
import {useTimeout} from "./useTimeout.js";

export const useDebounce = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options?: {leading?: boolean}
) => {
  const {leading = false} = options || {};
  const {start, stop} = useTimeout(
    () => {
      if (!leading) {
        savedCallbackRef.current(...savedArgsRef.current);
      }
      isLeadingCallRef.current = false;
    },
    delay,
    {autoStart: false}
  );

  const savedCallbackRef = useRef(callback);
  const savedArgsRef = useRef<unknown[]>([]);
  const isLeadingCallRef = useRef(false);

  useEffect(() => {
    savedCallbackRef.current = callback;
  }, [callback]);

  const debouncedFunction = useCallback(
    (...args: Parameters<T>) => {
      savedArgsRef.current = args;

      if (leading && !isLeadingCallRef.current) {
        savedCallbackRef.current(...args);
        isLeadingCallRef.current = true;
      }

      stop();
      start();
    },
    [start, stop, leading]
  );

  const cancel = useCallback(() => {
    stop();
    isLeadingCallRef.current = false;
  }, [stop]);

  const flush = useCallback(() => {
    if (!isLeadingCallRef.current) {
      savedCallbackRef.current(...savedArgsRef.current);
    }
    stop();
    isLeadingCallRef.current = false;
  }, [stop]);

  return {
    debounced: debouncedFunction,
    cancel,
    flush
  };
};
