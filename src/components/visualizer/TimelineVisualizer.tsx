import {Container, Graphics} from "pixi.js";
import {useEffect, useMemo, useRef} from "react";
import {IAnalyserNode, IAudioContext} from "standardized-audio-context";

import {memo} from "react";
import usePixiApplication from "../../lib/webgl/hooks/usePixiApplication";

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

export default memo(function TimelineVisualizer({
  canvasWidth,
  canvasHeight,
  analyserNodeRef,
  backgroundColor,
  barColor
}: {
  analyserNodeRef: React.RefObject<IAnalyserNode<IAudioContext> | null>;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: number;
  barColor: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {onTick, onConstruct} = usePixiApplication({
    containerRef
  });

  useEffect(() => {
    const bars = new Array<Graphics>();

    const calculateBarDimensions = ({barCount}: {barCount: number}) => {
      const realBarWidth = Math.floor(canvasWidth / barCount);
      const barGap = realBarWidth * 0.4;
      const totalBarGap = Math.ceil((barCount - 1) * barGap);
      const barWidth = (canvasWidth - totalBarGap) / barCount;
      return {barCount, barWidth, barGap};
    };

    const desiredBarCount = canvasWidth * (1 / 16);
    const barCount = Math.floor(canvasWidth / (canvasWidth / desiredBarCount));
    const {barGap, barWidth} = calculateBarDimensions({
      barCount
    });
    const removeConstructCallback = onConstruct(stage => {
      stage.removeChildren();

      const container = new Container({
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight
      });

      container.addChild(
        new Graphics({
          x: 0,
          y: 0,
          width: canvasWidth,
          height: canvasHeight
        })
          .rect(0, 0, canvasWidth, canvasHeight)
          .fill(backgroundColor)
      );

      for (let i = 0; i < barCount; i++) {
        const bar = new Graphics({
          x: i * (barWidth + barGap),
          y: canvasHeight / 2
        });
        bars.push(bar);
        container.addChild(bar);
      }
      stage.addChild(container);
    });

    const amplitudeRecords = new Array<number>(barCount).fill(0);
    let recordIndex = 0;
    const MAX_COLOR = 2 ** 24 - 1;
    let timeDomainData: Float32Array | null = null;

    const removeTickCallback = onTick(() => {
      const analyserNode = analyserNodeRef.current;
      if (analyserNode === null) {
        return;
      }

      if (!timeDomainData || timeDomainData.length !== analyserNode.fftSize) {
        timeDomainData = new Float32Array(analyserNode.fftSize);
      }

      analyserNode.getFloatTimeDomainData(timeDomainData);

      {
        const rms = calculateRMS(timeDomainData);
        amplitudeRecords[recordIndex % amplitudeRecords.length] = Math.min(
          rms * 4.0,
          1.0
        );
        recordIndex++;
      }

      const maxBarHeight = canvasHeight * 0.8;

      for (let i = 0; i < amplitudeRecords.length; i++) {
        // const index = (i + recordIndex) % amplitudeRecords.length;
        // const reversedIndex = amplitudeRecords.length - 1 - index;
        const rms =
          amplitudeRecords[(i + recordIndex) % amplitudeRecords.length] ?? null;
        if (rms === null) {
          continue;
        }
        const bar = bars[i] ?? null;
        if (!bar) {
          continue;
        }
        const barHeight = Math.max(2, maxBarHeight * rms);
        bar
          .clear()
          .roundRect(0, -barHeight / 2, barWidth, barHeight, barWidth)
          .fill(barColor % MAX_COLOR);
      }
    });

    return () => {
      removeTickCallback();
      removeConstructCallback();
    };
  }, [
    barColor,
    onTick,
    onConstruct,
    backgroundColor,
    analyserNodeRef,
    canvasWidth,
    canvasHeight
  ]);

  const containerDimensions = useMemo(
    () => ({
      width: canvasWidth,
      height: canvasHeight
    }),
    [canvasWidth, canvasHeight]
  );

  return (
    <div
      ref={containerRef}
      style={containerDimensions}
    />
  );
});
