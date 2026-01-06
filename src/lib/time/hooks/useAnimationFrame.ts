import {useRef, useEffect, useCallback, useState} from "react";
import {useTime} from "../TimeProvider";

interface UseAnimationFrameOptions {
  autoStart?: boolean;
  limitFps?: number;
}

export const useAnimationFrame = (
  callback: (deltaTime: number) => void,
  options: UseAnimationFrameOptions = {}
) => {
  const {autoStart = true, limitFps} = options;
  const {requestAnimationFrame, cancelAnimationFrame} = useTime();
  const rafIdRef = useRef<number | null>(null);
  const savedCallbackRef = useRef(callback);
  const frameCountRef = useRef(0);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef<number | null>(null);
  const fpsIntervalRef = useRef(limitFps ? 1000 / limitFps : 0);

  // Remember the latest callback
  useEffect(() => {
    savedCallbackRef.current = callback;
  }, [callback]);

  const animate = useCallback(
    (timestamp: number) => {
      if (!rafIdRef.current) return;

      // Calculate delta time
      const deltaTime = lastTimeRef.current
        ? timestamp - lastTimeRef.current
        : 0;
      lastTimeRef.current = timestamp;

      // Calculate FPS
      frameCountRef.current += 1;
      if (timestamp % 1000 < 16) {
        // Update FPS roughly every second
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
      }

      // Throttle if fps limit is set
      if (!fpsIntervalRef.current || deltaTime >= fpsIntervalRef.current) {
        savedCallbackRef.current(deltaTime);
      }

      // Continue animation loop
      rafIdRef.current = requestAnimationFrame(animate);
    },
    [requestAnimationFrame]
  );

  const start = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    lastTimeRef.current = null;
    rafIdRef.current = requestAnimationFrame(animate);
  }, [requestAnimationFrame, cancelAnimationFrame, animate]);

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTimeRef.current = null;
  }, [cancelAnimationFrame]);

  const restart = useCallback(() => {
    stop();
    start();
  }, [stop, start]);

  const isActive = useCallback(() => rafIdRef.current !== null, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return stop;
  }, [autoStart, start, stop]);

  return {
    start,
    stop,
    restart,
    isActive: isActive(),
    fps
  };
};
