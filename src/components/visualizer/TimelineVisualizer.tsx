import {Application, Graphics} from "pixi.js";
import {useEffect, useRef} from "react";
import {IAnalyserNode, IAudioContext} from "standardized-audio-context";

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MIN_BAR_HEIGHT = 2;

/**
 * Calculate RMS (Root Mean Square) amplitude from PCM data
 * Returns value in range 0-1
 */
function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / buffer.length);
}

export default function TimelineVisualizer({
  canvasWidth,
  canvasHeight,
  analyserNodeRef,
  backgroundColor = 0x1a1a1a,
  barColor = 0x007aff
}: {
  analyserNodeRef: React.RefObject<IAnalyserNode<IAudioContext> | null>;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor?: number;
  barColor?: number;
}) {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const barsRef = useRef<Graphics[]>([]);
  const amplitudesRef = useRef<number[]>([]);
  const timeDomainDataRef = useRef<Float32Array | null>(null);
  const frameCounterRef = useRef(0);
  const barColorRef = useRef(barColor);

  // Keep bar color in sync via effect
  useEffect(() => {
    barColorRef.current = barColor;
  }, [barColor]);

  useEffect(() => {
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }

    const app = new Application();
    let isDestroyed = false;

    const init = async () => {
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });

      if (isDestroyed || !canvasContainerRef.current) {
        return;
      }

      canvasContainerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Calculate bar count based on canvas width
      const barStep = BAR_WIDTH + BAR_GAP;
      const barCount = Math.floor(canvasWidth / barStep);

      // Initialize amplitude buffer with zeros
      amplitudesRef.current = new Array(barCount).fill(0);

      // Create bar graphics - positioned from left, will scroll
      const bars: Graphics[] = [];
      for (let i = 0; i < barCount; i++) {
        const bar = new Graphics();
        bar.x = i * barStep;
        bars.push(bar);
        app.stage.addChild(bar);
      }
      barsRef.current = bars;

      // Main render loop
      app.ticker.add(() => {
        const analyserNode = analyserNodeRef.current;
        const centerY = canvasHeight / 2;
        const maxBarHeight = canvasHeight * 0.8; // 80% of canvas height

        // Sample audio data every few frames for smoother visualization
        frameCounterRef.current++;
        if (frameCounterRef.current % 2 === 0 && analyserNode) {
          // Ensure buffer is correct size
          if (
            !timeDomainDataRef.current ||
            timeDomainDataRef.current.length !== analyserNode.fftSize
          ) {
            timeDomainDataRef.current = new Float32Array(analyserNode.fftSize);
          }

          // Get PCM data
          analyserNode.getFloatTimeDomainData(timeDomainDataRef.current);

          // Calculate amplitude
          const rms = calculateRMS(timeDomainDataRef.current);
          // Apply some gain and clamp to 0-1
          const amplitude = Math.min(1, rms * 3);

          // Shift amplitudes left and add new value at the end
          amplitudesRef.current.shift();
          amplitudesRef.current.push(amplitude);
        }

        // Redraw all bars based on current amplitudes
        const bars = barsRef.current;
        const amplitudes = amplitudesRef.current;

        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i];
          const amplitude = amplitudes[i] ?? 0;

          if (!bar) continue;

          // Calculate bar height from amplitude, centered vertically
          const barHeight = Math.max(MIN_BAR_HEIGHT, amplitude * maxBarHeight);

          bar.clear();
          bar.roundRect(0, centerY - barHeight / 2, BAR_WIDTH, barHeight, 1);
          bar.fill(barColorRef.current);
        }
      });

      app.start();
    };

    init();

    return () => {
      isDestroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, {children: true});
        appRef.current = null;
      }
      barsRef.current = [];
      amplitudesRef.current = [];
    };
  }, [canvasWidth, canvasHeight, backgroundColor, analyserNodeRef]);

  return (
    <div
      ref={canvasContainerRef}
      style={{width: canvasWidth, height: canvasHeight}}
    />
  );
}
