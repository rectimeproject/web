import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

interface UsePixiAppOptions {
  width: number;
  height: number;
  backgroundColor: number;
}

interface UsePixiAppReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  appRef: React.RefObject<PIXI.Application | null>;
  barsContainerRef: React.RefObject<PIXI.Container | null>;
  markersContainerRef: React.RefObject<PIXI.Container | null>;
  isPixiReady: boolean;
}

/**
 * Hook to manage PixiJS Application lifecycle
 * Handles initialization, canvas mounting, and cleanup
 */
export function usePixiApp({
  width,
  height,
  backgroundColor
}: UsePixiAppOptions): UsePixiAppReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const barsContainerRef = useRef<PIXI.Container | null>(null);
  const markersContainerRef = useRef<PIXI.Container | null>(null);
  const [isPixiReady, setIsPixiReady] = useState(false);

  // Initialize PixiJS app (PixiJS 8 async initialization)
  useEffect(() => {
    if (!containerRef.current) return;

    let cleanedUp = false;

    (async () => {
      const app = new PIXI.Application();

      await app.init({
        width,
        height,
        background: backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });

      if (cleanedUp) {
        app.destroy(true, { children: true });
        return;
      }

      if (!containerRef.current) return;

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      const barsContainer = new PIXI.Container();
      const markersContainer = new PIXI.Container();
      app.stage.addChild(barsContainer);
      app.stage.addChild(markersContainer);

      barsContainerRef.current = barsContainer;
      markersContainerRef.current = markersContainer;

      console.log("[usePixiApp] PixiJS initialized, ready to create bars");
      setIsPixiReady(true);
    })();

    return () => {
      cleanedUp = true;
      setIsPixiReady(false);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        markersContainerRef.current = null;
      }
    };
  }, [width, height, backgroundColor]);

  return {
    containerRef,
    appRef,
    barsContainerRef,
    markersContainerRef,
    isPixiReady
  };
}
