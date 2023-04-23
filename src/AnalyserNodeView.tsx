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
      const current = canvasRef.current;
      const renderingData = renderingDataRef.current;
      if (renderingData === null || current === null || isPlaying === null) {
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
        case 'webgl': {
          const gl = current.getContext('webgl');
          if (gl === null) {
            break;
          }
          break;
        }
        case 'verticalBars': {
          const ctx = current.getContext('2d');

          if (!ctx) {
            break;
          }

          /**
           * redraw
           */
          drawImmediately();

          const { analyserNode, data } = renderingData;

          ctx.clearRect(0, 0, current.width, current.height);

          analyserNode.getByteFrequencyData(data);

          let x = 0;
          // const average = data.reduce((a, b) => a + b, 0) / data.length;
          // renderingData.averageBuffer[renderingData.offset] = average;
          // renderingData.offset =
          //   (renderingData.offset + 1) % renderingData.averageBuffer.byteLength;
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
          // const elapsed = (now - renderingData.lastTime) / 1000;
          // renderingData.x -= renderingData.sliceWidth * elapsed;
          // console.log(renderingData.sliceWidth * elapsed);
          break;
        }
      }

      renderingData.lastTime = now;
    },
    [canvasRef, visualizationMode, isPlaying]
  );
  const clearRenderingDataRef = useCallback(() => {
    renderingDataRef.current = null;
  }, [renderingDataRef]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (analyserNode !== null && isPlaying && canvas !== null) {
      if (canvas.parentNode !== null) {
        if (canvas.parentNode instanceof HTMLElement) {
          canvas.width =
            canvas.parentNode.offsetWidth * window.devicePixelRatio;
          canvas.height =
            canvas.parentNode.offsetHeight * window.devicePixelRatio;
        }
      }
      if (renderingDataRef.current === null) {
        analyserNode.fftSize = 2 ** 10;
        analyserNode.minDecibels = -90;
        analyserNode.maxDecibels = -10;
        // analyserNode.smoothingTimeConstant = 0.5;
        const barCount = 64;
        const sliceWidth = canvas.width / barCount;
        renderingDataRef.current = {
          lastTime: null,
          barCount,
          sliceWidth,
          offset: 0,
          x: 0,
          averageBuffer: new Uint8Array(barCount),
          data: new Uint8Array(analyserNode.frequencyBinCount),
          analyserNode,
          frameId: requestAnimationFrame(draw),
        };
      }
    } else {
      clearRenderingDataRef();
    }
    return () => {
      if (
        renderingDataRef.current !== null &&
        renderingDataRef.current.frameId !== null
      ) {
        cancelAnimationFrame(renderingDataRef.current.frameId);
      }
      clearRenderingDataRef();
    };
  }, [draw, analyserNode, clearRenderingDataRef, isPlaying]);
  return <canvas width={canvasWidth} height={canvasHeight} ref={canvasRef} />;
}
