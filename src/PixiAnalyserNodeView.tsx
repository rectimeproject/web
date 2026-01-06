import {useEffect} from "react";
import {AnalyserNode, IAudioContext} from "standardized-audio-context";
import * as PIXI from "pixi.js";
import {usePixiApp} from "./hooks/visualizer/usePixiApp";
import {useResizeObserver} from "./hooks/visualizer/useResizeObserver";
import {useVisualizerBars} from "./hooks/visualizer/useVisualizerBars";
import {useTimelineWaveform} from "./hooks/visualizer/useTimelineWaveform";

interface IBookmark {
  id: string;
  durationOffset: number;
  title?: string;
}

type VisualizationMode =
  | {type: "frequency"; barCount?: number}
  | {type: "timeline"; samplesPerSecond?: number; timeWindowSeconds?: number};

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
  canvasWidth = "100%",
  canvasHeight = 256,
  visualizationMode,
  bookmarks = [],
  currentDuration = 0,
  totalDuration,
  onBookmarkClick,
  backgroundColor = 0xe9ecef,
  barColor = 0x495057,
  bookmarkColor = 0xff6b6b,
  waveformSamples = []
}: Props) {
  // Use extracted hooks
  const {
    containerRef,
    appRef,
    barsContainerRef,
    markersContainerRef,
    isPixiReady
  } = usePixiApp({
    width: 800,
    height: typeof canvasHeight === "number" ? canvasHeight : 256,
    backgroundColor
  });

  const dimensions = useResizeObserver({
    containerRef,
    appRef,
    canvasHeight
  });

  const barsRef = useVisualizerBars({
    visualizationMode,
    isPixiReady,
    barsContainerRef
  });

  // Use timeline waveform hook if in timeline mode
  useTimelineWaveform({
    waveformSamples:
      visualizationMode.type === "timeline" ? waveformSamples : [],
    barsRef,
    dimensions,
    barColor,
    samplesPerSecond:
      visualizationMode.type === "timeline"
        ? visualizationMode.samplesPerSecond
        : undefined,
    timeWindowSeconds:
      visualizationMode.type === "timeline"
        ? visualizationMode.timeWindowSeconds
        : undefined
  });

  // Frequency mode rendering (timeline is handled by useTimelineWaveform hook)
  useEffect(() => {
    if (visualizationMode.type !== "frequency") return;

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
  }, [visualizationMode, analyserNode, isPlaying, dimensions, barColor, barsRef]);

  // Render bookmark markers (Samsung Recorder style - minimalist, mobile-optimized)
  useEffect(() => {
    if (!markersContainerRef.current) return;

    const container = markersContainerRef.current;
    container.removeChildren();

    const duration = totalDuration ?? currentDuration;
    if (!duration) return;

    const TOUCH_TARGET_WIDTH = 48; // 48px touch target (Material Design guideline)
    const LINE_WIDTH = 2;

    // For timeline mode with scrolling window, calculate visible time range
    let visibleStartMs = 0;
    let visibleEndMs = duration;

    if (visualizationMode.type === "timeline") {
      const timeWindowSeconds = visualizationMode.timeWindowSeconds ?? 10;
      const timeWindowMs = timeWindowSeconds * 1000;
      visibleStartMs = Math.max(0, duration - timeWindowMs);
      visibleEndMs = duration;
    }

    bookmarks.forEach(bookmark => {
      // For timeline mode, only show bookmarks in the visible window
      if (visualizationMode.type === "timeline") {
        if (
          bookmark.durationOffset < visibleStartMs ||
          bookmark.durationOffset > visibleEndMs
        ) {
          return; // Skip bookmarks outside the visible window
        }

        // Calculate position relative to the visible window
        const relativeOffset = bookmark.durationOffset - visibleStartMs;
        const windowDuration = visibleEndMs - visibleStartMs;
        const x = (relativeOffset / windowDuration) * dimensions.width;

        // Create bookmark marker
        createBookmarkMarker(x, bookmark);
      } else {
        // For frequency mode, use full duration
        const x = (bookmark.durationOffset / duration) * dimensions.width;
        createBookmarkMarker(x, bookmark);
      }
    });

    function createBookmarkMarker(x: number, bookmark: IBookmark) {
      // Create container for this bookmark
      const markerContainer = new PIXI.Container();
      markerContainer.x = x;

      // Visual line (simple vertical line, no decorations)
      const line = new PIXI.Graphics();
      line.moveTo(0, 0);
      line.lineTo(0, dimensions.height);
      line.stroke({width: LINE_WIDTH, color: bookmarkColor, alpha: 0.85});

      // Hit area (wider for touch devices, invisible)
      const hitArea = new PIXI.Graphics();
      hitArea.rect(
        -TOUCH_TARGET_WIDTH / 2,
        0,
        TOUCH_TARGET_WIDTH,
        dimensions.height
      );
      hitArea.fill({color: 0x000000, alpha: 0});

      hitArea.interactive = true;
      hitArea.cursor = "pointer";
      hitArea.hitArea = new PIXI.Rectangle(
        -TOUCH_TARGET_WIDTH / 2,
        0,
        TOUCH_TARGET_WIDTH,
        dimensions.height
      );

      // Event handlers
      hitArea.on("click", () => onBookmarkClick?.(bookmark));
      hitArea.on("tap", () => onBookmarkClick?.(bookmark));

      // Visual feedback - brighten line on hover/touch
      hitArea.on("pointerover", () => {
        line.alpha = 1;
        line.clear();
        line.moveTo(0, 0);
        line.lineTo(0, dimensions.height);
        line.stroke({width: LINE_WIDTH + 1, color: bookmarkColor, alpha: 1});
      });

      hitArea.on("pointerout", () => {
        line.clear();
        line.moveTo(0, 0);
        line.lineTo(0, dimensions.height);
        line.stroke({width: LINE_WIDTH, color: bookmarkColor, alpha: 0.85});
      });

      hitArea.on("pointerdown", () => {
        line.alpha = 0.6;
      });

      hitArea.on("pointerup", () => {
        line.alpha = 1;
      });

      markerContainer.addChild(line);
      markerContainer.addChild(hitArea);
      container.addChild(markerContainer);
    }
  }, [
    bookmarks,
    dimensions,
    currentDuration,
    totalDuration,
    onBookmarkClick,
    bookmarkColor,
    visualizationMode
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: canvasWidth,
        height: canvasHeight,
        position: "relative"
      }}
    />
  );
}
