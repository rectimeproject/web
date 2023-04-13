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
  visualizationMode?: {
    barWidth: number;
    type: 'verticalBars';
  };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdRef = useRef<number | null>(null);

  const renderingDataRef = useRef<{
    analyserNode: AnalyserNode<IAudioContext>;
    data: Uint8Array;
    width: number;
    height: number;
  } | null>(null);
  const draw = useCallback(() => {
    const current = canvasRef.current;
    const ctx = current?.getContext('2d');
    const renderingData = renderingDataRef.current;
    if (!current || !ctx || renderingData === null || isPlaying === null) {
      if (ctx && current) {
        ctx.clearRect(0, 0, current.width, current.height);
      }
      return;
    }

    /**
     * redraw
     */
    frameIdRef.current = requestAnimationFrame(draw);

    const { analyserNode, data } = renderingData;

    ctx.clearRect(0, 0, current.width, current.height);

    switch (visualizationMode?.type) {
      default: {
        analyserNode.getByteTimeDomainData(data);

        let x = 0;
        const sliceWidth = current.width / data.length;

        for (const v of data) {
          const y = v / 128.0 - current.height;
          ctx.fillStyle = `rgb(0,0,${v % 255})`;
          ctx.fillRect(x, y, sliceWidth, current.height / 2);
          x += sliceWidth;
        }
        break;
      }
      case 'verticalBars': {
        analyserNode.getByteFrequencyData(data);

        const sliceWidth = current.width / 32;
        let x = 0;
        for (const barHeight of data) {
          ctx.fillStyle = `rgb(${barHeight % 255},${barHeight % 255},${
            barHeight % 255
          })`;

          ctx.fillRect(x, current.height, sliceWidth, -barHeight);
          x += sliceWidth + 1;
        }
        break;
      }
    }
  }, [canvasRef, visualizationMode, isPlaying, frameIdRef]);
  const clearRenderingDataRef = useCallback(() => {
    renderingDataRef.current = null;
  }, [renderingDataRef]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (analyserNode !== null && isPlaying && canvas !== null) {
      if (renderingDataRef.current === null) {
        analyserNode.fftSize = 2 ** 10;
        analyserNode.minDecibels = -90;
        analyserNode.maxDecibels = -10;
        analyserNode.smoothingTimeConstant = 0.5;
        renderingDataRef.current = {
          width: canvas.width,
          height: canvas.height,
          data: new Uint8Array(analyserNode.frequencyBinCount),
          analyserNode,
        };
        // canvas.width = renderingDataRef.current.width * window.devicePixelRatio;
        // canvas.height =
        //   renderingDataRef.current.height * window.devicePixelRatio;

        draw();
      }
    } else {
      clearRenderingDataRef();
    }
    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
      clearRenderingDataRef();
    };
  }, [draw, analyserNode, clearRenderingDataRef, isPlaying]);
  return <canvas width={canvasWidth} height={canvasHeight} ref={canvasRef} />;
}
