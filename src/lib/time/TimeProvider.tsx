import {
  createContext,
  useContext,
  useRef,
  useEffect,
  ReactNode,
  useCallback,
  FC
} from "react";

interface Timer {
  id: number;
  type: "timeout" | "interval" | "animationFrame";
  cleanup: () => void;
}

interface TimeContextType {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
  setInterval: (callback: () => void, delay: number) => number;
  clearInterval: (id: number) => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
  clearAllTimers: () => void;
}

const TimeContext = createContext<TimeContextType | null>(null);

interface TimeProviderProps {
  children: ReactNode;
}

export const TimeProvider: FC<TimeProviderProps> = ({children}) => {
  const timersRef = useRef<Map<number, Timer>>(new Map());
  const idCounterRef = useRef(0);

  const generateId = useCallback(() => {
    idCounterRef.current += 1;
    return idCounterRef.current;
  }, []);

  const setTimeout = useCallback(
    (callback: () => void, delay: number): number => {
      const id = generateId();
      const timeoutId = window.setTimeout(() => {
        callback();
        timersRef.current.delete(id);
      }, delay);

      timersRef.current.set(id, {
        id,
        type: "timeout",
        cleanup: () => window.clearTimeout(timeoutId)
      });

      return id;
    },
    [generateId]
  );

  const clearTimeout = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer) {
      timer.cleanup();
      timersRef.current.delete(id);
    }
  }, []);

  const setInterval = useCallback(
    (callback: () => void, delay: number): number => {
      const id = generateId();
      const intervalId = window.setInterval(callback, delay);

      timersRef.current.set(id, {
        id,
        type: "interval",
        cleanup: () => window.clearInterval(intervalId)
      });

      return id;
    },
    [generateId]
  );

  const clearInterval = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer) {
      timer.cleanup();
      timersRef.current.delete(id);
    }
  }, []);

  const requestAnimationFrame = useCallback(
    (callback: FrameRequestCallback): number => {
      const id = generateId();
      const rafId = window.requestAnimationFrame(callback);

      timersRef.current.set(id, {
        id,
        type: "animationFrame",
        cleanup: () => window.cancelAnimationFrame(rafId)
      });

      return id;
    },
    [generateId]
  );

  const cancelAnimationFrame = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer) {
      timer.cleanup();
      timersRef.current.delete(id);
    }
  }, []);

  const clearAllTimers = useCallback((): void => {
    timersRef.current.forEach(timer => {
      timer.cleanup();
    });
    timersRef.current.clear();
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const value: TimeContextType = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame,
    cancelAnimationFrame,
    clearAllTimers
  };

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
};

export const useTime = (): TimeContextType => {
  const context = useContext(TimeContext);
  if (context === null) {
    throw new Error("useTime must be used within a TimeProvider");
  }
  return context;
};
