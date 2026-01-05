import { useEffect, useRef, useState } from 'react';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';
import * as PIXI from 'pixi.js';

interface IBookmark {
  id: string;
  durationOffset: number;
  title?: string;
}

type VisualizationMode =
  | { type: 'frequency'; barCount?: number }
  | { type: 'timeline'; samplesPerSecond?: number };

interface Props {
  analyserNode: AnalyserNode<IAudioContext> | null;
  isPlaying: boolean;
  canvasWidth?: number | string;
  canvasHeight?: number | string;
  visualizationMode: VisualizationMode;
  bookmarks?: IBookmark[];
  currentDuration?: number;
  totalDuration?: number;
  onBookmarkClick?: (bookmark: IBookmark) => void;
  backgroundColor?: number;
  barColor?: number;
  bookmarkColor?: number;
  // Timeline-specific props
  waveformSamples?: number[]; // Amplitude samples for timeline mode
  playbackPosition?: number; // Current playback position in ms for timeline mode
}

export default function PixiAnalyserNodeView({
  analyserNode,
  isPlaying,
  canvasWidth = '100%',
  canvasHeight = 256,
  visualizationMode,
  bookmarks = [],
  currentDuration = 0,
  totalDuration,
  onBookmarkClick,
  backgroundColor = 0xE9ECEF,
  barColor = 0x495057,
  bookmarkColor = 0xFF6B6B,
  waveformSamples = [],
  playbackPosition = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const barsRef = useRef<PIXI.Graphics[]>([]);
  const barsContainerRef = useRef<PIXI.Container | null>(null);
  const markersContainerRef = useRef<PIXI.Container | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 256 });

  // Initialize PixiJS app (PixiJS 8 async initialization)
  useEffect(() => {
    if (!containerRef.current) return;

    let cleanedUp = false;

    (async () => {
      const app = new PIXI.Application();

      await app.init({
        width: dimensions.width,
        height: dimensions.height,
        background: backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
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

      // Bars will be created dynamically based on visualization mode
      barsRef.current = [];
    })();

    return () => {
      cleanedUp = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        barsRef.current = [];
        markersContainerRef.current = null;
      }
    };
  }, [dimensions, backgroundColor]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 800 };
      const height = typeof canvasHeight === 'number'
        ? canvasHeight
        : entries[0]?.contentRect.height ?? 256;
      setDimensions({ width, height });
      appRef.current?.renderer.resize(width, height);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [canvasHeight]);

  // Dynamically create/update bars based on visualization mode
  useEffect(() => {
    if (!barsContainerRef.current) return;

    const container = barsContainerRef.current;

    // Determine how many bars we need
    let barCount = 64; // Default for frequency mode
    if (visualizationMode.type === 'frequency') {
      barCount = visualizationMode.barCount ?? 64;
    } else if (visualizationMode.type === 'timeline') {
      // For timeline, we need one bar per sample (up to a reasonable limit)
      barCount = Math.min(waveformSamples.length, 2000);
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
    }
  }, [visualizationMode, waveformSamples.length]);

  // Render visualization based on mode
  useEffect(() => {
    if (visualizationMode.type === 'frequency') {
      // Frequency mode: real-time frequency bars
      if (!analyserNode || !isPlaying || !barsRef.current.length) return;

      analyserNode.fftSize = 2 ** 10;
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -10;

      const data = new Uint8Array(analyserNode.frequencyBinCount);
      const barCount = visualizationMode.barCount ?? 64;
      const barWidth = dimensions.width / barCount;
      let frameId: number;

      const draw = () => {
        analyserNode.getByteFrequencyData(data);

        barsRef.current.forEach((bar, i) => {
          const height = Math.max(data[i] ?? 0, 10);
          const x = i * barWidth;
          const y = dimensions.height / 2 - height / 2;

          bar.clear();
          bar.rect(x, y, barWidth - 1, height);
          bar.fill(barColor);
        });

        frameId = requestAnimationFrame(draw);
      };

      frameId = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(frameId);
        barsRef.current.forEach(bar => bar.clear());
      };
    } else if (visualizationMode.type === 'timeline') {
      // Timeline mode: render waveform from samples
      if (!barsRef.current.length || waveformSamples.length === 0) return;

      const totalDurationMs = totalDuration ?? currentDuration;
      if (!totalDurationMs) return;

      // Calculate bar width based on duration and samples
      const barWidth = Math.max(2, dimensions.width / waveformSamples.length);

      // Render waveform bars
      barsRef.current.forEach(bar => bar.clear());

      waveformSamples.forEach((amplitude, i) => {
        if (i >= barsRef.current.length) return;

        const bar = barsRef.current[i];
        const x = i * barWidth;
        const height = Math.max((amplitude / 255) * dimensions.height * 0.8, 4);
        const y = dimensions.height / 2 - height / 2;

        bar.clear();
        bar.rect(x, y, Math.max(barWidth - 1, 1), height);
        bar.fill(barColor);
      });

      // Draw playback position indicator
      if (playbackPosition > 0 && totalDurationMs > 0) {
        const positionX = (playbackPosition / totalDurationMs) * dimensions.width;
        const indicator = barsRef.current[0]; // Reuse first bar for indicator

        if (indicator) {
          indicator.clear();
          indicator.rect(positionX - 1, 0, 2, dimensions.height);
          indicator.fill(bookmarkColor);
        }
      }
    }
  }, [
    visualizationMode,
    analyserNode,
    isPlaying,
    dimensions,
    barColor,
    waveformSamples,
    playbackPosition,
    totalDuration,
    currentDuration,
    bookmarkColor,
  ]);

  // Render bookmark markers (Samsung Recorder style - minimalist, mobile-optimized)
  useEffect(() => {
    if (!markersContainerRef.current) return;

    const container = markersContainerRef.current;
    container.removeChildren();

    const duration = totalDuration ?? currentDuration;
    if (!duration) return;

    const TOUCH_TARGET_WIDTH = 48; // 48px touch target (Material Design guideline)
    const LINE_WIDTH = 2;

    bookmarks.forEach((bookmark) => {
      const x = (bookmark.durationOffset / duration) * dimensions.width;

      // Create container for this bookmark
      const markerContainer = new PIXI.Container();
      markerContainer.x = x;

      // Visual line (simple vertical line, no decorations)
      const line = new PIXI.Graphics();
      line.moveTo(0, 0);
      line.lineTo(0, dimensions.height);
      line.stroke({ width: LINE_WIDTH, color: bookmarkColor, alpha: 0.85 });

      // Hit area (wider for touch devices, invisible)
      const hitArea = new PIXI.Graphics();
      hitArea.rect(-TOUCH_TARGET_WIDTH / 2, 0, TOUCH_TARGET_WIDTH, dimensions.height);
      hitArea.fill({ color: 0x000000, alpha: 0 });

      hitArea.interactive = true;
      hitArea.cursor = 'pointer';
      hitArea.hitArea = new PIXI.Rectangle(
        -TOUCH_TARGET_WIDTH / 2,
        0,
        TOUCH_TARGET_WIDTH,
        dimensions.height
      );

      // Event handlers
      hitArea.on('click', () => onBookmarkClick?.(bookmark));
      hitArea.on('tap', () => onBookmarkClick?.(bookmark));

      // Visual feedback - brighten line on hover/touch
      hitArea.on('pointerover', () => {
        line.alpha = 1;
        line.clear();
        line.moveTo(0, 0);
        line.lineTo(0, dimensions.height);
        line.stroke({ width: LINE_WIDTH + 1, color: bookmarkColor, alpha: 1 });
      });

      hitArea.on('pointerout', () => {
        line.clear();
        line.moveTo(0, 0);
        line.lineTo(0, dimensions.height);
        line.stroke({ width: LINE_WIDTH, color: bookmarkColor, alpha: 0.85 });
      });

      hitArea.on('pointerdown', () => {
        line.alpha = 0.6;
      });

      hitArea.on('pointerup', () => {
        line.alpha = 1;
      });

      markerContainer.addChild(line);
      markerContainer.addChild(hitArea);
      container.addChild(markerContainer);
    });
  }, [bookmarks, dimensions, currentDuration, totalDuration, onBookmarkClick, bookmarkColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        position: 'relative'
      }}
    />
  );
}
