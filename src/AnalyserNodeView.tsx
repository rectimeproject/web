import { useCallback, useEffect, useRef } from 'react';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';

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

  const renderingDataRef = useRef<{
    analyserNode: AnalyserNode<IAudioContext>;
    data: Uint8Array;
    x: number;
    frameId: number;
  } | null>(null);
  const draw = useCallback(
    (_: number) => {
      const current = canvasRef.current;
      const renderingData = renderingDataRef.current;
      if (renderingData === null || current === null || isPlaying === null) {
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
          renderingData.frameId = requestAnimationFrame(draw);

          const { analyserNode, data } = renderingData;

          ctx.clearRect(0, 0, current.width, current.height);

          analyserNode.getByteFrequencyData(data);

          let x = renderingData.x;
          const sliceWidth = current.width / 64;
          for (let height of data) {
            ctx.fillStyle = '#495057';

            height = Math.max(height, 10);

            ctx.fillRect(
              x,
              current.height / 2 - height / 2,
              sliceWidth,
              height
            );
            x += sliceWidth;
          }
          // renderingData.x = x;
          break;
        }
      }
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
        renderingDataRef.current = {
          x: 0,
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
