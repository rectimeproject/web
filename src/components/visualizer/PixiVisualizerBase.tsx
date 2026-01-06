import {ReactNode} from "react";
import * as PIXI from "pixi.js";
import {usePixiApp} from "../../hooks/visualizer/usePixiApp";
import {useResizeObserver} from "../../hooks/visualizer/useResizeObserver";

interface PixiVisualizerBaseProps {
  canvasWidth?: number | string;
  canvasHeight?: number | string;
  backgroundColor?: number;
  children: (context: {
    barsContainerRef: React.RefObject<PIXI.Container | null>;
    markersContainerRef: React.RefObject<PIXI.Container | null>;
    isPixiReady: boolean;
    dimensions: {width: number; height: number};
  }) => ReactNode;
}

/**
 * Base component for PixiJS visualizers
 * Handles PixiJS app initialization, canvas mounting, and resize
 */
export default function PixiVisualizerBase({
  canvasWidth = "100%",
  canvasHeight = 256,
  backgroundColor = 0xe9ecef,
  children
}: PixiVisualizerBaseProps) {
  const {containerRef, appRef, barsContainerRef, markersContainerRef, isPixiReady} =
    usePixiApp({
      width: 800,
      height: typeof canvasHeight === "number" ? canvasHeight : 256,
      backgroundColor
    });

  const dimensions = useResizeObserver({
    containerRef,
    appRef,
    canvasHeight
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        position: "relative"
      }}
    >
      {children({
        barsContainerRef,
        markersContainerRef,
        isPixiReady,
        dimensions
      })}
    </div>
  );
}
