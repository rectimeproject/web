import {useEffect} from "react";
import * as PIXI from "pixi.js";

interface Dimensions {
  width: number;
  height: number;
}

interface UseTimelineWaveformOptions {
  waveformSamples: number[];
  barsRef: React.RefObject<PIXI.Graphics[]>;
  dimensions: Dimensions;
  barColor: number;
  samplesPerSecond: number | undefined;
  timeWindowSeconds: number | undefined;
}

/**
 * Hook to render timeline waveform visualization
 * Displays amplitude samples over time with scrolling window
 */
export function useTimelineWaveform({
  waveformSamples,
  barsRef,
  dimensions,
  barColor,
  samplesPerSecond = 20,
  timeWindowSeconds
}: UseTimelineWaveformOptions): void {
  useEffect(() => {
    console.log("[useTimelineWaveform] Rendering", {
      barsLength: barsRef.current.length,
      samplesLength: waveformSamples.length
    });

    if (!barsRef.current.length) {
      console.log("[useTimelineWaveform] No bars created yet");
      return;
    }

    if (waveformSamples.length === 0) {
      console.log("[useTimelineWaveform] No waveform samples, clearing bars");
      // Clear all bars and return
      barsRef.current.forEach(bar => {
        if (bar && !bar.destroyed) {
          bar.clear();
        }
      });
      return;
    }

    // If timeWindowSeconds is undefined, show all samples
    // Otherwise show only the last N seconds
    const maxSamplesInWindow = timeWindowSeconds
      ? samplesPerSecond * timeWindowSeconds
      : waveformSamples.length;

    // Get the samples to display
    const startIndex = Math.max(0, waveformSamples.length - maxSamplesInWindow);
    const visibleSamples = waveformSamples.slice(startIndex);

    // Calculate bar width - fixed width for consistent appearance
    const barSpacing = 2;
    // Fixed bar width based on canvas width as reference
    const barWidth = 6;

    // Clear all bars first
    barsRef.current.forEach(bar => {
      if (bar && !bar.destroyed) {
        bar.clear();
      }
    });

    // Render visible waveform bars (only as many as we have bars for)
    const samplesToRender = Math.min(
      visibleSamples.length,
      barsRef.current.length
    );

    console.log("[useTimelineWaveform] Rendering waveform", {
      visibleSamplesLength: visibleSamples.length,
      barsLength: barsRef.current.length,
      samplesToRender,
      barWidth,
      canvasWidth: dimensions.width
    });

    for (let i = 0; i < samplesToRender; i++) {
      const amplitude = visibleSamples[i] ?? null;
      const bar = barsRef.current[i] ?? null;

      if (bar === null || amplitude === null || bar.destroyed) {
        if (bar?.destroyed) {
          console.warn("Bar has been destroyed, skipping");
        } else {
          console.warn("Bar or amplitude data missing");
        }
        continue;
      }

      const x = i * (barWidth + barSpacing);

      // Normalize amplitude to be more visible (0-100 range from usePlaybackWaveform)
      // Apply logarithmic scaling for better visual representation
      const normalizedAmp = Math.min(amplitude / 100, 1);
      const boostedAmp = Math.pow(normalizedAmp, 0.7); // Power curve for better visibility
      // Bars grow from center, occupying up to 80% of canvas height total
      const maxBarHeight = dimensions.height * 0.8;
      const minBarHeight = 4;
      const height = Math.max(boostedAmp * maxBarHeight, minBarHeight);
      // Position bar from vertical center, growing up and down equally
      const centerY = dimensions.height / 2;
      const y = centerY - height / 2;

      bar.clear();

      // Draw rounded rectangle for smoother appearance
      const radius = Math.min(barWidth / 2, 2);
      bar.roundRect(x, y, barWidth, height, radius);

      // Full opacity for better visibility
      bar.fill({color: barColor, alpha: 1});
    }
  }, [
    waveformSamples,
    barsRef,
    dimensions,
    barColor,
    samplesPerSecond,
    timeWindowSeconds
  ]);
}
