import { useCallback, useEffect, useRef } from 'react';
import { AnalyserNode, IAudioContext } from 'standardized-audio-context';

export default function AnalyserNodeView({
  isPlaying,
  analyserNode,
}: {
  analyserNode: AnalyserNode<IAudioContext> | null;
  isPlaying: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderingDataRef = useRef<{
    analyserNode: AnalyserNode<IAudioContext>;
    data: Uint8Array;
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
    requestAnimationFrame(draw);

    const { analyserNode, data } = renderingData;

    analyserNode.getByteTimeDomainData(data);

    let x = 0;
    const sliceWidth = current.width / data.length;

    ctx.clearRect(0, 0, current.width, current.height);

    for (const v of data) {
      const y = v - current.height;
      ctx.fillStyle = `rgb(0,0,${v % 255})`;
      ctx.fillRect(x, y, sliceWidth, current.height / 2);
      x += sliceWidth;
    }
  }, [canvasRef, isPlaying]);
  const clearRenderingDataRef = useCallback(() => {
    renderingDataRef.current = null;
  }, [renderingDataRef]);

  useEffect(() => {
    if (analyserNode !== null && isPlaying) {
      if (renderingDataRef.current === null) {
        analyserNode.fftSize = 2 ** 13;
        renderingDataRef.current = {
          data: new Uint8Array(analyserNode.frequencyBinCount),
          analyserNode,
        };
        draw();
      }
    } else {
      clearRenderingDataRef();
    }
    return () => {
      clearRenderingDataRef();
    };
  }, [draw, analyserNode, clearRenderingDataRef, isPlaying]);
  return (
    <canvas
      style={{
        width: '100%',
      }}
      height={100}
      ref={canvasRef}
    />
  );
}
