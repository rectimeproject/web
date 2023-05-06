import { useCallback, useEffect, useRef } from 'react';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';

interface IRenderingData {
  analyserNode: AnalyserNode<IAudioContext>;
  data: Uint8Array;
  x: number;
  barCount: number;
  offset: number;
  frameId: number;
  lastTime: number | null;
  averageBuffer: Uint8Array;
  sliceWidth: number;
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
}

export default function AnalyserNodeView({
  isPlaying,
  analyserNode,
  canvasWidth,
  canvasHeight,
  visualizationMode,
}: {
  analyserNode: AnalyserNode<IAudioContext> | null;
  isPlaying: boolean;
  canvasHeight?: number | string;
  canvasWidth?: number | string;
  visualizationMode:
    | {
        type: 'verticalBars';
        barWidth: number;
      }
    | {
        type: 'webgl';
        barWidth: number;
      };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderingDataRef = useRef<IRenderingData | null>(null);
  const draw = useCallback<FrameRequestCallback>(
    (now) => {
      const renderingData = renderingDataRef.current;
      if (renderingData === null || isPlaying === null) {
        return;
      }
      const drawImmediately = () => {
        if (renderingDataRef.current) {
          renderingDataRef.current.frameId = requestAnimationFrame(draw);
        }
      };
      if (renderingData.lastTime === null) {
        renderingData.lastTime = now;
        drawImmediately();
        return;
      }
      switch (visualizationMode?.type) {
        case 'verticalBars': {
          /**
           * redraw
           */
          drawImmediately();

          const {
            canvas: current,
            context: ctx,
            analyserNode,
            data,
          } = renderingData;

          ctx.clearRect(0, 0, current.width, current.height);

          analyserNode.getByteFrequencyData(data);

          let x = 0;
          for (const height of data.map((h) => Math.max(h, 10))) {
            ctx.fillStyle = '#495057';
            ctx.fillRect(
              x,
              current.height / 2 - height / 2,
              renderingData.sliceWidth,
              height
            );
            x += renderingData.sliceWidth;
          }
          break;
        }
      }

      renderingData.lastTime = now;
    },
    [visualizationMode, isPlaying]
  );
  const clearRenderingDataRef = useCallback(() => {
    const current = renderingDataRef.current;
    if (current !== null && current.frameId !== null) {
      current.context.fillStyle = '#495057';
      current.context.fillRect(
        0,
        0,
        current.canvas.width,
        current.canvas.height
      );
      cancelAnimationFrame(current.frameId);
      renderingDataRef.current = null;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (
      analyserNode !== null &&
      isPlaying &&
      canvas !== null &&
      canvas.parentNode !== null
    ) {
      if (renderingDataRef.current === null) {
        analyserNode.fftSize = 2 ** 10;
        analyserNode.minDecibels = -90;
        analyserNode.maxDecibels = -10;
        // analyserNode.smoothingTimeConstant = 0.5;
        const barCount = 64;
        const sliceWidth = canvas.width / barCount;
        const context = canvas.getContext('2d');
        if (context !== null) {
          console.log('initializing rendering');
          renderingDataRef.current = {
            lastTime: null,
            barCount,
            canvas,
            sliceWidth,
            offset: 0,
            context,
            x: 0,
            averageBuffer: new Uint8Array(barCount),
            data: new Uint8Array(analyserNode.frequencyBinCount),
            analyserNode,
            frameId: requestAnimationFrame(draw),
          };
        }
      }
    }
  }, [draw, analyserNode, isPlaying]);

  useEffect(() => () => clearRenderingDataRef(), [clearRenderingDataRef]);
  useEffect(() => {
    if (!isPlaying) {
      clearRenderingDataRef();
    }
  }, [isPlaying, clearRenderingDataRef]);

  return <canvas width={canvasWidth} height={canvasHeight} ref={canvasRef} />;
}
