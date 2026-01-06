import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

type VisualizationMode =
  | { type: "frequency"; barCount?: number }
  | { type: "timeline"; samplesPerSecond?: number; timeWindowSeconds?: number };

interface UseVisualizerBarsOptions {
  visualizationMode: VisualizationMode;
  isPixiReady: boolean;
  barsContainerRef: React.RefObject<PIXI.Container | null>;
}

/**
 * Hook to manage PIXI Graphics bars based on visualization mode
 * Dynamically creates/destroys bars when mode or count changes
 */
export function useVisualizerBars({
  visualizationMode,
  isPixiReady,
  barsContainerRef
}: UseVisualizerBarsOptions): React.RefObject<PIXI.Graphics[]> {
  const barsRef = useRef<PIXI.Graphics[]>([]);

  useEffect(() => {
    console.log("[useVisualizerBars] Bar creation effect", {
      isPixiReady,
      hasBarsContainer: !!barsContainerRef.current,
      visualizationMode: visualizationMode.type
    });

    if (!isPixiReady || !barsContainerRef.current) {
      console.log("[useVisualizerBars] Skipping bar creation - PixiJS not ready yet");
      return;
    }

    const container = barsContainerRef.current;

    // Determine how many bars we need
    let barCount = 64; // Default for frequency mode
    if (visualizationMode.type === "frequency") {
      barCount = visualizationMode.barCount ?? 64;
    } else if (visualizationMode.type === "timeline") {
      // For timeline, calculate based on time window
      const samplesPerSecond = visualizationMode.samplesPerSecond ?? 20;
      const timeWindowSeconds = visualizationMode.timeWindowSeconds ?? 10;
      barCount = samplesPerSecond * timeWindowSeconds; // e.g., 20 * 10 = 200 bars
    }

    // Only recreate bars if the count changed
    if (barsRef.current.length !== barCount) {
      // Clear existing bars
      barsRef.current.forEach(bar => {
        container.removeChild(bar);
        bar.destroy();
      });
      barsRef.current = [];

      // Create new bars
      const bars: PIXI.Graphics[] = [];
      for (let i = 0; i < barCount; i++) {
        const bar = new PIXI.Graphics();
        container.addChild(bar);
        bars.push(bar);
      }
      barsRef.current = bars;
      console.log(
        `[useVisualizerBars] Created ${barCount} bars for ${visualizationMode.type} mode`
      );
    }
  }, [visualizationMode, isPixiReady, barsContainerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (barsContainerRef.current) {
        barsRef.current.forEach(bar => {
          barsContainerRef.current?.removeChild(bar);
          bar.destroy();
        });
      }
      barsRef.current = [];
    };
  }, [barsContainerRef]);

  return barsRef;
}
