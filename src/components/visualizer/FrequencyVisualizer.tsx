import {useEffect, useRef} from "react";
import {AnalyserNode, IAudioContext} from "standardized-audio-context";
import PixiVisualizerBase from "./PixiVisualizerBase";
import {useVisualizerBars} from "../../hooks/visualizer/useVisualizerBars";
import useTheme from "../../useTheme";
import * as PIXI from "pixi.js";

interface FrequencyVisualizerProps {
  analyserNode: AnalyserNode<IAudioContext> | null;
  isPlaying: boolean;
  canvasWidth?: number | string;
  canvasHeight?: number | string;
  barCount?: number;
}

/**
 * Frequency visualization component
 * Displays real-time FFT frequency spectrum with scrolling bars
 */
export default function FrequencyVisualizer({
  analyserNode,
  isPlaying,
  canvasWidth = "100%",
  canvasHeight = 256,
  barCount = 64
}: FrequencyVisualizerProps) {
  const backdropsRef = useRef<PIXI.Graphics[]>([]);
  const scrollOffsetRef = useRef(0);
  const {colors} = useTheme();

  // Derive backdrop color from bar color (lighter/darker based on theme)
  const backdropColor =
    colors.barColor === 0x1d1d1f
      ? 0xd1d5db // Light theme: use light gray backdrop
      : 0x3a3a3c; // Dark theme: use darker gray backdrop

  return (
    <PixiVisualizerBase
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      backgroundColor={colors.background}
    >
      {({barsContainerRef, isPixiReady, dimensions}) => {
        const barsRef = useVisualizerBars({
          visualizationMode: {type: "frequency", barCount},
          isPixiReady,
          barsContainerRef
        });

        // Create backdrop bars
        useEffect(() => {
          if (!isPixiReady || !barsContainerRef.current) return;

          const container = barsContainerRef.current;

          // Clear existing backdrops
          backdropsRef.current.forEach(backdrop => {
            container.removeChild(backdrop);
            backdrop.destroy();
          });
          backdropsRef.current = [];

          // Create backdrop bars
          const backdrops: PIXI.Graphics[] = [];
          for (let i = 0; i < barCount; i++) {
            const backdrop = new PIXI.Graphics();
            container.addChildAt(backdrop, i); // Add behind the actual bars
            backdrops.push(backdrop);
          }
          backdropsRef.current = backdrops;

          return () => {
            backdropsRef.current.forEach(backdrop => {
              container.removeChild(backdrop);
              backdrop.destroy();
            });
            backdropsRef.current = [];
          };
        }, [isPixiReady, barsContainerRef, barCount]);

        // Frequency mode rendering effect
        useEffect(() => {
          if (!analyserNode || !isPlaying || !barsRef.current.length) return;

          analyserNode.fftSize = 2 ** 10;
          analyserNode.minDecibels = -90;
          analyserNode.maxDecibels = -10;

          const data = new Uint8Array(analyserNode.frequencyBinCount);
          const barSpacing = 4;
          const barWidth = 8;
          let frameId: number;

          const draw = () => {
            analyserNode.getByteFrequencyData(data);

            // Auto-scroll effect: move bars to the left over time
            scrollOffsetRef.current += 0.5;
            if (scrollOffsetRef.current >= barWidth + barSpacing) {
              scrollOffsetRef.current = 0;
            }

            barsRef.current.forEach((bar, i) => {
              const rawHeight = data[i] ?? 0;
              // Bars occupy 80% of canvas height
              const maxBarHeight = dimensions.height * 0.8;
              const minBarHeight = 8;
              const normalizedHeight = (rawHeight / 255) * maxBarHeight;
              const height = Math.max(normalizedHeight, minBarHeight);

              const x = i * (barWidth + barSpacing) - scrollOffsetRef.current;
              const centerY = dimensions.height / 2;
              const y = centerY - height / 2;

              // Draw backdrop (full height at 80%)
              const backdrop = backdropsRef.current[i];
              if (backdrop) {
                const backdropHeight = maxBarHeight;
                const backdropY = centerY - backdropHeight / 2;
                backdrop.clear();
                backdrop.rect(x, backdropY, barWidth, backdropHeight);
                backdrop.fill(backdropColor);
              }

              // Draw actual frequency bar
              bar.clear();
              bar.rect(x, y, barWidth, height);
              bar.fill(colors.barColor);
            });

            frameId = requestAnimationFrame(draw);
          };

          frameId = requestAnimationFrame(draw);

          return () => {
            cancelAnimationFrame(frameId);
            barsRef.current.forEach(bar => bar.clear());
            backdropsRef.current.forEach(backdrop => backdrop.clear());
          };
        }, [
          analyserNode,
          isPlaying,
          dimensions,
          colors.barColor,
          backdropColor,
          barsRef
        ]);

        return null;
      }}
    </PixiVisualizerBase>
  );
}
