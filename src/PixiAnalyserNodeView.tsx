import { useEffect, useRef, useState } from 'react';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';
import * as PIXI from 'pixi.js';

interface IBookmark {
  id: string;
  durationOffset: number;
  title?: string;
}

interface Props {
  analyserNode: AnalyserNode<IAudioContext> | null;
  isPlaying: boolean;
  canvasWidth?: number | string;
  canvasHeight?: number | string;
  visualizationMode: { type: 'verticalBars'; barWidth: number };
  bookmarks?: IBookmark[];
  currentDuration?: number;
  totalDuration?: number;
  onBookmarkClick?: (bookmark: IBookmark) => void;
}

export default function PixiAnalyserNodeView({
  analyserNode,
  isPlaying,
  canvasWidth = '100%',
  canvasHeight = 256,
  bookmarks = [],
  currentDuration = 0,
  totalDuration,
  onBookmarkClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const barsRef = useRef<PIXI.Graphics[]>([]);
  const markersContainerRef = useRef<PIXI.Container | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 256 });

  // Initialize PixiJS app
  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application({
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const barsContainer = new PIXI.Container();
    const markersContainer = new PIXI.Container();
    app.stage.addChild(barsContainer);
    app.stage.addChild(markersContainer);

    markersContainerRef.current = markersContainer;

    // Create 64 bar graphics (reuse for performance)
    const bars: PIXI.Graphics[] = [];
    for (let i = 0; i < 64; i++) {
      const bar = new PIXI.Graphics();
      barsContainer.addChild(bar);
      bars.push(bar);
    }
    barsRef.current = bars;

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
      barsRef.current = [];
      markersContainerRef.current = null;
    };
  }, [dimensions]);

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

  // Render frequency bars animation
  useEffect(() => {
    if (!analyserNode || !isPlaying || !barsRef.current.length) return;

    analyserNode.fftSize = 2 ** 10;
    analyserNode.minDecibels = -90;
    analyserNode.maxDecibels = -10;

    const data = new Uint8Array(analyserNode.frequencyBinCount);
    const barWidth = dimensions.width / 64;
    let frameId: number;

    const draw = () => {
      analyserNode.getByteFrequencyData(data);

      barsRef.current.forEach((bar, i) => {
        const height = Math.max(data[i] ?? 0, 10);
        const x = i * barWidth;
        const y = dimensions.height / 2 - height / 2;

        bar.clear();
        bar.beginFill(0x495057); // #495057 gray
        bar.drawRect(x, y, barWidth - 1, height);
        bar.endFill();
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      barsRef.current.forEach(bar => bar.clear());
    };
  }, [analyserNode, isPlaying, dimensions]);

  // Render bookmark markers
  useEffect(() => {
    if (!markersContainerRef.current) return;

    const container = markersContainerRef.current;
    container.removeChildren();

    const duration = totalDuration ?? currentDuration;
    if (!duration) return;

    bookmarks.forEach((bookmark) => {
      const x = (bookmark.durationOffset / duration) * dimensions.width;

      const marker = new PIXI.Graphics();
      marker.lineStyle(2, 0xFF6B6B); // Red
      marker.moveTo(x, 0);
      marker.lineTo(x, dimensions.height);
      marker.beginFill(0xFF6B6B);
      marker.drawCircle(x, 10, 6);
      marker.endFill();

      marker.interactive = true;
      marker.cursor = 'pointer';
      marker.on('click', () => onBookmarkClick?.(bookmark));
      marker.on('tap', () => onBookmarkClick?.(bookmark));
      marker.on('pointerover', () => { marker.alpha = 0.7; });
      marker.on('pointerout', () => { marker.alpha = 1; });

      container.addChild(marker);
    });
  }, [bookmarks, dimensions, currentDuration, totalDuration, onBookmarkClick]);

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
