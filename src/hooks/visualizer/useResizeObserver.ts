import { useEffect, useState } from "react";
import * as PIXI from "pixi.js";

interface UseDimensionsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  appRef: React.RefObject<PIXI.Application | null>;
  canvasHeight: number | string;
}

interface Dimensions {
  width: number;
  height: number;
}

/**
 * Hook to track container dimensions and resize PixiJS renderer
 */
export function useResizeObserver({
  containerRef,
  appRef,
  canvasHeight
}: UseDimensionsOptions): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 800, height: 256 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const { width } = entries[0]?.contentRect ?? { width: 800 };
      const height =
        typeof canvasHeight === "number"
          ? canvasHeight
          : (entries[0]?.contentRect.height ?? 256);
      setDimensions({ width, height });
      appRef.current?.renderer.resize(width, height);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, appRef, canvasHeight]);

  return dimensions;
}
